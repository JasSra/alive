import { NextResponse } from "next/server";

// Serves modern C# OTLP/OpenTelemetry integration code examples
export async function GET() {
  const csharpCode = `// Modern C# OTLP/OpenTelemetry Integration - Updated 2025
// 🚀 ServiceStack.Alive NuGet Package Available!
// Install: dotnet add package ServiceStack.Alive

using ServiceStack.Alive.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add ServiceStack.Alive telemetry with comprehensive observability
builder.Services.AddServiceStackAlive(builder.Configuration);
builder.Services.AddControllers();

var app = builder.Build();

// Add ServiceStack.Alive middleware early in the pipeline
app.UseServiceStackAlive();

app.UseRouting();
app.MapControllers();
app.Run();

// ========================================
// 📦 NUGET PACKAGE: ServiceStack.Alive 1.0.0
// ========================================

/*
FEATURES INCLUDED:
✅ Request/Response Middleware - Automatic correlation tracking
✅ OpenTelemetry Integration - Modern OTLP with tracing & metrics  
✅ Serilog OTLP Sink - Structured logging with correlation
✅ Configuration-Driven - Easy JSON setup with feature toggles
✅ Production Ready - Optimized performance with async operations

INSTALLATION:
dotnet add package ServiceStack.Alive

CONFIGURATION (appsettings.json):
{
  "Telemetry": {
    "ServiceName": "MyService",
    "ServiceVersion": "1.0.0",
    "Environment": "production",
    "Otlp": {
      "Endpoint": "http://localhost:3001/api/ingest/otlp",
      "Protocol": "HttpProtobuf",
      "TimeoutSeconds": 10
    },
    "Features": {
      "TracingEnabled": true,
      "MetricsEnabled": true,
      "LoggingEnabled": true,
      "SerilogOtlpSinkEnabled": true
    },
    "Tracing": {
      "SamplingRatio": 1.0,
      "EnableHttpInstrumentation": true,
      "EnableAspNetCoreInstrumentation": true,
      "EnableRedisInstrumentation": true
    },
    "Metrics": {
      "ExportIntervalSeconds": 30,
      "EnableRuntimeInstrumentation": true,
      "EnableProcessInstrumentation": true,
      "CustomMeters": ["MyService.*"]
    },
    "ResourceAttributes": {
      "service.namespace": "mycompany",
      "service.instance.id": "prod-001"
    }
  }
}

CUSTOM BUSINESS METRICS EXAMPLE:
*/

using System.Diagnostics;
using System.Diagnostics.Metrics;
using Microsoft.Extensions.Logging;

public class OrderService
{
    private readonly ILogger<OrderService> _logger;
    private readonly ActivitySource _activitySource;
    private readonly Meter _meter;
    private readonly Counter<long> _orderCounter;
    private readonly Histogram<double> _orderValueHistogram;

    public OrderService(ILogger<OrderService> logger)
    {
        _logger = logger;
        _activitySource = new ActivitySource("MyService.Orders");
        _meter = new Meter("MyService.Orders");
        
        _orderCounter = _meter.CreateCounter<long>("orders_total");
        _orderValueHistogram = _meter.CreateHistogram<double>("order_value");
    }

    public async Task<bool> ProcessOrderAsync(int orderId, decimal amount, string userId)
    {
        using var activity = _activitySource.StartActivity("order.process");
        activity?.SetTag("order.id", orderId.ToString());
        activity?.SetTag("order.amount", amount.ToString());
        activity?.SetTag("user.id", userId);

        try
        {
            _logger.LogInformation("Processing order {OrderId} for {Amount:C} by user {UserId}", 
                orderId, amount, userId);

            // Your business logic here
            await Task.Delay(Random.Shared.Next(50, 200));

            // Record metrics
            var tags = new TagList
            {
                { "user_id", userId },
                { "order_status", "success" }
            };
            
            _orderCounter.Add(1, tags);
            _orderValueHistogram.Record((double)amount, tags);

            _logger.LogInformation("Order {OrderId} processed successfully", orderId);
            activity?.SetStatus(ActivityStatusCode.Ok);
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process order {OrderId}", orderId);
            
            var errorTags = new TagList
            {
                { "user_id", userId },
                { "order_status", "error" },
                { "error_type", ex.GetType().Name }
            };
            
            _orderCounter.Add(1, errorTags);
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }
}

/*
========================================
🎯 WHAT'S INCLUDED IN ServiceStack.Alive:
========================================

1. REQUEST/RESPONSE MIDDLEWARE:
   - Automatic correlation ID generation (X-Correlation-Id)
   - Request/response timing and enrichment
   - Error tracking with full context
   - Client IP, User Agent, and authentication tracking
   - Skip health check endpoints automatically

2. OPENTELEMETRY INTEGRATION:
   - Modern OTLP export (Grpc/HttpProtobuf)
   - Distributed tracing with sampling control
   - Comprehensive metrics (runtime, process, HTTP)
   - Custom resource attributes
   - Auto-instrumentation for ASP.NET Core, HTTP, Redis, SQL

3. SERILOG OTLP SINK:
   - Structured logging with trace correlation
   - Asynchronous batching for performance
   - OTLP-compatible log export
   - Configurable log levels and formatting
   - Exception details with stack traces

4. CONFIGURATION:
   - Easy JSON configuration in appsettings.json
   - Feature toggles for all components
   - Environment-specific settings
   - Validation and error handling
   - Hot-reload support

5. PRODUCTION FEATURES:
   - High-performance async operations
   - Efficient batching to reduce overhead
   - Circuit breaker patterns for reliability
   - Minimal memory allocations
   - Comprehensive error handling

========================================
📚 GITHUB & DOCUMENTATION:
========================================

Repository: https://github.com/JasSra/alive
Package: https://www.nuget.org/packages/ServiceStack.Alive
License: MIT

Build & Publish via GitHub Actions:
- Automatic versioning with GitVersion
- Multi-target (.NET 6, 7, 8)
- Symbol packages included
- Published to NuGet.org and GitHub Packages

========================================
🚀 GETTING STARTED:
========================================

1. Install Package:
   dotnet add package ServiceStack.Alive

2. Add Configuration (appsettings.json):
   See configuration example above

3. Update Program.cs:
   builder.Services.AddServiceStackAlive(builder.Configuration);
   app.UseServiceStackAlive();

4. Run and Monitor:
   Your app now has comprehensive telemetry!

========================================
*/`;

  return new NextResponse(csharpCode, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="servicestack-alive-example.cs"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
