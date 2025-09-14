using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ServiceStack.Alive.Extensions;
using System.Diagnostics;
using System.Diagnostics.Metrics;

var builder = WebApplication.CreateBuilder(args);

// Load configuration (appsettings.json + environment overrides)
builder.Configuration.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
                     .AddEnvironmentVariables();

// Wire up ServiceStack.Alive (OpenTelemetry + Middleware + Serilog sink)
builder.Services.AddServiceStackAlive(builder.Configuration);

var app = builder.Build();

// Use the request/response middleware early for correlation and request metrics
app.UseServiceStackAlive();

app.MapGet("/health", () => Results.Ok(new { ok = true, ts = DateTimeOffset.UtcNow }))
   .WithName("Health");

// Simple demo endpoint which produces spans, logs and metrics
var activitySource = new ActivitySource("AliveTelemetryRig");
var meter = new Meter("AliveTelemetryRig");
var requestCounter = meter.CreateCounter<long>("rig_requests_total");
var latencyHistogram = meter.CreateHistogram<double>("rig_request_latency_ms");
var valueGauge = meter.CreateObservableGauge("rig_value_gauge", () => new Measurement<double>(Random.Shared.NextDouble() * 100));

app.MapGet("/demo", async (ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Demo");

    using var activity = activitySource.StartActivity("demo.operation", ActivityKind.Server);
    activity?.SetTag("component", "AliveTelemetryRig");

    var sw = Stopwatch.StartNew();
    logger.LogInformation("Starting demo operation");

    // Simulate some work and an outgoing dependency
    await Task.Delay(Random.Shared.Next(50, 250));

    using (var child = activitySource.StartActivity("dependency.call", ActivityKind.Client))
    {
        child?.SetTag("http.method", "GET");
        child?.SetTag("http.url", "https://example.org/dependency");
        await Task.Delay(Random.Shared.Next(10, 80));
        child?.SetTag("http.status_code", 200);
    }

    sw.Stop();
    var ms = sw.Elapsed.TotalMilliseconds;
    var tags = new TagList { { "route", "/demo" } };
    requestCounter.Add(1, tags);
    latencyHistogram.Record(ms, tags);

    logger.LogInformation("Completed demo operation in {ElapsedMs} ms", ms);
    activity?.SetTag("http.status_code", 200);

    return Results.Ok(new { ok = true, elapsedMs = ms });
});

// Background generator: periodically emits logs, metrics, and spans
var generatorCts = new CancellationTokenSource();
var generatorTask = Task.Run(async () =>
{
    var genLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Generator");
    var genCounter = meter.CreateCounter<long>("rig_generated_events_total");
    while (!generatorCts.IsCancellationRequested)
    {
        try
        {
            using var act = activitySource.StartActivity("generator.loop", ActivityKind.Internal);
            var dur = Random.Shared.Next(20, 120);
            await Task.Delay(dur, generatorCts.Token);
            genCounter.Add(1);
            latencyHistogram.Record(dur);
            genLogger.LogInformation("Generator tick after {Dur} ms", dur);
        }
        catch (TaskCanceledException)
        {
            break;
        }
        catch (Exception ex)
        {
            genLogger.LogError(ex, "Generator error");
        }
    }
});

app.Lifetime.ApplicationStopping.Register(() => generatorCts.Cancel());

app.Run();
