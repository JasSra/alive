using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

static class OtlpConsoleTester
{
    private static readonly HttpClient Http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(10)
    };

    private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static string EndpointBase = Environment.GetEnvironmentVariable("ALIVE_OTLP_BASE")
        ?? "http://localhost:3001/api/ingest/otlp/v1";

    private static string ServiceName = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME")
        ?? "otlp-console-tester";

    public static async Task<int> Main(string[] args)
    {
        Console.WriteLine($"[OTLP TEST] Sending to: {EndpointBase}");
        Console.WriteLine($"[OTLP TEST] Service: {ServiceName}");

        // Small warmup burst
        for (int i = 0; i < 3; i++)
        {
            await SendLogsBatch(i);
            await SendMetricsBatch(i);
            await SendTracesBatch(i);
        }

        Console.WriteLine("[OTLP TEST] Entering continuous mode. Press Ctrl+C to stop.");

        var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (s, e) => { e.Cancel = true; cts.Cancel(); };

        var rnd = new Random();
        while (!cts.IsCancellationRequested)
        {
            try
            {
                var k = rnd.Next(0, 3);
                if (k == 0) await SendLogsBatch();
                else if (k == 1) await SendMetricsBatch();
                else await SendTracesBatch();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OTLP TEST] Error: {ex.Message}");
            }
            try
            {
                await Task.Delay(rnd.Next(500, 1500), cts.Token);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }

        Console.WriteLine("[OTLP TEST] Stopped.");
        return 0;
    }

    private static async Task SendLogsBatch(int idx = 0)
    {
        var nowNs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1_000_000L;
        var payload = new
        {
            resourceLogs = new object[]
            {
                new
                {
                    resource = new
                    {
                        attributes = new object[]
                        {
                            new { key = "service.name", value = new { stringValue = ServiceName } },
                            new { key = "deployment.environment", value = new { stringValue = "dev" } }
                        }
                    },
                    scopeLogs = new object[]
                    {
                        new
                        {
                            scope = new { name = ServiceName, version = "1.0.0" },
                            logRecords = new object[]
                            {
                                new {
                                    timeUnixNano = nowNs,
                                    severityNumber = 9,
                                    severityText = "Info",
                                    body = new { stringValue = $"hello from {ServiceName} #{idx}" },
                                    attributes = new object[]
                                    {
                                        new { key = "app", value = new { stringValue = ServiceName } },
                                        new { key = "env", value = new { stringValue = "dev" } },
                                        new { key = "correlation.id", value = new { stringValue = Guid.NewGuid().ToString("N").Substring(0,16) } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        await PostJson($"{EndpointBase}/logs", payload, "logs");
    }

    private static async Task SendMetricsBatch(int idx = 0)
    {
        var nowNs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1_000_000L;
        var cpu = Random.Shared.NextDouble() * 80 + 10; // 10-90
        var requests = Random.Shared.Next(1, 20);

        var payload = new
        {
            resourceMetrics = new object[]
            {
                new
                {
                    resource = new
                    {
                        attributes = new object[]
                        {
                            new { key = "service.name", value = new { stringValue = ServiceName } }
                        }
                    },
                    scopeMetrics = new object[]
                    {
                        new
                        {
                            scope = new { name = ServiceName, version = "1.0.0" },
                            metrics = new object[]
                            {
                                new
                                {
                                    name = "requests_total",
                                    description = "Total requests",
                                    unit = "1",
                                    sum = new {
                                        dataPoints = new object[] { new { timeUnixNano = nowNs, asInt = requests } },
                                        aggregationTemporality = 2,
                                        isMonotonic = true
                                    }
                                },
                                new
                                {
                                    name = "cpu_usage",
                                    description = "% CPU",
                                    unit = "%",
                                    gauge = new {
                                        dataPoints = new object[] { new { timeUnixNano = nowNs, asDouble = cpu } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        await PostJson($"{EndpointBase}/metrics", payload, "metrics");
    }

    private static async Task SendTracesBatch(int idx = 0)
    {
        // Create a parent span with HTTP attributes so Alive classifies it as a request
        var start = DateTimeOffset.UtcNow;
        var durMs = Random.Shared.Next(20, 400);
        var end = start.AddMilliseconds(durMs);
        var traceId = Guid.NewGuid().ToString("N");
        var spanId = Guid.NewGuid().ToString("N").Substring(0, 16);

        long toNs(DateTimeOffset ts) => ts.ToUnixTimeMilliseconds() * 1_000_000L;

        var payload = new
        {
            resourceSpans = new object[]
            {
                new
                {
                    resource = new
                    {
                        attributes = new object[]
                        {
                            new { key = "service.name", value = new { stringValue = ServiceName } }
                        }
                    },
                    scopeSpans = new object[]
                    {
                        new
                        {
                            scope = new { name = ServiceName, version = "1.0.0" },
                            spans = new object[]
                            {
                                new {
                                    traceId,
                                    spanId,
                                    name = "GET /api/test",
                                    startTimeUnixNano = toNs(start),
                                    endTimeUnixNano = toNs(end),
                                    attributes = new object[]
                                    {
                                        new { key = "http.method", value = new { stringValue = "GET" } },
                                        new { key = "http.url", value = new { stringValue = "https://example.test/api/test" } },
                                        new { key = "http.status_code", value = new { intValue = 200 } },
                                        new { key = "response_time_ms", value = new { doubleValue = (double)durMs } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        await PostJson($"{EndpointBase}/traces", payload, "traces");
    }

    private static async Task PostJson(string url, object payload, string label)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var resp = await Http.PostAsync(url, content);
        var ok = (int)resp.StatusCode >= 200 && (int)resp.StatusCode < 300;
        var body = await resp.Content.ReadAsStringAsync();
        Console.WriteLine($"[OTLP TEST] POST {label} {(int)resp.StatusCode} {(ok ? "OK" : "FAIL")} - {body}");
    }
}
