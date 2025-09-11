using ServiceStack.Alive.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add ServiceStack.Alive telemetry with comprehensive observability
builder.Services.AddServiceStackAlive(builder.Configuration);

// Add your other services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Add ServiceStack.Alive middleware early in the pipeline for request/response tracking
app.UseServiceStackAlive();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();

/*
 * ServiceStack.Alive Features:
 * 
 * ✅ Request/Response Middleware
 *    - Automatic correlation ID generation
 *    - Request/response timing and enrichment
 *    - Error tracking and logging
 * 
 * ✅ OpenTelemetry Integration
 *    - Distributed tracing with OTLP export
 *    - Comprehensive metrics collection
 *    - Resource attribute management
 * 
 * ✅ Serilog OTLP Sink
 *    - Structured logging with trace correlation
 *    - Asynchronous log batching and export
 *    - Configurable log levels and formatting
 * 
 * ✅ Configuration-Driven
 *    - Easy JSON configuration
 *    - Feature toggles for all components
 *    - Environment-specific settings
 * 
 * Configuration: appsettings.json -> "Telemetry" section
 * Package: ServiceStack.Alive 1.0.0
 * 
 */
