# Alive Observability Platform
Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Build (Frontend)
- Install Node.js dependencies: `npm install` -- takes ~15 seconds
- Build for production: `npm run build` -- takes ~35 seconds with Turbopack. NEVER CANCEL. Set timeout to 60+ minutes.
- Run development server: `npm run dev` -- starts in ~1.3 seconds on port 3001
- Run production server: use standalone mode: `node .next/standalone/server.js` -- starts in ~170ms on port 3000
- **CRITICAL**: The `npm start` command has issues. Always use the standalone server: `node .next/standalone/server.js`

### Build and Test (.NET Components)  
- Restore dependencies: `dotnet restore alive.sln` -- takes ~11 seconds
- Build solution: `dotnet build alive.sln --configuration Release --no-restore` -- takes ~11 seconds. NEVER CANCEL. Set timeout to 30+ minutes.
- Creates ServiceStack.Alive NuGet package automatically in `/src/ServiceStack.Alive/bin/Release/`

### Docker Deployment
- Build Docker image: `docker build -t jassra/alive:latest .` -- takes ~85 seconds. NEVER CANCEL. Set timeout to 120+ minutes.
- Run container: `docker run -d --name alive-container -p 3001:3001 jassra/alive:latest`
- Quick start script: `./docker-start.sh` (Linux/macOS) or `.\docker-start.ps1` (Windows)
- Health check: `curl http://localhost:3001/api/ingest`

### Linting and Formatting
- **CRITICAL**: `npm run format` FAILS -- Prettier is not installed as a dependency
- Linting: `npm run lint` -- takes ~3 seconds but will fail on TypeScript errors
- Lint fix: `npm run lint:fix` -- takes ~3 seconds, uses `|| true` to prevent build failures
- Always run `npm run lint:fix` before committing (won't fail builds)

## Validation Scenarios

### Complete End-to-End Testing
Always run these scenarios after making changes:

1. **Basic Application Flow**:
   ```bash
   npm install
   npm run build
   node .next/standalone/server.js &
   sleep 5
   curl http://localhost:3000/
   pkill -f "server.js"
   ```

2. **Data Generation and Monitoring**:
   ```bash
   npm run dev &
   sleep 5
   node scripts/comprehensive-data-generator.js --port 3001
   curl http://localhost:3001/api/ingest
   curl http://localhost:3001/api/events/range?limit=5
   pkill -f "next dev"
   ```

3. **Real-time Features**:
   - Test Server-Sent Events: `curl http://localhost:3001/api/events/stream`
   - Test WebSocket upgrade: `curl -I http://localhost:3001/api/events/ws`
   - Test browser monitoring: `curl http://localhost:3001/api/monitor.js`

4. **.NET Integration**:
   ```bash
   dotnet restore alive.sln
   dotnet build alive.sln --configuration Release --no-restore
   # Verify NuGet package created in src/ServiceStack.Alive/bin/Release/
   ```

## Critical Timing and Timeout Values

### Frontend Operations
- `npm install`: 15 seconds (timeout: 60 seconds)
- `npm run build`: 35 seconds (timeout: 60+ minutes) -- NEVER CANCEL
- `npm run dev`: 1.3 seconds startup (timeout: 30 seconds)
- `npm run lint`: 3 seconds (timeout: 30 seconds)
- Production server startup: 170ms (timeout: 10 seconds)

### Backend Operations  
- `dotnet restore`: 11 seconds (timeout: 30 minutes)
- `dotnet build`: 11 seconds (timeout: 30+ minutes) -- NEVER CANCEL
- Docker build: 85 seconds (timeout: 120+ minutes) -- NEVER CANCEL

### Never Cancel Commands
- **NEVER CANCEL** `npm run build` -- can take up to 35 seconds normally, may take longer on slower systems
- **NEVER CANCEL** `dotnet build` -- can take up to 15 seconds normally  
- **NEVER CANCEL** Docker build operations -- can take 2+ minutes

## Technology Stack

### Frontend
- **Next.js 15** with App Router and Turbopack  
- **TypeScript** with strict mode
- **Tailwind CSS 4** for styling
- **React 19** with Server Components
- **OpenTelemetry Protocol (OTLP)** for telemetry ingestion
- **Plotly.js and Chart.js** for real-time analytics
- **FontAwesome icons** and **Headless UI** components

### Backend Integration
- **Node.js 20** runtime with Edge runtime support
- **ServiceStack.Alive** (.NET 6/7/8) NuGet package for .NET integration
- **WebSocket and Server-Sent Events** for real-time streaming
- **In-memory storage** for development (implement persistent storage for production)

### Container Platform
- **Docker** with multi-stage builds
- **Alpine Linux** base for security and size
- **Nginx** reverse proxy support via docker-compose profiles

## Key Project Structure

### Repository Root
```
├── README.md                    # Comprehensive documentation
├── package.json                 # npm scripts and dependencies
├── next.config.ts               # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── eslint.config.mjs           # ESLint configuration
├── alive.sln                   # .NET solution file
├── Dockerfile                  # Container configuration
├── docker-compose.yml          # Multi-container setup
├── docker-start.sh/.ps1       # Quick start scripts
└── .github/workflows/          # CI/CD pipelines
```

### Source Structure
```
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React components  
│   ├── lib/                    # Utility libraries and data store
│   ├── hooks/                  # React hooks
│   ├── types/                  # TypeScript definitions
│   ├── ServiceStack.Alive/     # .NET NuGet package source
│   ├── OtlpConsoleTester/      # .NET test console application
│   └── AliveTelemetryRig/      # .NET telemetry testing rig
└── scripts/
    └── comprehensive-data-generator.js  # Test data generation
```

## Common Tasks

### Development Workflow
1. Install dependencies: `npm install`
2. Start dev server: `npm run dev` (http://localhost:3001)
3. Generate test data: `node scripts/comprehensive-data-generator.js --continuous --port 3001`
4. Lint code: `npm run lint:fix`
5. Build for production: `npm run build`

### Data Generation Options
```bash
# Single batch
node scripts/comprehensive-data-generator.js --port 3001

# Continuous generation  
node scripts/comprehensive-data-generator.js --continuous --port 3001 --interval 2000

# Custom batch size
node scripts/comprehensive-data-generator.js --continuous --batch-size 15 --interval 1000
```

### API Endpoints Reference
- **Health check**: `GET /api/ingest` -- returns storage statistics
- **OTLP ingestion**: `POST /api/ingest` -- multi-format telemetry ingestion
- **Syslog ingestion**: `POST /api/ingest/syslog` -- syslog format messages
- **Events stream**: `GET /api/events/stream` -- Server-Sent Events
- **WebSocket**: `WS /api/events/ws` -- WebSocket connection
- **Browser monitoring**: `GET /api/monitor.js` -- lightweight monitoring script
- **Analytics**: `GET /api/events/range?from=ISO&to=ISO&limit=N` -- time range queries

### Application Pages
- **Dashboard**: `/` -- main overview with navigation
- **Events**: `/events` -- live event stream with real-time timeline
- **Requests**: `/requests` -- HTTP request tracking with correlation
- **Responses**: `/responses` -- response analysis and monitoring
- **Metrics**: `/metrics` -- analytics with interactive charts

## Troubleshooting

### Common Issues
- **Prettier not found**: The `npm run format` command fails because Prettier is not in package.json dependencies
- **Production server error**: Use `node .next/standalone/server.js` instead of `npm start`
- **ESLint errors**: Run `npm run lint:fix` which has `|| true` to prevent build failures
- **Docker permissions**: Ensure Docker is running before build operations
- **Port conflicts**: Dev server runs on 3001, production on 3000, Docker maps to 3001

### Performance Notes  
- **Development mode**: In-memory storage, data clears on restart
- **Build optimization**: Turbopack provides faster builds than traditional webpack
- **Container efficiency**: Multi-stage Docker build optimizes image size
- **Real-time features**: SSE recommended over WebSocket for broader compatibility

### CI/CD Integration
- **GitHub Actions**: Automated .NET package building and publishing
- **Docker Hub**: Automated image building for multiple architectures (amd64, arm64)
- **Linting**: Use `npm run lint:fix` in CI to prevent failures on TypeScript warnings