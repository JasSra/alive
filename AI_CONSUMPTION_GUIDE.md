# AI Event Tracking System - Consumption Guide

## Overview
This is a comprehensive live event tracking system built with Next.js that captures browser events, network requests, user interactions, and custom events. It provides real-time monitoring capabilities with a REST API for event ingestion and retrieval.

## System Architecture

- **Frontend**: Next.js 15 application with TypeScript
- **Backend**: Next.js API routes handling event ingestion and streaming
- **Monitor**: Self-configuring JavaScript client that auto-detects server origin
- **Storage**: In-memory event store (easily replaceable with database)
- **Real-time**: Server-Sent Events (SSE) for live streaming

## Quick Start

### 1. Development Server
```bash
npm run dev
# Starts both frontend and API backend on http://localhost:3000
```

### 2. Embed Monitor on Any Website
```html
<!-- Auto-configuring monitor script -->
<script src="http://localhost:3000/api/monitor.js"></script>

<!-- The monitor runs in hidden mode by default -->
<!-- Use Ctrl+Shift+M to toggle visibility -->
<!-- Or access via window.LiveMonitor API -->
```

## API Endpoints

### Base URL
- Development: `http://localhost:3000`
- Production: Your deployed domain (auto-detected by monitor.js)

### 1. Event Ingestion

**POST** `/api/events`

Send events to the tracking system.

**Request Body:**
```json
{
  "events": [
    {
      "type": "custom-event",
      "name": "user-action",
      "timestamp": "2025-08-26T15:30:45.123Z",
      "timestampMs": 1724681445123,
      "userId": "user-123",
      "url": "https://example.com/page",
      "correlationId": "req-abc123",
      "customData": {
        "action": "button-click",
        "element": "#submit-btn",
        "value": "Subscribe"
      }
    }
  ]
}
```

**Event Schema:**
```typescript
interface Event {
  id?: string;              // Auto-generated if not provided
  type: string;             // Event category (e.g., "user-event", "api-call")
  name: string;             // Specific event name (e.g., "login", "purchase")
  timestamp: string;        // ISO 8601 timestamp
  timestampMs: number;      // Unix timestamp in milliseconds
  userId: string;           // User identifier
  url: string;              // Page URL where event occurred
  correlationId?: string;   // Group related events
  statusCode?: number;      // HTTP status for network events
  responseTimeMs?: number;  // Response time for network events
  userAgent?: string;       // Browser user agent
  [key: string]: any;       // Additional custom properties
}
```

**Response:**
```json
{
  "success": true,
  "received": 1,
  "total": 156
}
```

### 2. Event Retrieval

**GET** `/api/events`

Retrieve stored events with filtering options.

**Query Parameters:**
- `limit`: Number of events to return (default: 100)
- `from`: Start timestamp (ISO 8601)
- `to`: End timestamp (ISO 8601)
- `type`: Filter by event type (partial match)

**Example Requests:**
```bash
# Get last 50 events
curl "http://localhost:3000/api/events?limit=50"

# Get events from last hour
curl "http://localhost:3000/api/events?from=2025-08-26T14:00:00Z"

# Get network-related events
curl "http://localhost:3000/api/events?type=network"
```

**Response:**
```json
{
  "events": [...],
  "total": 156,
  "filtered": 50
}
```

### 3. Live Event Stream

**GET** `/api/events/stream`

Server-Sent Events stream for real-time monitoring.

**Example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/api/events/stream');

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Live event:', data);
};
```

### 4. Event Cleanup

**DELETE** `/api/events`

Clear all stored events.

**Response:**
```json
{
  "success": true,
  "cleared": 156
}
```

## Event Types Captured by Monitor

### Network Events
- `network-request` - HTTP requests (fetch, XHR)
- `network-response` - HTTP responses with timing
- `network-error` - Network failures

### DOM Events
- `dom-event` - User interactions (click, scroll, keydown, focus, blur)
- `page-event` - Page lifecycle (load, unload, visibility-change)

### Console Events
- `console-event` - Console logs, errors, warnings

### Monitor Events
- `monitor-event` - Monitor lifecycle (start, stop)

## Usage Examples

### 1. Track Custom Business Events

```javascript
// Send custom event via fetch
async function trackPurchase(orderId, amount) {
  const event = {
    type: "business-event",
    name: "purchase-completed",
    timestamp: new Date().toISOString(),
    timestampMs: Date.now(),
    userId: getCurrentUserId(),
    url: window.location.href,
    correlationId: `order-${orderId}`,
    orderData: {
      orderId,
      amount,
      currency: "USD"
    }
  };

  await fetch('http://localhost:3000/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [event] })
  });
}
```

### 2. Track API Performance

```javascript
// Monitor API calls with timing
async function trackApiCall(endpoint, method = 'GET') {
  const correlationId = generateId();
  const startTime = Date.now();

  // Log request
  await trackEvent({
    type: "api-call",
    name: "request-start",
    correlationId,
    endpoint,
    method
  });

  try {
    const response = await fetch(endpoint, { method });
    const endTime = Date.now();

    // Log success
    await trackEvent({
      type: "api-call",
      name: "request-success",
      correlationId,
      endpoint,
      statusCode: response.status,
      responseTimeMs: endTime - startTime
    });

    return response;
  } catch (error) {
    const endTime = Date.now();

    // Log error
    await trackEvent({
      type: "api-call",
      name: "request-error",
      correlationId,
      endpoint,
      error: error.message,
      responseTimeMs: endTime - startTime
    });

    throw error;
  }
}
```

### 3. Track User Journey

```javascript
// Track multi-step user flows
class UserJourneyTracker {
  constructor(userId) {
    this.userId = userId;
    this.sessionId = generateId();
  }

  async trackStep(stepName, stepData = {}) {
    await trackEvent({
      type: "user-journey",
      name: stepName,
      userId: this.userId,
      correlationId: this.sessionId,
      stepData,
      url: window.location.href
    });
  }
}

// Usage
const tracker = new UserJourneyTracker('user-123');
await tracker.trackStep('signup-start');
await tracker.trackStep('email-entered', { email: 'user@example.com' });
await tracker.trackStep('verification-sent');
await tracker.trackStep('signup-completed');
```

### 4. Real-time Dashboard Integration

```javascript
// Connect to live stream for dashboards
class LiveDashboard {
  constructor() {
    this.eventSource = new EventSource('http://localhost:3000/api/events/stream');
    this.setupHandlers();
  }

  setupHandlers() {
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.processLiveEvent(data);
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Implement reconnection logic
    };
  }

  processLiveEvent(eventData) {
    switch (eventData.type) {
      case 'browser-event':
        this.updateBrowserMetrics(eventData.data);
        break;
      case 'custom-event':
        this.updateBusinessMetrics(eventData.data);
        break;
    }
  }
}
```

## Analytics and Querying

### Time-based Analysis
```javascript
// Get events from last 24 hours
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const response = await fetch(`/api/events?from=${yesterday}&limit=1000`);
const { events } = await response.json();

// Group by hour
const hourlyData = events.reduce((acc, event) => {
  const hour = new Date(event.timestamp).getHours();
  acc[hour] = (acc[hour] || 0) + 1;
  return acc;
}, {});
```

### Performance Analysis
```javascript
// Analyze network performance
const networkEvents = events.filter(e => e.type === 'network-response');
const avgResponseTime = networkEvents.reduce((sum, e) => sum + e.responseTimeMs, 0) / networkEvents.length;
const errorRate = networkEvents.filter(e => e.statusCode >= 400).length / networkEvents.length;
```

### User Behavior Analysis
```javascript
// Track user interaction patterns
const userEvents = events.filter(e => e.type === 'dom-event');
const clickEvents = userEvents.filter(e => e.name === 'click');
const scrollEvents = userEvents.filter(e => e.name === 'scroll');
```

## Monitor Control API

The embedded monitor provides a JavaScript API for programmatic control:

```javascript
// Monitor controls
window.LiveMonitor.start();          // Start monitoring
window.LiveMonitor.stop();           // Stop monitoring
window.LiveMonitor.show();           // Show UI
window.LiveMonitor.hide();           // Hide UI
window.LiveMonitor.toggle();         // Toggle visibility
window.LiveMonitor.clear();          // Clear captured events
window.LiveMonitor.close();          // Remove monitor

// Data access
const events = window.LiveMonitor.getEvents();
const config = window.LiveMonitor.getConfig();
const isHidden = window.LiveMonitor.isHidden();

// Time window control
window.LiveMonitor.setTimeWindow(20); // Set to 20-minute window
```

## Security Considerations

### CORS Configuration
The API includes CORS headers for cross-origin requests:
```javascript
"Access-Control-Allow-Origin": "*"
"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
```

### Content Security Policy
The system includes CSP headers to allow script execution:
```javascript
"Content-Security-Policy": "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: data:"
```

## Deployment Notes

### Environment Variables
```bash
# Optional: Custom server port
PORT=3001

# Optional: Database connection for persistent storage
DATABASE_URL=postgresql://...
```

### Production Deployment
1. Build the application: `npm run build`
2. Start production server: `npm start`
3. Update monitor script URLs to your domain
4. Configure reverse proxy (nginx) if needed
5. Set up proper SSL certificates

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **CSP Violations**: Ensure CSP allows script execution from your domain
2. **CORS Errors**: Check that CORS headers are properly configured
3. **Monitor Not Loading**: Verify the script URL matches your server
4. **Events Not Appearing**: Check browser console for network errors

### Debug Mode
Use the monitor in visible mode for debugging:
```javascript
// Show monitor for debugging
window.LiveMonitor.show();

// Check configuration
console.log(window.LiveMonitor.getConfig());
```

### Server Logs
Monitor server logs for event processing:
```bash
# Development
npm run dev

# Check API endpoint
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"events":[{"type":"test","name":"api-check","timestamp":"2025-08-26T15:30:45.123Z","timestampMs":1724681445123,"userId":"test","url":"http://localhost:3000"}]}'
```

This system provides a complete foundation for real-time event tracking and analytics. The auto-configuring monitor makes it easy to embed on any website, while the REST API provides flexibility for custom integrations and analysis.
