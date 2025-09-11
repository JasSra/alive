using Serilog;
using Serilog.Configuration;
using Serilog.Core;
using Serilog.Events;
using Serilog.Formatting;
using System.Text.Json;
using Microsoft.Extensions.Options;
using ServiceStack.Alive.Configuration;
using OpenTelemetry;
using OpenTelemetry.Logs;
using System.Text;

namespace ServiceStack.Alive.Sinks;

/// <summary>
/// Modern Serilog sink that forwards logs to OpenTelemetry OTLP endpoint
/// Provides structured logging with proper correlation and trace context
/// </summary>
public class ServiceStackAliveOtlpSink : ILogEventSink, IDisposable
{
    private readonly IFormatProvider? _formatProvider;
    private readonly TelemetryOptions _options;
    private readonly HttpClient _httpClient;
    private readonly Timer _flushTimer;
    private readonly Queue<LogEvent> _logBuffer = new();
    private readonly object _bufferLock = new();
    private readonly int _batchSize = 100;
    private readonly TimeSpan _flushInterval = TimeSpan.FromSeconds(5);
    private bool _disposed;

    public ServiceStackAliveOtlpSink(TelemetryOptions options, IFormatProvider? formatProvider = null)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _formatProvider = formatProvider;
        
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(_options.Otlp.TimeoutSeconds)
        };

        // Add custom headers if specified
        foreach (var header in _options.Otlp.Headers)
        {
            _httpClient.DefaultRequestHeaders.Add(header.Key, header.Value);
        }

        // Start flush timer
        _flushTimer = new Timer(FlushLogs, null, _flushInterval, _flushInterval);
    }

    public void Emit(LogEvent logEvent)
    {
        if (_disposed || !_options.Features.SerilogOtlpSinkEnabled) return;

        lock (_bufferLock)
        {
            _logBuffer.Enqueue(logEvent);
            
            // Flush if buffer is full
            if (_logBuffer.Count >= _batchSize)
            {
                Task.Run(FlushBufferedLogs);
            }
        }
    }

    private async void FlushLogs(object? state)
    {
        await FlushBufferedLogs();
    }

    private async Task FlushBufferedLogs()
    {
        if (_disposed) return;

        LogEvent[] events;
        lock (_bufferLock)
        {
            if (_logBuffer.Count == 0) return;
            
            events = new LogEvent[_logBuffer.Count];
            for (int i = 0; i < events.Length; i++)
            {
                events[i] = _logBuffer.Dequeue();
            }
        }

        try
        {
            await SendLogsToOtlp(events);
        }
        catch (Exception ex)
        {
            // Log to console as fallback (avoid recursive logging)
            Console.WriteLine($"[ServiceStack.Alive] Failed to send logs to OTLP: {ex.Message}");
        }
    }

    private async Task SendLogsToOtlp(LogEvent[] events)
    {
        var otlpLogs = events.Select(ConvertToOtlpLog).ToArray();
        var json = JsonSerializer.Serialize(new
        {
            resourceLogs = new[]
            {
                new
                {
                    resource = new
                    {
                        attributes = _options.ResourceAttributes.Select(kvp => new
                        {
                            key = kvp.Key,
                            value = new { stringValue = kvp.Value.ToString() }
                        })
                    },
                    scopeLogs = new[]
                    {
                        new
                        {
                            scope = new
                            {
                                name = _options.ServiceName,
                                version = _options.ServiceVersion
                            },
                            logRecords = otlpLogs
                        }
                    }
                }
            }
        }, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        var endpoint = _options.Otlp.Protocol == "Grpc" 
            ? $"{_options.Otlp.Endpoint}/v1/logs"
            : $"{_options.Otlp.Endpoint}/v1/logs";

        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(endpoint, content);
        
        if (!response.IsSuccessStatusCode)
        {
            var responseContent = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"OTLP endpoint returned {response.StatusCode}: {responseContent}");
        }
    }

    private object ConvertToOtlpLog(LogEvent logEvent)
    {
        var attributes = new List<object>();
        
        // Add standard attributes
        attributes.Add(new { key = "level", value = new { stringValue = logEvent.Level.ToString() } });
        attributes.Add(new { key = "logger", value = new { stringValue = "Serilog" } });
        
        // Add exception details if present
        if (logEvent.Exception != null)
        {
            attributes.Add(new { key = "exception.type", value = new { stringValue = logEvent.Exception.GetType().Name } });
            attributes.Add(new { key = "exception.message", value = new { stringValue = logEvent.Exception.Message } });
            attributes.Add(new { key = "exception.stacktrace", value = new { stringValue = logEvent.Exception.StackTrace ?? "" } });
        }

        // Add custom properties
        foreach (var property in logEvent.Properties)
        {
            var value = property.Value.ToString().Trim('"'); // Remove quotes from scalar values
            attributes.Add(new { key = property.Key, value = new { stringValue = value } });
        }

        // Extract trace context if available
        var traceId = System.Diagnostics.Activity.Current?.TraceId.ToString() ?? "";
        var spanId = System.Diagnostics.Activity.Current?.SpanId.ToString() ?? "";

        return new
        {
            timeUnixNano = ((DateTimeOffset)logEvent.Timestamp).ToUnixTimeMilliseconds() * 1_000_000, // Convert to nanoseconds
            severityNumber = GetSeverityNumber(logEvent.Level),
            severityText = logEvent.Level.ToString(),
            body = new { stringValue = logEvent.RenderMessage(_formatProvider) },
            attributes,
            traceId = !string.IsNullOrEmpty(traceId) ? Convert.FromHexString(traceId.PadLeft(32, '0')) : Array.Empty<byte>(),
            spanId = !string.IsNullOrEmpty(spanId) ? Convert.FromHexString(spanId.PadLeft(16, '0')) : Array.Empty<byte>()
        };
    }

    private static int GetSeverityNumber(LogEventLevel level)
    {
        return level switch
        {
            LogEventLevel.Verbose => 1,
            LogEventLevel.Debug => 5,
            LogEventLevel.Information => 9,
            LogEventLevel.Warning => 13,
            LogEventLevel.Error => 17,
            LogEventLevel.Fatal => 21,
            _ => 0
        };
    }

    public void Dispose()
    {
        if (_disposed) return;
        
        _disposed = true;
        _flushTimer?.Dispose();
        
        // Flush remaining logs
        Task.Run(FlushBufferedLogs).Wait(TimeSpan.FromSeconds(5));
        
        _httpClient?.Dispose();
    }
}

/// <summary>
/// Extension methods for configuring the ServiceStack.Alive OTLP sink
/// </summary>
public static class ServiceStackAliveOtlpSinkExtensions
{
    /// <summary>
    /// Adds the ServiceStack.Alive OTLP sink to the Serilog configuration
    /// </summary>
    public static LoggerConfiguration ServiceStackAliveOtlp(
        this LoggerSinkConfiguration sinkConfiguration,
        TelemetryOptions options,
        LogEventLevel restrictedToMinimumLevel = LogEventLevel.Information,
        IFormatProvider? formatProvider = null)
    {
        if (sinkConfiguration == null) throw new ArgumentNullException(nameof(sinkConfiguration));
        if (options == null) throw new ArgumentNullException(nameof(options));

        return sinkConfiguration.Sink(
            new ServiceStackAliveOtlpSink(options, formatProvider),
            restrictedToMinimumLevel);
    }

    /// <summary>
    /// Adds the ServiceStack.Alive OTLP sink using options from configuration
    /// </summary>
    public static LoggerConfiguration ServiceStackAliveOtlp(
        this LoggerSinkConfiguration sinkConfiguration,
        IOptions<TelemetryOptions> options,
        LogEventLevel restrictedToMinimumLevel = LogEventLevel.Information,
        IFormatProvider? formatProvider = null)
    {
        return sinkConfiguration.ServiceStackAliveOtlp(options.Value, restrictedToMinimumLevel, formatProvider);
    }
}
