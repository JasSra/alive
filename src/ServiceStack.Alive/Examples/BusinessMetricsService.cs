using System.Diagnostics;
using System.Diagnostics.Metrics;
using Microsoft.Extensions.Logging;

namespace ServiceStack.Alive.Examples;

/// <summary>
/// Example service showing how to create custom metrics and traces with ServiceStack.Alive
/// </summary>
public class BusinessMetricsService
{
    private readonly ILogger<BusinessMetricsService> _logger;
    private readonly ActivitySource _activitySource;
    private readonly Meter _meter;
    private readonly Counter<long> _orderCounter;
    private readonly Histogram<double> _orderValueHistogram;
    private readonly Histogram<long> _processingTimeHistogram;

    public BusinessMetricsService(ILogger<BusinessMetricsService> logger)
    {
        _logger = logger;
        _activitySource = new ActivitySource("ServiceStack.Alive.Business");
        _meter = new Meter("ServiceStack.Alive.Business");
        
        // Create business metrics
        _orderCounter = _meter.CreateCounter<long>(
            "orders_total", 
            "count", 
            "Total number of orders processed");
            
        _orderValueHistogram = _meter.CreateHistogram<double>(
            "order_value", 
            "USD", 
            "Order value distribution");
            
        _processingTimeHistogram = _meter.CreateHistogram<long>(
            "order_processing_time", 
            "ms", 
            "Time taken to process orders");
    }

    public async Task<OrderResult> ProcessOrderAsync(OrderRequest request)
    {
        using var activity = _activitySource.StartActivity("order.process");
        activity?.SetTag("order.id", request.OrderId);
        activity?.SetTag("order.amount", request.Amount.ToString());
        activity?.SetTag("order.currency", request.Currency);
        activity?.SetTag("user.id", request.UserId);
        activity?.SetTag("order.type", request.OrderType);

        var stopwatch = Stopwatch.StartNew();

        try
        {
            _logger.LogInformation("Processing order {OrderId} for {Amount:C} by user {UserId}", 
                request.OrderId, request.Amount, request.UserId);

            // Simulate business logic
            await SimulateOrderProcessing(request);

            stopwatch.Stop();

            // Record successful metrics
            var tags = new TagList
            {
                { "user_id", request.UserId },
                { "order_status", "success" },
                { "order_type", request.OrderType },
                { "currency", request.Currency }
            };

            _orderCounter.Add(1, tags);
            _orderValueHistogram.Record((double)request.Amount, tags);
            _processingTimeHistogram.Record(stopwatch.ElapsedMilliseconds, tags);

            _logger.LogInformation("Order {OrderId} processed successfully in {ElapsedMs}ms", 
                request.OrderId, stopwatch.ElapsedMilliseconds);
            
            activity?.SetStatus(ActivityStatusCode.Ok);
            activity?.SetTag("order.result", "success");
            activity?.SetTag("processing.duration_ms", stopwatch.ElapsedMilliseconds.ToString());
            
            return new OrderResult
            {
                OrderId = request.OrderId,
                Success = true,
                ProcessingTimeMs = stopwatch.ElapsedMilliseconds,
                Message = "Order processed successfully"
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            _logger.LogError(ex, "Failed to process order {OrderId} after {ElapsedMs}ms", 
                request.OrderId, stopwatch.ElapsedMilliseconds);
            
            // Record error metrics
            var errorTags = new TagList
            {
                { "user_id", request.UserId },
                { "order_status", "error" },
                { "order_type", request.OrderType },
                { "error_type", ex.GetType().Name }
            };

            _orderCounter.Add(1, errorTags);
            _processingTimeHistogram.Record(stopwatch.ElapsedMilliseconds, errorTags);
            
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.SetTag("order.result", "error");
            activity?.SetTag("error.type", ex.GetType().Name);
            activity?.SetTag("error.message", ex.Message);
            activity?.SetTag("processing.duration_ms", stopwatch.ElapsedMilliseconds.ToString());

            return new OrderResult
            {
                OrderId = request.OrderId,
                Success = false,
                ProcessingTimeMs = stopwatch.ElapsedMilliseconds,
                Message = ex.Message,
                ErrorType = ex.GetType().Name
            };
        }
    }

    private async Task SimulateOrderProcessing(OrderRequest request)
    {
        // Simulate validation
        using var validationActivity = _activitySource.StartActivity("order.validate");
        validationActivity?.SetTag("order.id", request.OrderId);
        
        await Task.Delay(Random.Shared.Next(10, 50));
        
        if (request.Amount <= 0)
            throw new ArgumentException("Order amount must be greater than zero");

        // Simulate payment processing
        using var paymentActivity = _activitySource.StartActivity("order.payment");
        paymentActivity?.SetTag("order.id", request.OrderId);
        paymentActivity?.SetTag("payment.amount", request.Amount.ToString());
        paymentActivity?.SetTag("payment.currency", request.Currency);
        
        await Task.Delay(Random.Shared.Next(100, 300));
        
        // Simulate occasional payment failures
        if (Random.Shared.Next(1, 11) == 1) // 10% failure rate
            throw new InvalidOperationException("Payment processing failed");

        // Simulate inventory check
        using var inventoryActivity = _activitySource.StartActivity("order.inventory");
        inventoryActivity?.SetTag("order.id", request.OrderId);
        
        await Task.Delay(Random.Shared.Next(20, 80));

        // Simulate fulfillment
        using var fulfillmentActivity = _activitySource.StartActivity("order.fulfillment");
        fulfillmentActivity?.SetTag("order.id", request.OrderId);
        
        await Task.Delay(Random.Shared.Next(50, 150));
    }

    public void Dispose()
    {
        _activitySource?.Dispose();
        _meter?.Dispose();
    }
}

/// <summary>
/// Order request model
/// </summary>
public class OrderRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public string OrderType { get; set; } = "standard";
}

/// <summary>
/// Order processing result
/// </summary>
public class OrderResult
{
    public string OrderId { get; set; } = string.Empty;
    public bool Success { get; set; }
    public long ProcessingTimeMs { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ErrorType { get; set; }
}
