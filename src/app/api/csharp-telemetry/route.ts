import { NextResponse } from "next/server";

// Serves modern C# OTLP/OpenTelemetry integration code examples
export async function GET() {
  const csharpCode = `// Modern C# OTLP/OpenTelemetry Integration - Updated 2025
// Package References: OpenTelemetry, OpenTelemetry.Exporter.OpenTelemetryProtocol, OpenTelemetry.Extensions.Hosting

using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Options;
using OpenTelemetry;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Exporter;

namespace Consolidated.Telemetry;

// ========================================
// 1. MODERN OTLP SINK (Replaces old Serilog sink)
// ========================================

/// <summary>
/// Modern OpenTelemetry logging provider that sends structured logs via OTLP
/// Replaces custom Serilog sink with standardized OpenTelemetry approach
/// </summary>
public static class TelemetryConfiguration
{
    public static IServiceCollection AddModernTelemetry(this IServiceCollection services, IConfiguration config)
    {
        var otlpEndpoint = config["Telemetry:OtlpEndpoint"] ?? "http://localhost:3001/api/ingest/otlp";
        var serviceName = config["Telemetry:ServiceName"] ?? "dotnet-service";
        var serviceVersion = config["Telemetry:ServiceVersion"] ?? "1.0.0";

        // Resource defines service identity for all telemetry
        var resource = ResourceBuilder.CreateDefault()
            .AddService(serviceName: serviceName, serviceVersion: serviceVersion)
            .AddAttributes(new Dictionary<string, object>
            {
                ["deployment.environment"] = config["ASPNETCORE_ENVIRONMENT"] ?? "development",
                ["host.name"] = Environment.MachineName,
                ["process.pid"] = Environment.ProcessId
            });

        // Configure OpenTelemetry with OTLP export
        services.AddOpenTelemetry()
            .WithTracing(builder => builder
                .SetResourceBuilder(resource)
                .AddAspNetCoreInstrumentation(options =>
                {
                    options.RecordException = true;
                    options.EnrichWithHttpRequest = EnrichWithHttpRequest;
                    options.EnrichWithHttpResponse = EnrichWithHttpResponse;
                })
                .AddHttpClientInstrumentation()
                .AddEntityFrameworkCoreInstrumentation() // if using EF Core
                .AddOtlpExporter(options =>
                {
                    options.Endpoint = new Uri(otlpEndpoint);
                    options.Protocol = OtlpExportProtocol.HttpProtobuf;
                    options.TimeoutMilliseconds = 5000;
                }))
            .WithMetrics(builder => builder
                .SetResourceBuilder(resource)
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation()
                .AddProcessInstrumentation()
                .AddOtlpExporter(options =>
                {
                    options.Endpoint = new Uri(otlpEndpoint);
                    options.Protocol = OtlpExportProtocol.HttpProtobuf;
                    options.TemporalityPreference = MetricReaderTemporalityPreference.Delta;
                }))
            .WithLogging(builder => builder
                .SetResourceBuilder(resource)
                .AddOtlpExporter(options =>
                {
                    options.Endpoint = new Uri(otlpEndpoint);
                    options.Protocol = OtlpExportProtocol.HttpProtobuf;
                }));

        return services;
    }

    // Enrich traces with custom HTTP data
    private static void EnrichWithHttpRequest(Activity activity, HttpRequest request)
    {
        activity.SetTag("http.client_ip", request.HttpContext.Connection.RemoteIpAddress?.ToString());
        activity.SetTag("http.user_agent", request.Headers["User-Agent"].ToString());
        activity.SetTag("http.correlation_id", request.Headers["X-Correlation-Id"].ToString());
        
        if (request.HttpContext.User?.Identity?.IsAuthenticated == true)
        {
            activity.SetTag("user.id", request.HttpContext.User.Identity.Name);
        }
    }

    private static void EnrichWithHttpResponse(Activity activity, HttpResponse response)
    {
        activity.SetTag("http.response.size", response.ContentLength);
        if (response.StatusCode >= 400)
        {
            activity.SetStatus(ActivityStatusCode.Error, \$"HTTP {response.StatusCode}\");
        }
    }
}

// ========================================
// 2. MODERN TELEMETRY MIDDLEWARE (Replaces old EventTrackingMiddleware)
// ========================================

/// <summary>
/// Modern ASP.NET Core middleware using OpenTelemetry Activities and structured logging
/// Automatically creates spans and enriches them with request/response data
/// </summary>
public class ModernTelemetryMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ModernTelemetryMiddleware> _logger;
    private readonly ActivitySource _activitySource;
    private readonly IConfiguration _config;

    private static readonly ActivitySource ActivitySource = new("Consolidated.WebApi");

    public ModernTelemetryMiddleware(
        RequestDelegate next, 
        ILogger<ModernTelemetryMiddleware> logger,
        IConfiguration config)
    {
        _next = next;
        _logger = logger;
        _config = config;
        _activitySource = ActivitySource;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Create correlation ID if not present
        var correlationId = EnsureCorrelationId(context);
        
        // Start custom activity for business logic tracking
        using var activity = _activitySource.StartActivity("http.request.processing");
        activity?.SetTag("correlation.id", correlationId);
        activity?.SetTag("request.path", context.Request.Path);
        activity?.SetTag("request.method", context.Request.Method);

        var stopwatch = Stopwatch.StartNew();

        try
        {
            // Add correlation to logging scope
            using (_logger.BeginScope(new Dictionary<string, object>
            {
                ["CorrelationId"] = correlationId,
                ["RequestPath"] = context.Request.Path,
                ["RequestMethod"] = context.Request.Method,
                ["ClientIP"] = context.Connection.RemoteIpAddress?.ToString()
            }))
            {
                _logger.LogInformation("Processing request {Method} {Path}", 
                    context.Request.Method, context.Request.Path);

                await _next(context);

                stopwatch.Stop();

                // Log successful completion with metrics
                _logger.LogInformation("Request completed {Method} {Path} -> {StatusCode} in {ElapsedMs}ms",
                    context.Request.Method, 
                    context.Request.Path, 
                    context.Response.StatusCode,
                    stopwatch.ElapsedMilliseconds);

                // Add response data to activity
                activity?.SetTag("response.status_code", context.Response.StatusCode);
                activity?.SetTag("response.duration_ms", stopwatch.ElapsedMilliseconds);
                
                if (context.Response.StatusCode >= 400)
                {
                    activity?.SetStatus(ActivityStatusCode.Error, \$"HTTP {context.Response.StatusCode}\");
                }
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            // Log exception with full context
            _logger.LogError(ex, "Request failed {Method} {Path} after {ElapsedMs}ms",
                context.Request.Method, context.Request.Path, stopwatch.ElapsedMilliseconds);

            // Mark activity as error
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.SetTag("exception.type", ex.GetType().Name);
            activity?.SetTag("exception.message", ex.Message);

            throw;
        }
    }

    private static string EnsureCorrelationId(HttpContext context)
    {
        var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(correlationId))
        {
            correlationId = \$"req-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}";
        }
        
        context.Request.Headers["X-Correlation-Id"] = correlationId;
        context.Response.Headers["X-Correlation-Id"] = correlationId;
        
        return correlationId;
    }
}

// ========================================
// 3. CONFIGURATION MODELS
// ========================================

public class TelemetryConfig
{
    public string ServiceName { get; set; } = "dotnet-service";
    public string ServiceVersion { get; set; } = "1.0.0";
    public string OtlpEndpoint { get; set; } = "http://localhost:3001/api/ingest/otlp";
    public bool TracingEnabled { get; set; } = true;
    public bool MetricsEnabled { get; set; } = true;
    public bool LoggingEnabled { get; set; } = true;
    public int TimeoutMs { get; set; } = 5000;
    public OtlpExportProtocol Protocol { get; set; } = OtlpExportProtocol.HttpProtobuf;
}

// ========================================
// 4. STARTUP CONFIGURATION
// ========================================

// Program.cs setup example:
/*
var builder = WebApplication.CreateBuilder(args);

// Add modern telemetry
builder.Services.AddModernTelemetry(builder.Configuration);

// Add controllers, etc.
builder.Services.AddControllers();

var app = builder.Build();

// Add telemetry middleware early in pipeline
app.UseMiddleware<ModernTelemetryMiddleware>();

// Configure HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseRouting();
app.MapControllers();

app.Run();
*/

// ========================================
// 5. APPSETTINGS.JSON CONFIGURATION
// ========================================

/*
{
  "Telemetry": {
    "ServiceName": "my-api-service",
    "ServiceVersion": "2.1.0",
    "OtlpEndpoint": "http://localhost:3001/api/ingest/otlp",
    "TracingEnabled": true,
    "MetricsEnabled": true,
    "LoggingEnabled": true,
    "TimeoutMs": 5000
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "OpenTelemetry": "Warning"
    }
  }
}
*/

// ========================================
// 6. CUSTOM BUSINESS METRICS EXAMPLE
// ========================================

/// <summary>
/// Example service showing how to create custom metrics and traces
/// </summary>
public class BusinessMetricsService
{
    private readonly ILogger<BusinessMetricsService> _logger;
    private readonly ActivitySource _activitySource;
    private readonly Meter _meter;
    private readonly Counter<long> _orderCounter;
    private readonly Histogram<double> _orderValueHistogram;

    public BusinessMetricsService(ILogger<BusinessMetricsService> logger)
    {
        _logger = logger;
        _activitySource = new ActivitySource("BusinessMetrics");
        _meter = new Meter("BusinessMetrics");
        
        _orderCounter = _meter.CreateCounter<long>("orders_total", "count", "Total number of orders processed");
        _orderValueHistogram = _meter.CreateHistogram<double>("order_value", "USD", "Order value distribution");
    }

    public async Task<bool> ProcessOrderAsync(int orderId, decimal amount, string userId)
    {
        using var activity = _activitySource.StartActivity("order.process");
        activity?.SetTag("order.id", orderId);
        activity?.SetTag("order.amount", amount);
        activity?.SetTag("user.id", userId);

        try
        {
            _logger.LogInformation("Processing order {OrderId} for {Amount:C} by user {UserId}", 
                orderId, amount, userId);

            // Simulate business logic
            await Task.Delay(Random.Shared.Next(50, 200));

            // Record metrics
            _orderCounter.Add(1, new TagList
            {
                ["user.id"] = userId,
                ["order.status"] = "success"
            });
            
            _orderValueHistogram.Record((double)amount, new TagList
            {
                ["currency"] = "USD"
            });

            _logger.LogInformation("Order {OrderId} processed successfully", orderId);
            activity?.SetStatus(ActivityStatusCode.Ok);
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process order {OrderId}", orderId);
            
            _orderCounter.Add(1, new TagList
            {
                ["user.id"] = userId,
                ["order.status"] = "error"
            });
            
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }
}

// ========================================
// 7. PACKAGE REFERENCES NEEDED
// ========================================

/*
<PackageReference Include="OpenTelemetry" Version="1.6.0" />
<PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.6.0" />
<PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.6.0" />
<PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.5.1-beta.1" />
<PackageReference Include="OpenTelemetry.Instrumentation.Http" Version="1.5.1-beta.1" />
<PackageReference Include="OpenTelemetry.Instrumentation.EntityFrameworkCore" Version="1.0.0-beta.7" />
<PackageReference Include="OpenTelemetry.Instrumentation.Runtime" Version="1.5.1" />
<PackageReference Include="OpenTelemetry.Instrumentation.Process" Version="0.5.0-beta.4" />
*/`;

  return new NextResponse(csharpCode, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="modern-csharp-otlp.cs"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
