using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OpenTelemetry;
using OpenTelemetry.Exporter;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using ServiceStack.Alive.Configuration;
using ServiceStack.Alive.Middleware;
using ServiceStack.Alive.Sinks;
using System.Diagnostics;

namespace ServiceStack.Alive.Extensions;

/// <summary>
/// Extension methods for configuring ServiceStack.Alive telemetry
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds ServiceStack.Alive telemetry with OpenTelemetry and Serilog integration
    /// </summary>
    public static IServiceCollection AddServiceStackAlive(
        this IServiceCollection services, 
        IConfiguration configuration,
        string? configSection = null)
    {
        var sectionName = configSection ?? TelemetryOptions.SectionName;
        
        // Configure and validate options
        services.Configure<TelemetryOptions>(configuration.GetSection(sectionName));
        services.AddSingleton<IValidateOptions<TelemetryOptions>, TelemetryOptionsValidator>();
        
        // Get options for immediate use
        var telemetryOptions = new TelemetryOptions();
        configuration.GetSection(sectionName).Bind(telemetryOptions);

        // Build resource for all telemetry
        var resource = CreateTelemetryResource(telemetryOptions);

        // Add OpenTelemetry if enabled
        if (telemetryOptions.Features.TracingEnabled || telemetryOptions.Features.MetricsEnabled)
        {
            services.AddOpenTelemetry()
                .ConfigureResource(rb => rb.AddService(
                    serviceName: telemetryOptions.ServiceName,
                    serviceVersion: telemetryOptions.ServiceVersion,
                    serviceInstanceId: Environment.MachineName))
                .WithTracing(builder => ConfigureTracing(builder, telemetryOptions))
                .WithMetrics(builder => ConfigureMetrics(builder, telemetryOptions));
        }

        // Configure OpenTelemetry logging separately
        if (telemetryOptions.Features.LoggingEnabled)
        {
            services.Configure<OpenTelemetryLoggerOptions>(options =>
            {
                ConfigureOtelLogging(options, telemetryOptions);
            });
        }

        // Configure Serilog if enabled
        if (telemetryOptions.Features.LoggingEnabled)
        {
            ConfigureSerilog(services, telemetryOptions);
        }

        return services;
    }

    /// <summary>
    /// Adds ServiceStack.Alive middleware to the request pipeline
    /// </summary>
    public static IApplicationBuilder UseServiceStackAlive(this IApplicationBuilder app)
    {
        return app.UseMiddleware<ServiceStackAliveMiddleware>();
    }

    private static ResourceBuilder CreateTelemetryResource(TelemetryOptions options)
    {
        var resource = ResourceBuilder.CreateDefault()
            .AddService(
                serviceName: options.ServiceName,
                serviceVersion: options.ServiceVersion,
                serviceInstanceId: Environment.MachineName)
            .AddAttributes(new Dictionary<string, object>
            {
                ["deployment.environment"] = options.Environment,
                ["host.name"] = Environment.MachineName,
                ["process.pid"] = Environment.ProcessId,
                ["process.runtime.name"] = ".NET",
                ["process.runtime.version"] = Environment.Version.ToString(),
                ["telemetry.sdk.name"] = "ServiceStack.Alive",
                ["telemetry.sdk.version"] = typeof(ServiceCollectionExtensions).Assembly.GetName().Version?.ToString() ?? "1.0.0"
            });

        // Add custom resource attributes
        foreach (var attribute in options.ResourceAttributes)
        {
            resource.AddAttributes(new Dictionary<string, object> { [attribute.Key] = attribute.Value });
        }

        return resource;
    }

    private static void ConfigureTracing(TracerProviderBuilder builder, TelemetryOptions options)
    {
        if (!options.Features.TracingEnabled) return;

        // Configure sampling
        builder.SetSampler(new TraceIdRatioBasedSampler(options.Tracing.SamplingRatio));

        // Add instrumentations based on configuration
        if (options.Tracing.EnableAspNetCoreInstrumentation)
        {
            builder.AddAspNetCoreInstrumentation(opt =>
            {
                opt.RecordException = true;
                opt.EnrichWithHttpRequest = (activity, request) => EnrichWithHttpRequest(activity, request);
                opt.EnrichWithHttpResponse = (activity, response) => EnrichWithHttpResponse(activity, response);
            });
        }

        if (options.Tracing.EnableHttpInstrumentation)
        {
            builder.AddHttpClientInstrumentation(opt =>
            {
                opt.RecordException = true;
                opt.EnrichWithHttpRequestMessage = (activity, request) => EnrichWithHttpClientRequest(activity, request);
                opt.EnrichWithHttpResponseMessage = (activity, response) => EnrichWithHttpClientResponse(activity, response);
            });
        }

        if (options.Tracing.EnableRedisInstrumentation)
        {
            try
            {
                builder.AddRedisInstrumentation();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ServiceStack.Alive] Failed to add Redis instrumentation: {ex.Message}");
            }
        }

        if (options.Tracing.EnableSqlClientInstrumentation)
        {
            try
            {
                builder.AddSqlClientInstrumentation(opt =>
                {
                    opt.RecordException = true;
                    opt.SetDbStatementForText = true;
                    opt.SetDbStatementForStoredProcedure = true;
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ServiceStack.Alive] Failed to add SQL Client instrumentation: {ex.Message}");
            }
        }

        // Add OTLP exporter
        AddOtlpTraceExporter(builder, options);
    }

    private static void ConfigureMetrics(MeterProviderBuilder builder, TelemetryOptions options)
    {
        if (!options.Features.MetricsEnabled) return;

        // Add instrumentations
        if (options.Metrics.EnableAspNetCoreInstrumentation)
            builder.AddAspNetCoreInstrumentation();

        if (options.Metrics.EnableHttpClientInstrumentation)
            builder.AddHttpClientInstrumentation();

        if (options.Metrics.EnableRuntimeInstrumentation)
            builder.AddRuntimeInstrumentation();

        if (options.Metrics.EnableProcessInstrumentation)
        {
            try
            {
                builder.AddProcessInstrumentation();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ServiceStack.Alive] Failed to add Process instrumentation: {ex.Message}");
            }
        }

        // Add custom meters
        foreach (var meter in options.Metrics.CustomMeters)
        {
            builder.AddMeter(meter);
        }

        // Add OTLP exporter
        AddOtlpMetricsExporter(builder, options);
    }

    private static void ConfigureOtelLogging(OpenTelemetryLoggerOptions options, TelemetryOptions telemetryOptions)
    {
        if (!telemetryOptions.Features.LoggingEnabled) return;

        options.IncludeScopes = telemetryOptions.Logging.IncludeScopes;
        options.ParseStateValues = telemetryOptions.Logging.ParseStateValues;
        options.IncludeFormattedMessage = telemetryOptions.Logging.IncludeFormattedMessage;

        // Add OTLP exporter
        options.AddOtlpExporter(otlpOptions => ConfigureOtlpExporter(otlpOptions, telemetryOptions));
    }

    private static void ConfigureSerilog(IServiceCollection services, TelemetryOptions options)
    {
        // Configure Serilog to work alongside OTEL
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
            .MinimumLevel.Override("System", Serilog.Events.LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("ServiceName", options.ServiceName)
            .Enrich.WithProperty("ServiceVersion", options.ServiceVersion)
            .Enrich.WithProperty("Environment", options.Environment)
            .WriteTo.Console(outputTemplate: 
                "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
            .WriteTo.ServiceStackAliveOtlp(options, Serilog.Events.LogEventLevel.Information)
            .CreateLogger();

        services.AddSingleton(Log.Logger);
        services.AddLogging(builder => builder.AddSerilog(dispose: true));
    }

    private static void AddOtlpTraceExporter(TracerProviderBuilder builder, TelemetryOptions options)
    {
        builder.AddOtlpExporter(otlpOptions => ConfigureOtlpExporter(otlpOptions, options));
    }

    private static void AddOtlpMetricsExporter(MeterProviderBuilder builder, TelemetryOptions options)
    {
        builder.AddOtlpExporter((otlpOptions, readerOptions) =>
        {
            ConfigureOtlpExporter(otlpOptions, options);
            readerOptions.PeriodicExportingMetricReaderOptions.ExportIntervalMilliseconds = 
                options.Metrics.ExportIntervalSeconds * 1000;
        });
    }

    private static void ConfigureOtlpExporter(OtlpExporterOptions otlpOptions, TelemetryOptions telemetryOptions)
    {
        otlpOptions.Endpoint = new Uri(telemetryOptions.Otlp.Endpoint);
        otlpOptions.Protocol = telemetryOptions.Otlp.Protocol == "Grpc" 
            ? OtlpExportProtocol.Grpc 
            : OtlpExportProtocol.HttpProtobuf;
        otlpOptions.TimeoutMilliseconds = telemetryOptions.Otlp.TimeoutSeconds * 1000;

        // Add custom headers
        if (telemetryOptions.Otlp.Headers.Count > 0)
        {
            otlpOptions.Headers = string.Join(",", 
                telemetryOptions.Otlp.Headers.Select(h => $"{h.Key}={h.Value}"));
        }
    }

    // Enrichment methods for better telemetry data
    private static void EnrichWithHttpRequest(Activity activity, Microsoft.AspNetCore.Http.HttpRequest request)
    {
        activity.SetTag("http.client_ip", GetClientIpAddress(request));
        activity.SetTag("http.user_agent", request.Headers["User-Agent"].ToString());
        activity.SetTag("http.correlation_id", request.Headers["X-Correlation-Id"].ToString());
        
        if (request.HttpContext.User?.Identity?.IsAuthenticated == true)
        {
            activity.SetTag("user.id", request.HttpContext.User.Identity.Name);
            activity.SetTag("user.authenticated", true);
        }
    }

    private static void EnrichWithHttpResponse(Activity activity, Microsoft.AspNetCore.Http.HttpResponse response)
    {
        activity.SetTag("http.response.size", response.ContentLength);
        activity.SetTag("http.response.content_type", response.ContentType);
        
        if (response.StatusCode >= 400)
        {
            activity.SetStatus(ActivityStatusCode.Error, $"HTTP {response.StatusCode}");
        }
    }

    private static void EnrichWithHttpClientRequest(Activity activity, HttpRequestMessage request)
    {
        activity.SetTag("http.client.method", request.Method.ToString());
        activity.SetTag("http.client.url", request.RequestUri?.ToString());
        activity.SetTag("http.client.request.size", request.Content?.Headers.ContentLength);
    }

    private static void EnrichWithHttpClientResponse(Activity activity, HttpResponseMessage response)
    {
        activity.SetTag("http.client.response.size", response.Content.Headers.ContentLength);
        activity.SetTag("http.client.response.content_type", response.Content.Headers.ContentType?.ToString());
        
        if ((int)response.StatusCode >= 400)
        {
            activity.SetStatus(ActivityStatusCode.Error, $"HTTP {response.StatusCode}");
        }
    }

    private static string GetClientIpAddress(Microsoft.AspNetCore.Http.HttpRequest request)
    {
        var forwardedFor = request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            return forwardedFor.Split(',')[0].Trim();
        }

        var realIp = request.Headers["X-Real-IP"].FirstOrDefault();
        if (!string.IsNullOrEmpty(realIp)) return realIp;

        return request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
