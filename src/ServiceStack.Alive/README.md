# ServiceStack.Alive

Modern OpenTelemetry integration with middleware, Serilog sink, and OTLP helpers for .NET applications. Provides comprehensive observability with request/response tracking, structured logging, and distributed tracing.

## Features

- 🚀 **Modern OpenTelemetry Integration** - Latest OTLP standards with full instrumentation
- 🔍 **Request/Response Middleware** - Automatic tracking with correlation IDs and enriched telemetry
- 📝 **Serilog OTLP Sink** - Structured logging with OpenTelemetry integration
- ⚡ **High Performance** - Minimal overhead with efficient batching and async operations
- 🛠️ **Easy Configuration** - Simple JSON configuration with validation
- 🎯 **Production Ready** - Battle-tested patterns with proper error handling

## Quick Start

### 1. Install Package

```bash
dotnet add package ServiceStack.Alive
```

### 2. Configuration

Add to your `appsettings.json`:

```json
{
  "Telemetry": {
    "ServiceName": "MyService",
    "ServiceVersion": "1.0.0",
    "Environment": "production",
    
    "Otlp": {
      "Endpoint": "http://localhost:4317",
      "Protocol": "Grpc",
      "Headers": {},
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
      "EnableRedisInstrumentation": true,
      "EnableSqlClientInstrumentation": false
    },
    
    "Metrics": {
      "ExportIntervalSeconds": 30,
      "EnableRuntimeInstrumentation": true,
      "EnableProcessInstrumentation": true,
      "EnableAspNetCoreInstrumentation": true,
      "EnableHttpClientInstrumentation": true,
      "CustomMeters": ["MyService.*"]
    },
    
    "ResourceAttributes": {
      "service.namespace": "mycompany",
      "service.instance.id": "prod-001",
      "deployment.environment": "production"
    }
  }
}
```

### 3. Setup in Program.cs

```csharp
using ServiceStack.Alive.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add ServiceStack.Alive telemetry
builder.Services.AddServiceStackAlive(builder.Configuration);

// Add your other services
builder.Services.AddControllers();

var app = builder.Build();

// Add ServiceStack.Alive middleware (early in pipeline)
app.UseServiceStackAlive();

// Configure your pipeline
app.UseRouting();
app.MapControllers();

app.Run();
```

## Advanced Usage

### Custom Business Metrics

```csharp
public class OrderService
{
    private readonly ActivitySource _activitySource;
    private readonly Meter _meter;
    private readonly Counter<long> _orderCounter;
    private readonly Histogram<double> _orderValueHistogram;

    public OrderService()
    {
        _activitySource = new ActivitySource("MyService.Orders");
        _meter = new Meter("MyService.Orders");
        
        _orderCounter = _meter.CreateCounter<long>("orders_total");
        _orderValueHistogram = _meter.CreateHistogram<double>("order_value");
    }

    public async Task<bool> ProcessOrderAsync(int orderId, decimal amount)
    {
        using var activity = _activitySource.StartActivity("order.process");
        activity?.SetTag("order.id", orderId);
        activity?.SetTag("order.amount", amount);

        try
        {
            // Your business logic here
            await Task.Delay(100);

            // Record metrics
            _orderCounter.Add(1, new TagList { ["status"] = "success" });
            _orderValueHistogram.Record((double)amount);

            return true;
        }
        catch (Exception ex)
        {
            _orderCounter.Add(1, new TagList { ["status"] = "error" });
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }
}
```

### Custom Serilog Configuration

```csharp
using ServiceStack.Alive.Sinks;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.ServiceStackAliveOtlp(telemetryOptions)
    .WriteTo.Console()
    .CreateLogger();
```

## Configuration Reference

### TelemetryOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `ServiceName` | string | "ServiceStack.Service" | Name of your service |
| `ServiceVersion` | string | "1.0.0" | Version of your service |
| `Environment` | string | "development" | Deployment environment |

### OtlpOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `Endpoint` | string | "http://localhost:4317" | OTLP endpoint URL |
| `Protocol` | string | "Grpc" | Protocol: "Grpc" or "HttpProtobuf" |
| `Headers` | Dictionary | {} | Custom headers for OTLP requests |
| `TimeoutSeconds` | int | 10 | Request timeout in seconds |

### Features

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `TracingEnabled` | bool | true | Enable distributed tracing |
| `MetricsEnabled` | bool | true | Enable metrics collection |
| `LoggingEnabled` | bool | true | Enable structured logging |
| `SerilogOtlpSinkEnabled` | bool | false | Enable Serilog OTLP sink |

## Monitoring Endpoints

The middleware automatically enriches requests with:

- **Correlation IDs** - Unique request identifiers
- **Trace Context** - OpenTelemetry trace and span IDs  
- **Request Metrics** - Duration, status codes, response sizes
- **Error Tracking** - Exception details and stack traces
- **User Context** - Authentication status and user IDs

## Performance

ServiceStack.Alive is designed for production use with:

- **Asynchronous Operations** - Non-blocking telemetry export
- **Efficient Batching** - Reduced network overhead
- **Minimal Allocations** - Optimized for low GC pressure
- **Circuit Breaker** - Automatic fallback on endpoint failures

## Requirements

- .NET 6.0 or higher
- ASP.NET Core 6.0 or higher

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to the main repository.
