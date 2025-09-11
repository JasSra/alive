import { NextResponse } from "next/server";

export async function GET() {
  const endpoints = {
    message: "OpenTelemetry Protocol (OTLP) Ingestion Endpoints",
    version: "1.0.0",
    endpoints: {
      logs: {
        url: "/api/ingest/otlp/logs",
        method: "POST",
        description: "OTLP logs ingestion endpoint",
        expects: "ExportLogsServiceRequest with resourceLogs array",
        contentType: "application/json"
      },
      traces: {
        url: "/api/ingest/otlp/traces", 
        method: "POST",
        description: "OTLP traces ingestion endpoint",
        expects: "ExportTracesServiceRequest with resourceSpans array",
        contentType: "application/json"
      },
      metrics: {
        url: "/api/ingest/otlp/metrics",
        method: "POST", 
        description: "OTLP metrics ingestion endpoint",
        expects: "ExportMetricsServiceRequest with resourceMetrics array",
        contentType: "application/json"
      },
      legacy: {
        url: "/api/ingest/otlp",
        method: "POST",
        description: "Legacy OTLP endpoint (auto-detects payload type)",
        status: "deprecated",
        sunset: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        recommendation: "Use specific endpoints above for better performance"
      }
    },
    examples: {
      curl_logs: 'curl -X POST http://localhost:3001/api/ingest/otlp/logs -H "Content-Type: application/json" -d \'{"resourceLogs":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"my-service"}}]},"scopeLogs":[{"logRecords":[{"timeUnixNano":"1640995200000000000","severityNumber":9,"body":{"stringValue":"Hello OTLP"}}]}]}]}\'',
      curl_traces: 'curl -X POST http://localhost:3001/api/ingest/otlp/traces -H "Content-Type: application/json" -d \'{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"my-service"}}]},"scopeSpans":[{"spans":[{"traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7","name":"test-span","startTimeUnixNano":"1640995200000000000","endTimeUnixNano":"1640995201000000000"}]}]}]}\'',
      curl_metrics: 'curl -X POST http://localhost:3001/api/ingest/otlp/metrics -H "Content-Type: application/json" -d \'{"resourceMetrics":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"my-service"}}]},"scopeMetrics":[{"metrics":[{"name":"http_requests_total","description":"Total HTTP requests","unit":"1","sum":{"dataPoints":[{"timeUnixNano":"1640995200000000000","asInt":"42"}]}}]}]}]}\''
    },
    documentation: {
      otlp_spec: "https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/protocol/otlp.md",
      payload_formats: "https://github.com/open-telemetry/opentelemetry-proto/tree/main/opentelemetry/proto"
    }
  };

  console.log(`[OTLP-INFO] 📚 OTLP endpoints documentation requested`);

  return NextResponse.json(endpoints, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
