# OTLP Ingestion Endpoints

This directory contains OpenTelemetry Protocol (OTLP) ingestion endpoints that support standard OTLP telemetry data types.

## Available Endpoints

### Standard OTLP Endpoints

- **`/api/ingest/otlp/logs`** - OTLP logs ingestion
- **`/api/ingest/otlp/traces`** - OTLP traces ingestion  
- **`/api/ingest/otlp/metrics`** - OTLP metrics ingestion

### Alternative v1 Endpoints

Some OTLP clients expect v1 prefixed endpoints:

- **`/api/v1/logs`** - Alternative OTLP logs endpoint
- **`/api/v1/traces`** - Alternative OTLP traces endpoint
- **`/api/v1/metrics`** - Alternative OTLP metrics endpoint

### Legacy Endpoint

- **`/api/ingest/otlp`** - Legacy auto-detecting endpoint (deprecated)

### Documentation

- **`/api/ingest/otlp/index`** - Endpoint documentation and examples

## Features

✅ **Standard OTLP Support** - Supports ExportLogsServiceRequest, ExportTracesServiceRequest, and ExportMetricsServiceRequest formats

✅ **Comprehensive Logging** - Detailed console logging for debugging and monitoring ingestion

✅ **CORS Support** - Proper CORS headers for cross-origin requests

✅ **Error Handling** - Robust error handling with meaningful error messages

✅ **Unified Processing** - All endpoints use the same `unifiedIngest` function for consistent processing

✅ **Auto-Classification** - Automatically classifies data into logs, events, requests, or raw data

✅ **Performance Tracking** - Request timing and payload size logging

## Example Usage

### Logs
```bash
curl -X POST http://localhost:3001/api/ingest/otlp/logs \
  -H "Content-Type: application/json" \
  -d '{
    "resourceLogs": [{
      "resource": {
        "attributes": [{"key":"service.name","value":{"stringValue":"my-service"}}]
      },
      "scopeLogs": [{
        "logRecords": [{
          "timeUnixNano": "1640995200000000000",
          "severityNumber": 9,
          "body": {"stringValue": "Hello OTLP"}
        }]
      }]
    }]
  }'
```

### Traces
```bash
curl -X POST http://localhost:3001/api/ingest/otlp/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [{
      "resource": {
        "attributes": [{"key":"service.name","value":{"stringValue":"my-service"}}]
      },
      "scopeSpans": [{
        "spans": [{
          "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
          "spanId": "00f067aa0ba902b7",
          "name": "test-span",
          "startTimeUnixNano": "1640995200000000000",
          "endTimeUnixNano": "1640995201000000000"
        }]
      }]
    }]
  }'
```

### Metrics
```bash
curl -X POST http://localhost:3001/api/ingest/otlp/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "resourceMetrics": [{
      "resource": {
        "attributes": [{"key":"service.name","value":{"stringValue":"my-service"}}]
      },
      "scopeMetrics": [{
        "metrics": [{
          "name": "http_requests_total",
          "description": "Total HTTP requests",
          "unit": "1",
          "sum": {
            "dataPoints": [{
              "timeUnixNano": "1640995200000000000",
              "asInt": "42"
            }]
          }
        }]
      }]
    }]
  }'
```

## Configuration

All endpoints use the same underlying `unifiedIngest` function, which:

1. **Detects payload type** (OTLP, JSON array, single object, text)
2. **Parses OTLP structures** using `transformOtlpLogsToBase`
3. **Classifies data** into requests, logs, events, or raw data
4. **Stores in ring buffers** via `ingestStore`
5. **Publishes events** for real-time streaming

## Console Logging

All endpoints provide detailed console logging with:

- **Request IDs** for tracking individual requests
- **Payload size** information
- **Processing time** measurements
- **Classification results** showing what type of data was detected
- **Storage statistics** showing before/after counts
- **Error details** for failed requests

## Monitoring

Check the endpoints documentation at `/api/ingest/otlp/index` for live status and examples.
