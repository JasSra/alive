import { NextResponse } from "next/server";

export async function GET() {
  const js = `// Node OpenTelemetry (HTTP) → Alive OTLP v1 endpoints
// npm i @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-logs-otlp-http @opentelemetry/exporter-metrics-otlp-http @opentelemetry/exporter-trace-otlp-http

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

const baseUrl = process.env.ALIVE_OTLP_BASE || 'http://localhost:3001/api/ingest/otlp/v1';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: baseUrl + '/traces' }),
  logExporter: new OTLPLogExporter({ url: baseUrl + '/logs' }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: baseUrl + '/metrics' }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start().then(() => {
  console.log('OTel SDK started');
}).catch((err) => {
  console.error('OTel SDK start error', err);
});

process.on('SIGTERM', () => {
  sdk.shutdown().then(() => console.log('OTel SDK shut down')).catch(console.error);
});

// Node OpenTelemetry (gRPC) → Alive via OTLP/HTTP-to-gRPC gateways
// Note: Alive exposes HTTP OTLP; if using gRPC, point to a collector or gateway that forwards to Alive.
// Trace exporter example:
// const { OTLPTraceExporter: OTLPTraceExporterGrpc } = require('@opentelemetry/exporter-trace-otlp-grpc');
// new OTLPTraceExporterGrpc({ url: 'http://your-collector:4317' });
`;
  return new NextResponse(js, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
