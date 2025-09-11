# Alive: Comprehensive Observability Platform

A modern full-stack observability platform built with Next.js 15, TypeScript, and OpenTelemetry (OTLP) standards. Features real-time event streaming, telemetry ingestion, request/response correlation, and comprehensive monitoring capabilities with both frontend dashboard and .NET integration.

## 🚀 Key Features

### Frontend Dashboard

- **Real-time Event Streaming** - Server-Sent Events (SSE) and WebSocket support
- **Multi-Protocol Ingestion** - OTLP, Syslog, JSON, and custom formats
- **Request/Response Correlation** - Automatic correlation ID tracking and timeline visualization
- **Interactive Analytics** - Live charts with Plotly.js and Chart.js
- **Responsive UI** - Modern Tailwind CSS with dark mode and FontAwesome icons
- **Live Service Monitoring** - Browser monitoring script with automatic telemetry

### Backend & Integration

- **ServiceStack.Alive NuGet Package** - Production-ready .NET OTLP middleware
- **Unified Ingestion Pipeline** - Handles multiple telemetry formats with intelligent parsing
- **Time-bucketed Analytics** - Efficient time-series data aggregation
- **Memory-based Storage** - Fast in-memory store with snapshot capabilities (development mode)
- **AI-Ready APIs** - Comprehensive endpoints designed for AI/ML consumption

## Quick Start

### Option 1: Local Development

1. **Install dependencies**
2. **Run development server**

```bash
npm install
npm run dev
```

### Option 2: Docker (Recommended)

```bash
# Quick start (builds and runs everything)
./docker-start.sh

# Or on Windows
.\docker-start.ps1

# Manual Docker commands
docker build -t jassra/alive:latest .
docker run -d --name alive-container -p 3001:3001 jassra/alive:latest

# Using Docker Compose
docker-compose up -d
```

### Option 3: Pre-built Docker Image

```bash
# Pull and run the latest image from Docker Hub
docker run -d --name alive-container -p 3001:3001 jassra/alive:latest
```

Visit <http://localhost:3001> to see the live dashboard.

## 📊 Dashboard Pages

- **Dashboard (/)** - Overview with navigation to all monitoring sections
- **Requests (/requests)** - HTTP request tracking with correlation timelines
- **Responses (/responses)** - Response analysis and status code monitoring  
- **Events (/events)** - Live event stream with real-time table and timeline
- **Logs (/logs)** - Raw log inspection and filtering capabilities

## 🔄 Real-time Streaming

### Live Mode

- Toggle **Live On** in the header and choose transport (SSE recommended for compatibility; WebSocket available)
- Status badge shows connecting/open/error states
- Left-to-right timeline paints incoming events (green=2xx, red=4xx/5xx)

### Manual Range Fetch

- Use range selector (1h/24h/7d) and click "Fetch range" to load historical events
- Timeline renders historical points for selected time window

## 🔗 Correlation and Filtering

- **Correlated Requests/Responses** table groups pairs by correlationId
- Columns: request time, response time, status, latency
- Filters: event name, status class (2xx/4xx/5xx/pending), correlationId substring

## 📈 Analytics & Charts

Interactive JSON-configurable charts powered by Plotly.js and Chart.js:

- **Events per day** (line chart)
- **Top events** (bar chart)  
- **Latency histogram** (bar chart)
- **Error rate %** over time (line chart)
- **Service performance** metrics
- **Time-bucketed aggregations** with customizable step intervals

Edit the JSON configuration on analytics pages to customize chart rendering.

## 🗄️ Data Generation & Seeding

### Comprehensive Data Generator

The included `comprehensive-data-generator.js` script generates realistic telemetry data in multiple formats:

```bash
# Run once with default settings
node scripts/comprehensive-data-generator.js

# Run continuously with custom settings
node scripts/comprehensive-data-generator.js --continuous --port 3001 --interval 2000 --batch-size 10

# Available options:
# --port 3001          # Custom port
# --interval 2000      # Milliseconds between batches
# --batch-size 10      # Items per batch
# --continuous         # Run continuously
# --quiet             # Reduce logging
```

**Generates:**

- OTLP (OpenTelemetry) logs, traces, and metrics
- Syslog format messages
- HTTP requests and responses with correlation IDs
- Custom business events
- Raw telemetry data (IoT sensors, business metrics)

## 🧩 Browser Monitoring

The platform includes a lightweight JavaScript monitoring script that automatically tracks browser events:

```html
<!-- Include the monitoring script -->
<script src="http://localhost:3001/api/monitor.js" 
        data-service="my-web-app" 
        data-flush-ms="3000" 
        data-max-batch="50"></script>
```

**Automatically captures:**

- Console logs (info, warn, error)
- Unhandled promise rejections
- Fetch/API call metrics with timing
- Browser errors and exceptions

## 💻 .NET Integration

### ServiceStack.Alive NuGet Package

Production-ready .NET middleware for OpenTelemetry integration:

```bash
dotnet add package ServiceStack.Alive
```

**Features:**

- Request/response middleware with correlation IDs
- Structured logging with Serilog OTLP sink
- Comprehensive OpenTelemetry instrumentation
- High-performance async operations
- Battle-tested error handling patterns

See `/api/csharp-telemetry` endpoint for complete integration examples.

## 🔧 Troubleshooting

**Live Events Not Appearing**

- Confirm server is running on correct port: `curl http://localhost:3001/api/ingest`
- Toggle **Live On** in header and choose SSE transport
- Run data generator: `node scripts/comprehensive-data-generator.js --continuous --port 3001`
- Check browser console for connection errors

**WebSocket Connection Issues**

- Switch to SSE transport (more compatible)
- Some environments/proxies block WebSocket upgrades
- Check network tab for connection attempts

**Data Missing After Restart**

- The store is in-memory for development; restart clears all data
- For production, implement persistent storage in `src/lib/store.ts`

**Hydration Errors**

- Time formatting is UTC for consistency
- Check for client/server time format mismatches

## 📡 API Endpoints & Data Ingestion

### Unified Ingestion

**POST** `/api/ingest` - Multi-format telemetry ingestion

```bash
# OTLP format
curl -X POST http://localhost:3001/api/ingest \
  -H 'content-type: application/json' \
  -d '{"resourceLogs":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"my-service"}}]},"scopeLogs":[{"logRecords":[{"timeUnixNano":"1640995200000000000","body":{"stringValue":"Hello World"}}]}]}]}'

# Syslog format  
curl -X POST http://localhost:3001/api/ingest/syslog \
  -H 'content-type: text/plain' \
  -d '<134>Dec 31 12:00:00 myhost myapp: Sample log message'

# Raw JSON
curl -X POST http://localhost:3001/api/ingest \
  -H 'content-type: application/json' \
  -d '{"message": "Custom event", "level": "info", "service": "web-app"}'
```

### Real-time Streaming

- **GET** `/api/events/stream` - Server-Sent Events (SSE)
- **WS** `/api/events/ws` - WebSocket connection

### Analytics & Queries

- **GET** `/api/events/range?from=ISO&to=ISO&limit=1000` - Time range data
- **GET** `/api/events/buckets?from=ISO&to=ISO&stepMinutes=5` - Time-bucketed aggregations
- **GET** `/api/events/services?from=ISO&to=ISO` - Service-based analytics
- **GET** `/api/ingest` - Health check with storage statistics

### Browser Monitoring

- **GET** `/api/monitor.js` - Lightweight browser monitoring script
- **POST** `/api/events` - Browser event ingestion endpoint

### .NET Integration

- **GET** `/api/csharp-telemetry` - Complete ServiceStack.Alive integration examples

## 🚀 Technology Stack

**Frontend:**

- Next.js 15 with App Router and Turbopack
- TypeScript with strict mode
- Tailwind CSS 4 for styling
- Plotly.js and Chart.js for analytics
- FontAwesome icons and Headless UI components

**Backend:**

- Node.js runtime with Edge runtime support
- OpenTelemetry Protocol (OTLP) standard
- Server-Sent Events and WebSocket streaming
- In-memory storage with snapshot capabilities

**Integration:**

- ServiceStack.Alive NuGet package for .NET
- Browser monitoring with automatic instrumentation
- Multi-format ingestion (OTLP, Syslog, JSON)

## 🐳 Docker Deployment

### Quick Start Scripts

**Linux/macOS:**
```bash
chmod +x docker-start.sh
./docker-start.sh
```

**Windows PowerShell:**
```powershell
.\docker-start.ps1
```

### Manual Docker Commands

**Build locally:**
```bash
docker build -t jassra/alive:latest .
docker run -d --name alive-container -p 3001:3001 jassra/alive:latest
```

**Use pre-built image:**
```bash
docker pull jassra/alive:latest
docker run -d --name alive-container -p 3001:3001 jassra/alive:latest
```

### Docker Compose

**Basic setup:**
```bash
docker-compose up -d
```

**With nginx reverse proxy:**
```bash
docker-compose --profile proxy up -d
```

### Container Management

```bash
# View logs
docker logs -f alive-container

# Access container shell
docker exec -it alive-container sh

# Generate test data
docker exec alive-container node scripts/comprehensive-data-generator.js --continuous

# Stop and remove
docker stop alive-container
docker rm alive-container
```

### Health Checks

The Docker image includes health checks that monitor:
- API endpoint availability (`/api/ingest`)
- Container resource usage
- Application startup status

## 🏗️ Architecture & Patterns

- **Unified Ingestion Pipeline** - Handles multiple telemetry formats with intelligent parsing
- **Real-time Event Streaming** - SSE and WebSocket support for live updates
- **Correlation-based Analytics** - Request/response correlation with automatic ID generation
- **Time-bucketed Storage** - Efficient time-series aggregation and querying
- **Production-ready Patterns** - Error handling, batching, and performance optimization

## 📋 Development Notes

- Uses in-memory storage for development; implement persistent storage for production
- Default port is **3001** (configurable via npm scripts)
- TypeScript strict mode with comprehensive ESLint configuration
- AI-ready APIs designed for ML/AI consumption and analysis

## 📄 License

MIT

## 📚 Additional Resources

- [ServiceStack.Alive on GitHub](https://github.com/JasSra/alive)
- [OpenTelemetry Documentation](https://opentelemetry.io/)
- [AI Consumption Guide](./AI_CONSUMPTION_GUIDE.md)
