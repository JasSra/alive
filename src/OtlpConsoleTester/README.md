# OTLP Console Tester

A minimal .NET console app that sends OTLP-shaped logs, metrics, and traces to the Alive ingestion endpoints in a loop. Useful for verifying classification into logs, requests, and events.

## Build & Run

```powershell
dotnet build .\src\OtlpConsoleTester\OtlpConsoleTester.csproj -c Release
dotnet run --project .\src\OtlpConsoleTester\OtlpConsoleTester.csproj -c Release
```

Environment overrides:

- `ALIVE_OTLP_BASE` (default `http://localhost:3001/api/ingest/otlp/v1`)
- `OTEL_SERVICE_NAME` (default `otlp-console-tester`)

## Verify in Alive

- Recent logs: `http://localhost:3001/api/ingest/recent?kind=logs&limit=20`
- Recent requests (from traces): `http://localhost:3001/api/ingest/recent?kind=requests&limit=20`
- Recent events: `http://localhost:3001/api/ingest/recent?kind=events&limit=20`
