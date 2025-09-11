using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ServiceStack.Alive.Configuration;

namespace ServiceStack.Alive.Middleware;

/// <summary>
/// Modern ASP.NET Core middleware using OpenTelemetry Activities and structured logging
/// Automatically creates spans and enriches them with request/response data
/// </summary>
public class ServiceStackAliveMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ServiceStackAliveMiddleware> _logger;
    private readonly TelemetryOptions _options;
    private readonly ActivitySource _activitySource;

    private static readonly ActivitySource ActivitySource = new("ServiceStack.Alive");

    public ServiceStackAliveMiddleware(
        RequestDelegate next, 
        ILogger<ServiceStackAliveMiddleware> logger,
        IOptions<TelemetryOptions> options)
    {
        _next = next;
        _logger = logger;
        _options = options.Value;
        _activitySource = ActivitySource;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip telemetry for health checks and other non-business endpoints
        if (ShouldSkipTelemetry(context))
        {
            await _next(context);
            return;
        }

        // Create correlation ID if not present
        var correlationId = EnsureCorrelationId(context);
        
        // Start custom activity for business logic tracking
        using var activity = _activitySource.StartActivity("http.request.processing");
        EnrichActivityWithRequestData(activity, context, correlationId);

        var stopwatch = Stopwatch.StartNew();

        try
        {
            // Add correlation to logging scope
            using (_logger.BeginScope(CreateLoggingScope(context, correlationId)))
            {
                _logger.LogInformation("Processing request {Method} {Path} from {ClientIP}", 
                    context.Request.Method, 
                    context.Request.Path,
                    GetClientIpAddress(context));

                await _next(context);

                stopwatch.Stop();

                // Log successful completion with metrics
                _logger.LogInformation("Request completed {Method} {Path} -> {StatusCode} in {ElapsedMs}ms",
                    context.Request.Method, 
                    context.Request.Path, 
                    context.Response.StatusCode,
                    stopwatch.ElapsedMilliseconds);

                // Add response data to activity
                EnrichActivityWithResponseData(activity, context, stopwatch.ElapsedMilliseconds);
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            // Log exception with full context
            _logger.LogError(ex, "Request failed {Method} {Path} after {ElapsedMs}ms: {ErrorMessage}",
                context.Request.Method, 
                context.Request.Path, 
                stopwatch.ElapsedMilliseconds,
                ex.Message);

            // Mark activity as error
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.SetTag("exception.type", ex.GetType().Name);
            activity?.SetTag("exception.message", ex.Message);
            activity?.SetTag("exception.stacktrace", ex.StackTrace);

            throw;
        }
    }

    private static bool ShouldSkipTelemetry(HttpContext context)
    {
        var path = context.Request.Path.Value?.ToLowerInvariant();
        
        // Skip common health check and monitoring endpoints
        var skipPaths = new[]
        {
            "/health", "/healthz", "/health/ready", "/health/live",
            "/metrics", "/ping", "/status", "/favicon.ico"
        };

        return skipPaths.Any(skipPath => path?.StartsWith(skipPath) == true);
    }

    private static string EnsureCorrelationId(HttpContext context)
    {
        var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(correlationId))
        {
            correlationId = $"req-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}";
        }
        
        context.Request.Headers["X-Correlation-Id"] = correlationId;
        context.Response.Headers["X-Correlation-Id"] = correlationId;
        
        return correlationId;
    }

    private static void EnrichActivityWithRequestData(Activity? activity, HttpContext context, string correlationId)
    {
        if (activity == null) return;

        activity.SetTag("correlation.id", correlationId);
        activity.SetTag("request.path", context.Request.Path);
        activity.SetTag("request.method", context.Request.Method);
        activity.SetTag("request.scheme", context.Request.Scheme);
        activity.SetTag("request.host", context.Request.Host.Value);
        activity.SetTag("request.query_string", context.Request.QueryString.Value);
        activity.SetTag("http.client_ip", GetClientIpAddress(context));
        activity.SetTag("http.user_agent", context.Request.Headers["User-Agent"].ToString());
        
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            activity.SetTag("user.id", context.User.Identity.Name);
            activity.SetTag("user.authenticated", true);
        }

        // Add custom headers
        foreach (var header in context.Request.Headers.Where(h => IsImportantHeader(h.Key)))
        {
            activity.SetTag($"http.request.header.{header.Key.ToLowerInvariant()}", header.Value.ToString());
        }
    }

    private static void EnrichActivityWithResponseData(Activity? activity, HttpContext context, long elapsedMs)
    {
        if (activity == null) return;

        activity.SetTag("response.status_code", context.Response.StatusCode);
        activity.SetTag("response.duration_ms", elapsedMs);
        activity.SetTag("response.content_length", context.Response.ContentLength);
        activity.SetTag("response.content_type", context.Response.ContentType);
        
        if (context.Response.StatusCode >= 400)
        {
            activity.SetStatus(ActivityStatusCode.Error, $"HTTP {context.Response.StatusCode}");
        }
    }

    private static Dictionary<string, object> CreateLoggingScope(HttpContext context, string correlationId)
    {
        return new Dictionary<string, object>
        {
            ["CorrelationId"] = correlationId,
            ["RequestPath"] = context.Request.Path.Value ?? "",
            ["RequestMethod"] = context.Request.Method,
            ["ClientIP"] = GetClientIpAddress(context),
            ["UserAgent"] = context.Request.Headers["User-Agent"].ToString(),
            ["RequestId"] = Activity.Current?.Id ?? "",
            ["TraceId"] = Activity.Current?.TraceId.ToString() ?? ""
        };
    }

    private static string GetClientIpAddress(HttpContext context)
    {
        // Check for forwarded IP first (common in load balancer scenarios)
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            var ip = forwardedFor.Split(',')[0].Trim();
            if (!string.IsNullOrEmpty(ip)) return ip;
        }

        // Check for real IP header
        var realIp = context.Request.Headers["X-Real-IP"].FirstOrDefault();
        if (!string.IsNullOrEmpty(realIp)) return realIp;

        // Fall back to connection remote IP
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static bool IsImportantHeader(string headerName)
    {
        var importantHeaders = new[]
        {
            "accept", "accept-encoding", "accept-language", "authorization",
            "content-type", "content-length", "origin", "referer", 
            "x-requested-with", "x-api-key", "x-client-version"
        };

        return importantHeaders.Contains(headerName.ToLowerInvariant());
    }
}
