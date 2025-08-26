# Alive: Live Event Tracker for Next.js

A Next.js (App Router) TypeScript app that ingests events and provides a real-time dashboard with Server-Sent Events (SSE) and WebSockets, analytics, correlation, and a clean Tailwind UI.

## Features

- API routes mirroring your C# sample: track single/batch, suggestions, analytics, history, cleanup, health, statistics, unique, counts, total
- Live SSE stream at `/api/events/stream` and WebSocket at `/api/events/ws`
- In-memory store for quick local debugging (not for production)
- Responsive, accessible dashboard (Tailwind + Headless UI) with dark mode
- Strict TypeScript, ESLint, and cleanup

## Quick start

1. Install deps
2. Run dev server

```bash
npm install
npm run dev
```

Visit <http://localhost:3000> to see the live dashboard.

## Live vs manual walkthrough

- Live mode
  - Toggle Live On in the header and choose a transport (SSE recommended for compatibility; WS available on Edge runtime).
  - The status badge shows connecting/open/error.
  - The left-to-right timeline paints incoming events (green=2xx, red=4xx/5xx).

- Manual range fetch
  - Use the range selector (e.g., 1h/24h/7d) and click “Fetch range” to load existing events.
  - The timeline will render historical points for that window.

## Correlation and filters

- The “Correlated requests/responses” table groups pairs by correlationId.
- Columns: request time, response time, status, latency.
- Filters: by event name, status class (2xx/4xx/5xx/pending), correlationId substring.

## Charts (JSON-configurable)

- Edit the JSON config on the page to render charts.
- Included examples:
  - Events per day (line)
  - Top events (bar)
  - Latency histogram (bar)
  - Error rate (%) over time (line)
  - You can extend with additional series as needed.

## Seeding demo data

Use the included script to emit realistic request/response pairs with correlationId and latency:

```bash
# Port may vary; ensure it matches your running server
SERVER=http://localhost:3000 node scripts/seed.js 20
```

The script posts a request event (statusCode:0) then a response event (statusCode:200/4xx/5xx) sharing the same correlationId. This drives the correlation table and the color-coded timeline.

## Troubleshooting

- I don’t see live events
  - Confirm the server port (try curl <http://localhost:3000/api/events/health>).
  - Run the seeder against the correct port.
  - Set Live=On and choose SSE transport.
  - If WebSocket shows error, switch to SSE; some environments block WS upgrades.

- Hydration error about time mismatch
  - We format times deterministically (UTC) in sensitive places like the timeline; if you add local formatting, mirror that on server.

- Data missing after restart
  - The store is in-memory for development; restart clears data.

## Ingest events

Single event:

```bash
curl -X POST http://localhost:3000/api/events/track/user-login \
  -H 'content-type: application/json' \
  -H 'x-user-id: u123' \
  -d '{"userAgent":"curl","metadata":{"ip":"127.0.0.1"}}'
```

Batch:

```bash
curl -X POST http://localhost:3000/api/events/track/batch \
  -H 'content-type: application/json' \
  -H 'x-user-id: u123' \
  -d '{"events":[{"eventName":"view-home"},{"eventName":"click-cta"}]}'
```

## Endpoints

- POST `/api/events/track/[eventName]`
- POST `/api/events/track/batch`
- POST `/api/events/suggestions`
- GET `/api/events/analytics?from=ISO&to=ISO&eventPattern=&userScope=current|all`
- GET `/api/events/history?from=&to=&limit=` (requires `x-user-id` header)
- POST `/api/events/cleanup?retentionDays=` (requires `x-user-roles` containing `admin`)
- GET `/api/events/health`
- GET `/api/events/statistics?from=ISO&to=ISO&userScope=current|all`
- GET `/api/events/events/unique?from=ISO&to=ISO&userScope=current|all`
- GET `/api/events/events/counts?from=ISO&to=ISO&userScope=current|all&orderBy=most|least&limit=50`
- GET `/api/events/events/total?from=ISO&to=ISO&userScope=current|all&eventPattern=`
- GET `/api/events/stream` (SSE)
- GET `/api/events/ws` (WebSocket)

## Notes

- This app uses an in-memory store; data resets on restart.
- For production, replace the store with a durable database and auth middleware.

## License

MIT
