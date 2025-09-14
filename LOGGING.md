# Enhanced Logging Documentation

## Overview

The Alive observability platform now includes comprehensive enhanced logging capabilities to provide better visibility into backend operations, connection status, and data processing activities.

## Logging Features

### 1. **Structured Logging System**
- **Timestamped logs** with ISO format timestamps
- **Component-based logging** (INGEST, STORE, SSE, API, etc.)
- **Log levels**: DEBUG, INFO, WARN, ERROR
- **Metadata inclusion** for detailed context

### 2. **Environment Configuration**

#### Log Level Control
```bash
# Set log level (DEBUG, INFO, WARN, ERROR)
export LOG_LEVEL=INFO

# Enable structured JSON logging
export STRUCTURED_LOGS=true

# Run with custom logging
LOG_LEVEL=DEBUG npm run dev
```

#### Default Settings
- **Log Level**: INFO (shows INFO, WARN, ERROR)
- **Structured Logs**: false (uses formatted console output)
- **Environment**: development

### 3. **Log Types and Examples**

#### Standard Format (Default)
```
[2025-09-14T09:00:18.690Z] [INFO] [INGEST] 🔄 Starting ingestion request { requestId: '81fkr421y', timestamp: 1757840418690 }
[2025-09-14T09:00:18.697Z] [INFO] [STORE] 📡 Broadcasting to clients { sseClients: 0, wsClients: 0 }
[2025-09-14T09:00:19.099Z] [INFO] [INGEST] ✅ JSON ingestion completed { requestId: 'g6vquyqzp', duration: 29, success: true, written: 1 }
```

#### Structured JSON Format (STRUCTURED_LOGS=true)
```json
{"timestamp":"2025-09-14T09:00:11.752Z","level":"INFO","component":"API","message":"🧪 Test log entry generated","pid":2974}
{"timestamp":"2025-09-14T09:00:11.752Z","level":"WARN","component":"API","message":"⚠️ Warning message test","pid":2974}
{"timestamp":"2025-09-14T09:00:11.752Z","level":"ERROR","component":"API","message":"❌ Error message test","pid":2974}
```

### 4. **Logging Endpoints**

#### GET `/api/logging` - Logging Status
Returns comprehensive logging and system status:

```bash
curl http://localhost:3001/api/logging | jq .
```

**Response:**
```json
{
  "server": {
    "status": "running",
    "pid": 2974,
    "uptime": 21.011978949,
    "nodeVersion": "v20.19.5",
    "memory": {
      "rss": 618,
      "heapUsed": 86,
      "heapTotal": 102
    }
  },
  "logging": {
    "level": "INFO",
    "structuredLogs": false,
    "environment": "development"
  },
  "connections": {
    "sseClients": 0,
    "wsClients": 0,
    "total": 0
  },
  "storage": {
    "requests": 1,
    "logs": 0,
    "events": 0,
    "metrics": 0,
    "raw": 1,
    "cap": 2000
  },
  "lastUpdate": "2025-09-14T09:00:05.160Z"
}
```

#### POST `/api/logging` - Test Logging
Generates test log entries at all levels:

```bash
curl -X POST http://localhost:3001/api/logging
```

### 5. **Component-Specific Logging**

#### INGEST Component
- **Request tracking** with unique request IDs
- **Payload size** and content type logging
- **Processing duration** and success/failure status
- **Classification results** (requests, logs, events, metrics, raw)

```
[2025-09-14T09:00:18.690Z] [INFO] [INGEST] 🔄 Starting ingestion request { requestId: '81fkr421y', timestamp: 1757840418690 }
[2025-09-14T09:00:19.099Z] [INFO] [INGEST] ✅ JSON ingestion completed { requestId: 'g6vquyqzp', duration: 29, success: true, written: 1 }
```

#### STORE Component
- **Data storage operations** with counts
- **Broadcasting status** to connected clients
- **Connection statistics** (SSE/WebSocket client counts)

```
[2025-09-14T09:00:18.697Z] [INFO] [STORE] 📡 Broadcasting to clients { sseClients: 0, wsClients: 0 }
```

#### SSE Component
- **Client connection** and disconnection events
- **Keep-alive failures** and connection issues
- **Client identification** with unique client IDs

```
[2025-09-14T09:00:25.123Z] [INFO] [SSE] ✅ SSE client connected successfully { clientId: 'abc123xyz' }
[2025-09-14T09:00:45.456Z] [INFO] [SSE] 🚪 SSE client disconnected { clientId: 'abc123xyz' }
```

### 6. **Production vs Development**

#### Development Mode (npm run dev)
- **Full verbose logging** with emojis and colors
- **Debug information** included
- **Real-time log output** to console

#### Production Mode (node .next/standalone/server.js)
- **Optimized logging** for performance
- **Structured format** recommended
- **Log aggregation** friendly

### 7. **Log Level Details**

#### DEBUG (Level 0)
- Detailed payload information
- Step-by-step processing logs
- Performance timing details

#### INFO (Level 1) - Default
- Request/response operations
- Connection events
- Business logic outcomes

#### WARN (Level 2)
- Non-fatal errors
- Performance warnings
- Connection issues

#### ERROR (Level 3)
- Fatal errors
- Exception handling
- System failures

### 8. **Connection Monitoring**

#### Real-time Connection Status
The logging system tracks and reports:
- **SSE client connections** (Server-Sent Events)
- **WebSocket connections** (when available)
- **Connection lifecycle** (connect, disconnect, errors)

```
[2025-09-14T09:00:19.099Z] [INFO] [SSE] ➕ Registering SSE client { clientId: 'xy7z3qw8r', totalClients: 1 }
[2025-09-14T09:00:45.456Z] [INFO] [SSE] ➖ Unregistering SSE client { clientId: 'xy7z3qw8r', remainingClients: 0 }
```

### 9. **Troubleshooting**

#### No Logs Appearing
1. **Check log level**: Ensure LOG_LEVEL allows your desired logs
2. **Verify environment**: Development vs production mode
3. **Test logging**: Use `POST /api/logging` to generate test logs

#### SSE Connection Issues
1. **Check connection count**: Use `GET /api/logging` to see active connections
2. **Monitor client logs**: Look for SSE connection/disconnection events
3. **Test SSE endpoint**: `curl -H "Accept: text/event-stream" http://localhost:3001/api/events/stream`

#### Performance Impact
1. **Use appropriate log level**: Set to WARN or ERROR in production
2. **Enable structured logs**: Use STRUCTURED_LOGS=true for log aggregation
3. **Monitor memory usage**: Check `/api/logging` for memory statistics

### 10. **Integration Examples**

#### Docker Environment Variables
```dockerfile
ENV LOG_LEVEL=INFO
ENV STRUCTURED_LOGS=true
ENV NODE_ENV=production
```

#### Development Debugging
```bash
# Maximum verbosity
LOG_LEVEL=DEBUG npm run dev

# JSON logs for parsing
STRUCTURED_LOGS=true npm run dev

# Production simulation
NODE_ENV=production LOG_LEVEL=WARN npm run build && node .next/standalone/server.js
```

#### Log Aggregation
```bash
# Stream structured logs to file
STRUCTURED_LOGS=true npm start | tee logs/alive.jsonl

# Parse with jq
tail -f logs/alive.jsonl | jq 'select(.level == "ERROR")'
```

## Conclusion

The enhanced logging system provides comprehensive visibility into the Alive platform's operations, making debugging, monitoring, and troubleshooting much more effective. The combination of structured logging, configurable levels, and real-time connection monitoring ensures that both development and production environments have appropriate logging capabilities.