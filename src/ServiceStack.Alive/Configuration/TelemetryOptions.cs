using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace ServiceStack.Alive.Configuration;

/// <summary>
/// Main telemetry configuration options
/// </summary>
public class TelemetryOptions
{
    public const string SectionName = "Telemetry";
    
    public string ServiceName { get; set; } = "ServiceStack.Service";
    public string ServiceVersion { get; set; } = "1.0.0";
    public string Environment { get; set; } = "development";
    
    public OtlpOptions Otlp { get; set; } = new();
    public TelemetryFeaturesOptions Features { get; set; } = new();
    public TracingOptions Tracing { get; set; } = new();
    public MetricsOptions Metrics { get; set; } = new();
    public LoggingOptions Logging { get; set; } = new();
    public Dictionary<string, object> ResourceAttributes { get; set; } = new();
}

/// <summary>
/// OpenTelemetry Protocol (OTLP) configuration
/// </summary>
public class OtlpOptions
{
    public string Endpoint { get; set; } = "http://localhost:4317";
    public string Protocol { get; set; } = "Grpc"; // "Grpc" or "HttpProtobuf"
    public Dictionary<string, string> Headers { get; set; } = new();
    public int TimeoutSeconds { get; set; } = 10;
}

/// <summary>
/// Feature toggles for telemetry components
/// </summary>
public class TelemetryFeaturesOptions
{
    public bool TracingEnabled { get; set; } = true;
    public bool MetricsEnabled { get; set; } = true;
    public bool LoggingEnabled { get; set; } = true;
    public bool SerilogOtlpSinkEnabled { get; set; } = false;
}

/// <summary>
/// Tracing configuration options
/// </summary>
public class TracingOptions
{
    public double SamplingRatio { get; set; } = 1.0;
    public int MaxTagLength { get; set; } = 1024;
    public int MaxEventCount { get; set; } = 128;
    public int MaxLinkCount { get; set; } = 128;
    public bool EnableHttpInstrumentation { get; set; } = true;
    public bool EnableAspNetCoreInstrumentation { get; set; } = true;
    public bool EnableRedisInstrumentation { get; set; } = true;
    public bool EnableSqlClientInstrumentation { get; set; } = false;
}

/// <summary>
/// Metrics configuration options
/// </summary>
public class MetricsOptions
{
    public int ExportIntervalSeconds { get; set; } = 30;
    public bool EnableRuntimeInstrumentation { get; set; } = true;
    public bool EnableProcessInstrumentation { get; set; } = true;
    public bool EnableAspNetCoreInstrumentation { get; set; } = true;
    public bool EnableHttpClientInstrumentation { get; set; } = true;
    public List<string> CustomMeters { get; set; } = new() { "ServiceStack.*", "Consolidated.*" };
}

/// <summary>
/// Logging configuration options
/// </summary>
public class LoggingOptions
{
    public bool IncludeScopes { get; set; } = true;
    public bool ParseStateValues { get; set; } = true;
    public bool IncludeFormattedMessage { get; set; } = true;
    public Dictionary<string, string> LogLevel { get; set; } = new()
    {
        ["Default"] = "Information",
        ["Microsoft.AspNetCore"] = "Warning",
        ["System"] = "Warning"
    };
}

/// <summary>
/// Configuration validator for TelemetryOptions
/// </summary>
public class TelemetryOptionsValidator : IValidateOptions<TelemetryOptions>
{
    public ValidateOptionsResult Validate(string? name, TelemetryOptions options)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(options.ServiceName))
            errors.Add("ServiceName is required");

        if (string.IsNullOrWhiteSpace(options.ServiceVersion))
            errors.Add("ServiceVersion is required");

        if (string.IsNullOrWhiteSpace(options.Otlp.Endpoint))
            errors.Add("Otlp.Endpoint is required");

        if (!Uri.TryCreate(options.Otlp.Endpoint, UriKind.Absolute, out _))
            errors.Add("Otlp.Endpoint must be a valid URI");

        if (options.Otlp.Protocol != "Grpc" && options.Otlp.Protocol != "HttpProtobuf")
            errors.Add("Otlp.Protocol must be either 'Grpc' or 'HttpProtobuf'");

        if (options.Tracing.SamplingRatio < 0 || options.Tracing.SamplingRatio > 1)
            errors.Add("Tracing.SamplingRatio must be between 0 and 1");

        if (options.Metrics.ExportIntervalSeconds <= 0)
            errors.Add("Metrics.ExportIntervalSeconds must be greater than 0");

        if (options.Otlp.TimeoutSeconds <= 0)
            errors.Add("Otlp.TimeoutSeconds must be greater than 0");

        return errors.Count > 0 
            ? ValidateOptionsResult.Fail(errors)
            : ValidateOptionsResult.Success;
    }
}
