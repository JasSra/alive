# AI Event Tracking System - Consumption Guide

## Overview
This is a comprehensive live event tracking system built with Next.js that captures browser events, network requests, user interactions, and custom events. It provides real-time monitoring capabilities with a REST API for event ingestion and retrieval, specifically designed for AI systems to consume and analyze user behavior data.

## System Architecture

- **Frontend**: Next.js 15 application with TypeScript - React-based dashboard
- **Backend**: Next.js API routes handling event ingestion, streaming, and analytics
- **Monitor**: Self-configuring JavaScript client that auto-detects server origin
- **Storage**: In-memory event store with service-based organization
- **Real-time**: Server-Sent Events (SSE) for live streaming and WebSocket support
- **AI Integration**: Structured event schemas optimized for machine learning consumption

## Service Names & Organization

The system organizes events by **serviceName** to enable multi-service tracking:

- `web-analytics` - Website user interactions and page views
- `api-gateway` - REST API calls and responses  
- `user-service` - Authentication and user management events
- `payment-service` - Transaction and billing events
- `notification-service` - Email, SMS, and push notifications
- `content-service` - Content management and delivery
- `search-service` - Search queries and results
- `custom-service` - Your application-specific services

Each service maintains its own event namespace and analytics.

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

## API Endpoints for AI Consumption

### Base URL

- Development: `http://localhost:3000`
- Production: Your deployed domain (auto-detected by monitor.js)

### 1. Single Event Tracking

**POST** `/api/events/track/{eventName}`

Track individual events with automatic enrichment and AI suggestions.

**URL Parameters:**
- `eventName`: The specific event identifier (e.g., "user-login", "api-call", "purchase-completed")

**Request Headers:**
```
Content-Type: application/json
X-User-Id: user-identifier (optional)
```

**Request Body (AIEventPayload):**
```json
{
  "userAgent": "Mozilla/5.0...",
  "referrer": "https://previous-page.com",
  "sessionId": "session-abc123",
  "userRole": "premium-user",
  "correlationId": "req-12345",
  "statusCode": 200,
  "responseTimeMs": 150,
  "serviceName": "user-service",
  "metadata": {
    "feature": "authentication",
    "version": "2.1.0",
    "customField": "value"
  }
}
```

**Response (TrackEventResponse):**
```json
{
  "success": true,
  "message": "Event tracked successfully",
  "suggestions": [
    {
      "id": "sug-001",
      "title": "Optimize Login Flow",
      "description": "Consider implementing SSO for faster authentication",
      "score": 0.85,
      "action": {
        "label": "View Details",
        "href": "/analytics/login-optimization",
        "method": "GET"
      },
      "tags": ["performance", "ux", "authentication"]
    }
  ],
  "eventId": "evt-abc123",
  "timestamp": "2025-08-27T10:30:45.123Z"
}
```

### 2. Batch Event Tracking

**POST** `/api/events/track/batch`

Send multiple events in a single request for better performance.

**Request Body (BatchTrackEventRequest):**
```json
{
  "batchId": "batch-xyz789",
  "events": [
    {
      "eventName": "page-view",
      "payload": {
        "serviceName": "web-analytics",
        "sessionId": "session-123",
        "metadata": {
          "page": "/dashboard",
          "loadTime": 1200
        }
      }
    },
    {
      "eventName": "api-call",
      "payload": {
        "serviceName": "api-gateway",
        "statusCode": 200,
        "responseTimeMs": 85,
        "correlationId": "req-456"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "processedCount": 2,
  "suggestions": [...],
  "batchId": "batch-xyz789",
  "timestamp": "2025-08-27T10:30:45.123Z"
}
```

### 3. Event Retrieval & Analytics

**GET** `/api/events`

Retrieve stored events with advanced filtering for AI analysis.

**Query Parameters:**
- `limit`: Number of events (default: 100, max: 1000)
- `from`: Start timestamp (ISO 8601)
- `to`: End timestamp (ISO 8601)
- `type`: Filter by event type (partial match)
- `serviceName`: Filter by specific service
- `userId`: Filter by user identifier
- `correlationId`: Group related events
- `eventName`: Specific event name filter

**Example Requests:**
```bash
# Get recent events for AI training
curl "http://localhost:3000/api/events?limit=1000&from=2025-08-27T00:00:00Z"

# Get service-specific events
curl "http://localhost:3000/api/events?serviceName=payment-service&limit=500"

# Get user journey events
curl "http://localhost:3000/api/events?correlationId=user-journey-123"
```

**Response Structure:**
```json
{
  "events": [
    {
      "id": "evt-001",
      "name": "user-login",
      "userId": "user-123",
      "serviceName": "user-service",
      "payload": {
        "userAgent": "Mozilla/5.0...",
        "sessionId": "session-abc",
        "correlationId": "req-123",
        "statusCode": 200,
        "responseTimeMs": 150,
        "metadata": {
          "loginMethod": "email",
          "twoFactorEnabled": true
        }
      },
      "timestamp": 1724681445123
    }
  ],
  "total": 156,
  "filtered": 50,
  "services": ["user-service", "payment-service"],
  "timeRange": {
    "from": "2025-08-27T00:00:00Z",
    "to": "2025-08-27T10:30:45Z"
  }
}
```

### 4. Service Analytics

**GET** `/api/events/services`

Get comprehensive analytics by service for AI insights.

**Query Parameters:**
- `from`: Start timestamp
- `to`: End timestamp
- `serviceName`: Specific service (optional)

**Response (ServiceStats[]):**
```json
{
  "services": [
    {
      "serviceName": "user-service",
      "eventCount": 1250,
      "uniqueEvents": 8,
      "avgResponseTime": 145.5,
      "errorRate": 2.1,
      "lastSeen": "2025-08-27T10:29:15Z",
      "topEvents": [
        {
          "eventName": "user-login",
          "count": 456,
          "percentage": 36.5
        },
        {
          "eventName": "profile-update",
          "count": 234,
          "percentage": 18.7
        }
      ]
    }
  ],
  "summary": {
    "totalServices": 5,
    "totalEvents": 5780,
    "avgResponseTime": 198.2,
    "overallErrorRate": 3.4
  }
}
```

### 5. Event Statistics

**GET** `/api/events/statistics`

Get detailed statistics for AI model training and analysis.

**Response (EventStatistics):**
```json
{
  "totalEventCount": 5780,
  "totalUniqueEvents": 42,
  "totalServices": 5,
  "perDay": [
    { "date": "2025-08-25", "count": 1890 },
    { "date": "2025-08-26", "count": 2156 },
    { "date": "2025-08-27", "count": 1734 }
  ],
  "topEvents": [
    {
      "eventName": "page-view",
      "count": 1456,
      "percentage": 25.2
    },
    {
      "eventName": "api-call",
      "count": 892,
      "percentage": 15.4
    }
  ],
  "serviceBreakdown": [
    {
      "serviceName": "web-analytics",
      "eventCount": 2340,
      "uniqueEvents": 12,
      "avgResponseTime": 89.2,
      "errorRate": 1.2,
      "lastSeen": "2025-08-27T10:30:45Z",
      "topEvents": [...]
    }
  ]
}
```

### 6. Real-time Event Stream

**GET** `/api/events/stream`

Server-Sent Events stream for real-time AI processing.

**Event Types:**
- `event`: New event data
- `stats`: Updated statistics
- `ping`: Keep-alive

**Example Stream Consumption:**
```javascript
const eventSource = new EventSource('http://localhost:3000/api/events/stream');

eventSource.onmessage = function(event) {
  const streamEvent = JSON.parse(event.data);
  
  switch(streamEvent.type) {
    case 'event':
      // Process new event for real-time AI
      processEventForAI(streamEvent.data);
      break;
    case 'stats':
      // Update ML model with new statistics
      updateModelStatistics(streamEvent.data);
      break;
  }
};
```

### 7. WebSocket Stream (Alternative)

**WS** `/api/events/ws`

WebSocket connection for bidirectional real-time communication.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/api/events/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Process real-time event data
};

// Send real-time queries
ws.send(JSON.stringify({
  type: 'filter',
  serviceName: 'payment-service'
}));
```

### 8. Event Suggestions & AI Insights

**GET** `/api/events/suggestions`

Get AI-generated suggestions based on event patterns.

**Query Parameters:**
- `eventName`: Base event for suggestions
- `serviceName`: Service context
- `userId`: User-specific suggestions
- `limit`: Number of suggestions (default: 10)

**Response:**
```json
{
  "suggestions": [
    {
      "id": "sug-001",
      "title": "Reduce API Response Time",
      "description": "Your payment-service API calls average 300ms. Consider caching frequently accessed data.",
      "score": 0.92,
      "action": {
        "label": "View Performance Analysis",
        "href": "/analytics/performance/payment-service"
      },
      "tags": ["performance", "api", "caching"],
      "basedOn": {
        "eventPattern": "High response times in payment-service",
        "sampleSize": 1250,
        "confidence": 0.89
      }
    }
  ],
  "context": {
    "serviceName": "payment-service",
    "timeRange": "last-24h",
    "totalEvents": 1250
  }
}
```
## Frontend Integration Examples

### 1. React/TypeScript Integration

**Install the monitoring client:**
```bash
npm install @your-org/event-tracker
# Or include the script directly
```

**Basic React Hook for Event Tracking:**
```typescript
import { useCallback, useEffect, useState } from 'react';

interface EventTracker {
  track: (eventName: string, payload?: any) => Promise<void>;
  trackBatch: (events: Array<{eventName: string, payload?: any}>) => Promise<void>;
}

export const useEventTracker = (serviceName: string): EventTracker => {
  const [baseUrl] = useState(() => {
    // Auto-detect or configure your tracking endpoint
    return process.env.NEXT_PUBLIC_TRACKER_URL || 'http://localhost:3000';
  });

  const track = useCallback(async (eventName: string, payload: any = {}) => {
    try {
      const enrichedPayload = {
        ...payload,
        serviceName,
        sessionId: sessionStorage.getItem('sessionId') || 'anonymous',
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        timestamp: Date.now(),
        metadata: {
          ...payload.metadata,
          url: window.location.href,
          path: window.location.pathname,
          userRole: localStorage.getItem('userRole') || 'guest'
        }
      };

      const response = await fetch(`${baseUrl}/api/events/track/${eventName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': localStorage.getItem('userId') || 'anonymous'
        },
        body: JSON.stringify(enrichedPayload)
      });

      const result = await response.json();
      
      // Handle AI suggestions
      if (result.suggestions?.length > 0) {
        console.log('AI Suggestions:', result.suggestions);
        // Optionally show suggestions to user or send to analytics
      }
      
      return result;
    } catch (error) {
      console.error('Event tracking failed:', error);
    }
  }, [baseUrl, serviceName]);

  const trackBatch = useCallback(async (events: Array<{eventName: string, payload?: any}>) => {
    try {
      const batchPayload = {
        batchId: `batch-${Date.now()}`,
        events: events.map(event => ({
          eventName: event.eventName,
          payload: {
            ...event.payload,
            serviceName,
            sessionId: sessionStorage.getItem('sessionId') || 'anonymous'
          }
        }))
      };

      const response = await fetch(`${baseUrl}/api/events/track/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload)
      });

      return await response.json();
    } catch (error) {
      console.error('Batch tracking failed:', error);
    }
  }, [baseUrl, serviceName]);

  return { track, trackBatch };
};
```

**React Component Usage:**
```typescript
import React, { useEffect } from 'react';
import { useEventTracker } from './hooks/useEventTracker';

export const UserDashboard: React.FC = () => {
  const tracker = useEventTracker('web-analytics');

  useEffect(() => {
    // Track page view
    tracker.track('page-view', {
      metadata: {
        component: 'UserDashboard',
        loadTime: performance.now()
      }
    });
  }, [tracker]);

  const handleButtonClick = async (action: string) => {
    await tracker.track('user-interaction', {
      metadata: {
        action,
        component: 'UserDashboard',
        timestamp: Date.now()
      }
    });
  };

  const handleApiCall = async (endpoint: string) => {
    const startTime = Date.now();
    const correlationId = `api-${Date.now()}`;

    // Track API request start
    await tracker.track('api-request-start', {
      correlationId,
      metadata: { endpoint, method: 'GET' }
    });

    try {
      const response = await fetch(endpoint);
      const endTime = Date.now();

      // Track successful API response
      await tracker.track('api-request-success', {
        correlationId,
        statusCode: response.status,
        responseTimeMs: endTime - startTime,
        metadata: { endpoint }
      });

      return response;
    } catch (error) {
      const endTime = Date.now();

      // Track API error
      await tracker.track('api-request-error', {
        correlationId,
        responseTimeMs: endTime - startTime,
        metadata: {
          endpoint,
          error: error.message
        }
      });
      throw error;
    }
  };

  return (
    <div>
      <button onClick={() => handleButtonClick('dashboard-refresh')}>
        Refresh Dashboard
      </button>
      <button onClick={() => handleApiCall('/api/user/profile')}>
        Load Profile
      </button>
    </div>
  );
};
```

### 2. Vue.js Integration

**Vue Composable:**
```typescript
import { ref, computed } from 'vue';

export function useEventTracking(serviceName: string) {
  const isTracking = ref(true);
  const sessionId = ref(sessionStorage.getItem('sessionId') || crypto.randomUUID());

  const trackEvent = async (eventName: string, payload: any = {}) => {
    if (!isTracking.value) return;

    const eventPayload = {
      ...payload,
      serviceName,
      sessionId: sessionId.value,
      userAgent: navigator.userAgent,
      metadata: {
        ...payload.metadata,
        framework: 'vue',
        timestamp: Date.now()
      }
    };

    try {
      const response = await fetch(`/api/events/track/${eventName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload)
      });
      
      return await response.json();
    } catch (error) {
      console.error('Vue event tracking failed:', error);
    }
  };

  return {
    trackEvent,
    isTracking,
    sessionId: computed(() => sessionId.value)
  };
}
```

### 3. Vanilla JavaScript Integration

**Browser Script:**
```javascript
class EventTracker {
  constructor(baseUrl, serviceName) {
    this.baseUrl = baseUrl || this.detectBaseUrl();
    this.serviceName = serviceName || 'web-app';
    this.sessionId = this.getOrCreateSessionId();
    this.userId = localStorage.getItem('userId') || 'anonymous';
    this.setupAutoTracking();
  }

  detectBaseUrl() {
    // Auto-detect based on current domain
    return window.location.origin;
  }

  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('eventTrackerSessionId');
    if (!sessionId) {
      sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('eventTrackerSessionId', sessionId);
    }
    return sessionId;
  }

  async track(eventName, payload = {}) {
    const eventPayload = {
      ...payload,
      serviceName: this.serviceName,
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      metadata: {
        ...payload.metadata,
        url: window.location.href,
        timestamp: Date.now()
      }
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/events/track/${eventName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': this.userId
        },
        body: JSON.stringify(eventPayload)
      });

      if (response.ok) {
        const result = await response.json();
        this.handleSuggestions(result.suggestions);
        return result;
      }
    } catch (error) {
      console.warn('Event tracking failed:', error);
    }
  }

  handleSuggestions(suggestions) {
    if (suggestions && suggestions.length > 0) {
      // Emit custom event for suggestions
      window.dispatchEvent(new CustomEvent('aiSuggestions', {
        detail: suggestions
      }));
    }
  }

  setupAutoTracking() {
    // Auto-track page views
    this.track('page-view', {
      metadata: {
        title: document.title,
        loadTime: performance.timing?.loadEventEnd - performance.timing?.navigationStart
      }
    });

    // Auto-track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target.matches('button, a, [data-track]')) {
        this.track('element-click', {
          metadata: {
            element: target.tagName.toLowerCase(),
            text: target.textContent?.trim() || '',
            id: target.id || '',
            className: target.className || '',
            href: target.href || ''
          }
        });
      }
    });

    // Auto-track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target;
      this.track('form-submit', {
        metadata: {
          formId: form.id || '',
          action: form.action || '',
          method: form.method || 'GET'
        }
      });
    });
  }
}

// Initialize global tracker
window.EventTracker = new EventTracker('http://localhost:3000', 'web-analytics');

// Listen for AI suggestions
window.addEventListener('aiSuggestions', (event) => {
  console.log('Received AI suggestions:', event.detail);
  // Display suggestions to user or process them
});
```

## Backend Integration Examples

### 1. Node.js/Express Integration

**Event Tracking Middleware:**
```javascript
const axios = require('axios');

class BackendEventTracker {
  constructor(baseUrl, serviceName) {
    this.baseUrl = baseUrl || process.env.EVENT_TRACKER_URL || 'http://localhost:3000';
    this.serviceName = serviceName;
  }

  async track(eventName, payload = {}, req = null) {
    const eventPayload = {
      ...payload,
      serviceName: this.serviceName,
      userAgent: req?.headers['user-agent'],
      referrer: req?.headers['referer'],
      metadata: {
        ...payload.metadata,
        serverTimestamp: Date.now(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/events/track/${eventName}`,
        eventPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': req?.user?.id || payload.userId || 'system'
          },
          timeout: 5000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Backend event tracking failed:', error.message);
      return null;
    }
  }

  // Express middleware for automatic API tracking
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Track request start
      this.track('api-request-received', {
        correlationId,
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      }, req);

      // Override res.end to track response
      const originalEnd = res.end;
      res.end = (...args) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Track response
        this.track('api-response-sent', {
          correlationId,
          statusCode: res.statusCode,
          responseTimeMs: responseTime,
          metadata: {
            method: req.method,
            path: req.path,
            contentLength: res.get('Content-Length')
          }
        }, req);

        originalEnd.apply(res, args);
      };

      next();
    };
  }
}

// Usage in Express app
const express = require('express');
const app = express();

const tracker = new BackendEventTracker('http://localhost:3000', 'api-gateway');

// Use the tracking middleware
app.use(tracker.middleware());

// Manual tracking in route handlers
app.post('/api/users', async (req, res) => {
  try {
    // Track business event
    await tracker.track('user-creation-attempt', {
      userId: req.body.email,
      metadata: {
        source: 'api',
        validation: 'pending'
      }
    }, req);

    const user = await createUser(req.body);

    await tracker.track('user-created', {
      userId: user.id,
      metadata: {
        source: 'api',
        userRole: user.role
      }
    }, req);

    res.json({ success: true, user });
  } catch (error) {
    await tracker.track('user-creation-failed', {
      metadata: {
        error: error.message,
        source: 'api'
      }
    }, req);

    res.status(500).json({ error: error.message });
  }
});
```

### 2. Python/FastAPI Integration

**Python Event Tracker:**
```python
import httpx
import asyncio
import time
from typing import Dict, Any, Optional
from fastapi import Request
import json

class EventTracker:
    def __init__(self, base_url: str = "http://localhost:3000", service_name: str = "python-service"):
        self.base_url = base_url
        self.service_name = service_name
        self.client = httpx.AsyncClient(timeout=5.0)

    async def track(self, event_name: str, payload: Dict[str, Any] = None, request: Request = None):
        if payload is None:
            payload = {}

        event_payload = {
            **payload,
            "serviceName": self.service_name,
            "metadata": {
                **payload.get("metadata", {}),
                "serverTimestamp": int(time.time() * 1000),
                "pythonVersion": f"{sys.version_info.major}.{sys.version_info.minor}",
                "environment": os.getenv("ENVIRONMENT", "development")
            }
        }

        if request:
            event_payload.update({
                "userAgent": request.headers.get("user-agent"),
                "referrer": request.headers.get("referer"),
                "metadata": {
                    **event_payload["metadata"],
                    "method": request.method,
                    "path": str(request.url.path),
                    "clientIP": request.client.host if request.client else None
                }
            })

        try:
            response = await self.client.post(
                f"{self.base_url}/api/events/track/{event_name}",
                json=event_payload,
                headers={
                    "Content-Type": "application/json",
                    "X-User-Id": payload.get("userId", "system")
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Event tracking failed: {response.status_code}")
                
        except Exception as e:
            print(f"Event tracking error: {str(e)}")
            
        return None

# FastAPI Integration
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.base import BaseHTTPMiddleware
import time

app = FastAPI()
tracker = EventTracker("http://localhost:3000", "python-api")

class EventTrackingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        correlation_id = f"req-{int(time.time())}-{hash(str(request.url)) % 10000}"

        # Track request
        await tracker.track("api-request-received", {
            "correlationId": correlation_id,
            "metadata": {
                "method": request.method,
                "path": str(request.url.path),
                "query": dict(request.query_params)
            }
        }, request)

        response = await call_next(request)
        
        process_time = (time.time() - start_time) * 1000

        # Track response
        await tracker.track("api-response-sent", {
            "correlationId": correlation_id,
            "statusCode": response.status_code,
            "responseTimeMs": process_time,
            "metadata": {
                "method": request.method,
                "path": str(request.url.path)
            }
        }, request)

        return response

app.add_middleware(EventTrackingMiddleware)

@app.post("/users/")
async def create_user(user_data: dict, request: Request):
    try:
        await tracker.track("user-creation-attempt", {
            "userId": user_data.get("email"),
            "metadata": {"source": "python-api"}
        }, request)

        # Your user creation logic here
        user = {"id": "user-123", "email": user_data["email"]}

        await tracker.track("user-created", {
            "userId": user["id"],
            "metadata": {"source": "python-api"}
        }, request)

        return {"success": True, "user": user}
        
    except Exception as e:
        await tracker.track("user-creation-failed", {
            "metadata": {"error": str(e), "source": "python-api"}
        }, request)
        
        raise HTTPException(status_code=500, detail=str(e))
```

### 3. Java/Spring Boot Integration

**Java Event Tracker Service:**
```java
@Service
@Component
public class EventTracker {
    
    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final String serviceName;
    
    public EventTracker(
        @Value("${event.tracker.url:http://localhost:3000}") String baseUrl,
        @Value("${event.tracker.service:java-service}") String serviceName
    ) {
        this.baseUrl = baseUrl;
        this.serviceName = serviceName;
        this.restTemplate = new RestTemplate();
        
        // Configure timeout
        HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(5000);
        this.restTemplate.setRequestFactory(factory);
    }
    
    public void track(String eventName, Map<String, Object> payload, HttpServletRequest request) {
        CompletableFuture.runAsync(() -> trackAsync(eventName, payload, request));
    }
    
    private void trackAsync(String eventName, Map<String, Object> payload, HttpServletRequest request) {
        try {
            Map<String, Object> eventPayload = new HashMap<>(payload != null ? payload : new HashMap<>());
            eventPayload.put("serviceName", serviceName);
            
            Map<String, Object> metadata = (Map<String, Object>) eventPayload.getOrDefault("metadata", new HashMap<>());
            metadata.put("serverTimestamp", System.currentTimeMillis());
            metadata.put("javaVersion", System.getProperty("java.version"));
            metadata.put("environment", System.getProperty("spring.profiles.active", "development"));
            
            if (request != null) {
                eventPayload.put("userAgent", request.getHeader("User-Agent"));
                eventPayload.put("referrer", request.getHeader("Referer"));
                metadata.put("method", request.getMethod());
                metadata.put("path", request.getRequestURI());
                metadata.put("remoteAddr", request.getRemoteAddr());
            }
            
            eventPayload.put("metadata", metadata);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-User-Id", (String) payload.getOrDefault("userId", "system"));
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(eventPayload, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                baseUrl + "/api/events/track/" + eventName,
                entity,
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful()) {
                Map<String, Object> result = response.getBody();
                handleSuggestions((List<Map<String, Object>>) result.get("suggestions"));
            }
            
        } catch (Exception e) {
            logger.warn("Event tracking failed: " + e.getMessage());
        }
    }
    
    private void handleSuggestions(List<Map<String, Object>> suggestions) {
        if (suggestions != null && !suggestions.isEmpty()) {
            // Process AI suggestions
            logger.info("Received {} AI suggestions", suggestions.size());
            // Optionally store or act on suggestions
        }
    }
}

// Spring Boot Interceptor for automatic tracking
@Component
public class EventTrackingInterceptor implements HandlerInterceptor {
    
    private final EventTracker eventTracker;
    
    public EventTrackingInterceptor(EventTracker eventTracker) {
        this.eventTracker = eventTracker;
    }
    
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        long startTime = System.currentTimeMillis();
        request.setAttribute("startTime", startTime);
        
        String correlationId = "req-" + startTime + "-" + Math.abs(request.hashCode());
        request.setAttribute("correlationId", correlationId);
        
        Map<String, Object> payload = new HashMap<>();
        payload.put("correlationId", correlationId);
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("method", request.getMethod());
        metadata.put("path", request.getRequestURI());
        payload.put("metadata", metadata);
        
        eventTracker.track("api-request-received", payload, request);
        
        return true;
    }
    
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        Long startTime = (Long) request.getAttribute("startTime");
        String correlationId = (String) request.getAttribute("correlationId");
        
        if (startTime != null) {
            long duration = System.currentTimeMillis() - startTime;
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("correlationId", correlationId);
            payload.put("statusCode", response.getStatus());
            payload.put("responseTimeMs", duration);
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("method", request.getMethod());
            metadata.put("path", request.getRequestURI());
            if (ex != null) {
                metadata.put("exception", ex.getClass().getSimpleName());
            }
            payload.put("metadata", metadata);
            
            eventTracker.track("api-response-sent", payload, request);
        }
    }
}

// Usage in Spring Controller
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    private final EventTracker eventTracker;
    private final UserService userService;
    
    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody UserRequest userRequest, HttpServletRequest request) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("userId", userRequest.getEmail());
            payload.put("metadata", Map.of("source", "spring-api"));
            
            eventTracker.track("user-creation-attempt", payload, request);
            
            User user = userService.createUser(userRequest);
            
            payload.put("userId", user.getId());
            eventTracker.track("user-created", payload, request);
            
            return ResponseEntity.ok(user);
            
        } catch (Exception e) {
            Map<String, Object> errorPayload = new HashMap<>();
            errorPayload.put("metadata", Map.of("error", e.getMessage(), "source", "spring-api"));
            eventTracker.track("user-creation-failed", errorPayload, request);
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}
```

## Data Structures & Schema Reference

### Core Event Structure (StoredEvent)

```typescript
interface StoredEvent {
  id: string;                    // Unique event identifier
  name: string;                  // Event name (e.g., "user-login", "api-call")
  userId?: string | null;        // User identifier (can be null for system events)
  serviceName?: string;          // Service identifier for grouping
  payload: AIEventPayload;       // Event-specific data
  timestamp: number;             // Unix timestamp in milliseconds
}
```

### AI Event Payload Structure

```typescript
interface AIEventPayload {
  userAgent?: string;            // Browser/client user agent
  referrer?: string;             // Referring page/source
  sessionId?: string;            // Session identifier
  userRole?: string;             // User role/permissions level
  correlationId?: string;        // Group related events
  statusCode?: number;           // HTTP status code (for API events)
  responseTimeMs?: number;       // Response time in milliseconds
  serviceName?: string;          // Service identifier
  metadata?: Record<string, unknown>; // Additional custom data
}
```

### Event Response Structure

```typescript
interface TrackEventResponse {
  success: boolean;              // Whether tracking succeeded
  message?: string;              // Success/error message
  suggestions: AISuggestion[];   // AI-generated suggestions
  eventId: string;               // Unique event ID
  timestamp: string;             // ISO 8601 timestamp
}
```

### AI Suggestion Structure

```typescript
interface AISuggestion {
  id: string;                    // Unique suggestion ID
  title: string;                 // Suggestion title
  description?: string;          // Detailed description
  score?: number;                // Confidence score (0-1)
  action?: {                     // Suggested action
    label: string;               // Action button text
    href?: string;               // Action URL
    method?: "GET" | "POST" | "PUT" | "DELETE"; // HTTP method
  };
  tags?: string[];               // Categorization tags
  basedOn?: {                    // AI reasoning context
    eventPattern: string;        // Pattern description
    sampleSize: number;          // Number of events analyzed
    confidence: number;          // AI confidence level
  };
}
```

### Service Statistics Structure

```typescript
interface ServiceStats {
  serviceName: string;           // Service identifier
  eventCount: number;            // Total events for service
  uniqueEvents: number;          // Number of unique event types
  avgResponseTime?: number;      // Average response time (ms)
  errorRate?: number;            // Error percentage
  lastSeen: string;              // Last event timestamp
  topEvents: EventCount[];       // Most frequent events
}
```

### Batch Processing Structure

```typescript
interface BatchTrackEventRequest {
  batchId?: string;              // Optional batch identifier
  events: BatchTrackEventItem[]; // Array of events to process
}

interface BatchTrackEventItem {
  eventName: string;             // Event name
  payload?: AIEventPayload;      // Event payload
}
```

## AI Prompt Engineering Guide

### System Prompt Template for Event Analysis

```text
You are an AI assistant specialized in analyzing user behavior and system performance through event data. You have access to a comprehensive event tracking system with the following capabilities:

AVAILABLE DATA SOURCES:
- Real-time event streams (user interactions, API calls, system events)
- Historical event data with temporal patterns
- Service-specific analytics and performance metrics
- User journey and correlation data
- Error patterns and system health metrics

EVENT TYPES YOU CAN ANALYZE:
1. User Behavior Events: page-view, user-login, button-click, form-submit, search-query
2. API Performance Events: api-request-start, api-response-success, api-error
3. Business Events: purchase-completed, subscription-started, feature-used
4. System Events: error-occurred, performance-warning, health-check
5. Custom Events: Any application-specific events

ANALYSIS CAPABILITIES:
- Performance optimization suggestions
- User experience improvements
- Error prediction and prevention
- Business metric optimization
- Security anomaly detection
- Capacity planning recommendations

RESPONSE FORMAT:
Always provide structured responses with:
1. Analysis summary
2. Key insights and patterns
3. Actionable recommendations
4. Confidence level (0-1)
5. Supporting data points
6. Risk assessment if applicable

When analyzing events, consider:
- Temporal patterns (time of day, day of week, seasonal)
- User segmentation (role, location, device)
- Service dependencies and correlations
- Performance baselines and anomalies
- Business impact and KPI alignment
```

### Example AI Prompts for Different Analysis Types

#### 1. Performance Analysis Prompt

```text
Analyze the recent API performance data for the following services: {serviceNames}

Context:
- Time range: {timeRange}
- Current error rate: {errorRate}%
- Average response time: {avgResponseTime}ms
- Total requests: {requestCount}

Please provide:
1. Performance bottleneck identification
2. Service dependency impact analysis
3. Optimization recommendations with priority levels
4. Expected performance improvements
5. Implementation effort estimates

Focus on actionable insights that can improve system reliability and user experience.
```

#### 2. User Behavior Analysis Prompt

```text
Analyze user journey patterns for the event sequence: {eventNames}

User Context:
- User segment: {userRole}
- Session duration: {sessionDuration}
- Device/platform: {userAgent}
- Time period: {timeRange}

Analysis goals:
1. Identify conversion funnel bottlenecks
2. Detect user experience friction points
3. Suggest UX/UI improvements
4. Predict user churn risk
5. Recommend personalization opportunities

Provide insights that can drive user engagement and conversion improvements.
```

#### 3. Business Intelligence Prompt

```text
Generate business insights from the following metrics:

Event Data:
- Event types: {eventTypes}
- Service breakdown: {serviceStats}
- Time period: {timeRange}
- User segments: {userSegments}

Business Context:
- Revenue impact events: purchase-completed, subscription-started
- Engagement events: feature-used, page-view, session-duration
- Support events: error-occurred, help-requested

Required Analysis:
1. Revenue correlation with user events
2. Feature adoption patterns
3. Customer success indicators
4. Risk factors and early warning signals
5. Growth opportunity identification

Focus on insights that directly impact business KPIs and strategic decisions.
```

#### 4. Security Analysis Prompt

```text
Analyze the event stream for security anomalies and potential threats:

Security Context:
- Failed login attempts: {failedLogins}
- Unusual access patterns: {anomalousEvents}
- Error patterns: {errorEvents}
- Time frame: {timeRange}

Security Analysis Requirements:
1. Identify potential security threats
2. Detect unusual user behavior patterns
3. Flag suspicious API access attempts
4. Assess data breach risk indicators
5. Recommend security improvements

Provide threat severity levels and recommended immediate actions for any identified risks.
```

### AI Training Data Structure

For training ML models on this event data, use the following feature extraction approach:

```typescript
interface MLFeatureSet {
  // Temporal features
  hour_of_day: number;           // 0-23
  day_of_week: number;           // 0-6
  is_weekend: boolean;
  is_business_hours: boolean;
  
  // User features
  user_role: string;             // categorical
  session_duration: number;      // minutes
  events_per_session: number;
  user_tenure_days: number;
  
  // Service features
  service_name: string;          // categorical
  avg_response_time: number;     // milliseconds
  error_rate: number;            // percentage
  request_volume: number;
  
  // Event sequence features
  event_name: string;            // categorical
  event_frequency: number;       // events per hour
  correlation_chain_length: number;
  time_since_last_event: number; // seconds
  
  // Performance features
  response_time_percentile: number; // vs historical
  error_count_last_hour: number;
  success_rate: number;          // percentage
  
  // Business features
  revenue_impact: number;        // estimated value
  conversion_probability: number; // 0-1
  churn_risk_score: number;      // 0-1
  engagement_score: number;      // 0-1
}
```

### Consuming Real-time Data for AI

```typescript
// Real-time AI processing pipeline
class AIEventProcessor {
  private eventBuffer: StoredEvent[] = [];
  private aiModel: MLModel;
  
  async processRealTimeEvents() {
    const eventSource = new EventSource('/api/events/stream');
    
    eventSource.onmessage = async (event) => {
      const streamEvent = JSON.parse(event.data);
      
      if (streamEvent.type === 'event') {
        const eventData = streamEvent.data as StoredEvent;
        
        // Add to processing buffer
        this.eventBuffer.push(eventData);
        
        // Process when buffer reaches threshold
        if (this.eventBuffer.length >= 10) {
          await this.runAIAnalysis();
          this.eventBuffer = [];
        }
        
        // Real-time anomaly detection
        await this.detectAnomalies(eventData);
      }
    };
  }
  
  private async runAIAnalysis() {
    const features = this.extractFeatures(this.eventBuffer);
    const predictions = await this.aiModel.predict(features);
    
    // Generate suggestions based on predictions
    const suggestions = this.generateSuggestions(predictions);
    
    // Send suggestions back to the system
    await this.sendSuggestions(suggestions);
  }
  
  private async detectAnomalies(event: StoredEvent) {
    // Real-time anomaly detection logic
    const isAnomalous = await this.aiModel.detectAnomaly(event);
    
    if (isAnomalous) {
      await this.alertSecurityTeam(event);
    }
  }
}
```

### AI Model Training Recommendations

1. **Data Preparation:**
   - Use rolling 7-day windows for training data
   - Include seasonal patterns (weekly, monthly cycles)
   - Balance classes for classification tasks
   - Feature engineering for temporal patterns

2. **Model Architecture:**
   - Time series models for performance prediction
   - Classification models for anomaly detection
   - Recommendation engines for user experience
   - Clustering for user segmentation

3. **Evaluation Metrics:**
   - Performance models: MAE, RMSE for response time prediction
   - Anomaly detection: Precision, Recall, F1-score
   - User behavior: Conversion rate improvement
   - Business impact: Revenue correlation

4. **Production Deployment:**
   - Real-time inference for critical events
   - Batch processing for historical analysis
   - A/B testing for suggestion effectiveness
   - Continuous model retraining pipeline

## Analytics and Querying for AI Systems

### Time-based Analysis for AI Training

```javascript
// Advanced temporal pattern analysis
class TemporalAnalyzer {
  async analyzePatterns(timeRange = '7d') {
    const response = await fetch(`/api/events?from=${this.getTimeRangeStart(timeRange)}&limit=10000`);
    const { events } = await response.json();
    
    return {
      hourlyPatterns: this.extractHourlyPatterns(events),
      dailyTrends: this.extractDailyTrends(events),
      weeklySeasonality: this.extractWeeklyPatterns(events),
      anomalies: this.detectTemporalAnomalies(events),
      correlations: this.findEventCorrelations(events)
    };
  }
  
  extractHourlyPatterns(events) {
    const hourlyData = events.reduce((acc, event) => {
      const hour = new Date(event.timestamp).getHours();
      const service = event.serviceName || 'unknown';
      
      if (!acc[service]) acc[service] = new Array(24).fill(0);
      acc[service][hour]++;
      
      return acc;
    }, {});
    
    // Calculate peak hours and off-peak patterns
    return Object.entries(hourlyData).map(([service, hours]) => ({
      serviceName: service,
      peakHour: hours.indexOf(Math.max(...hours)),
      avgHourlyVolume: hours.reduce((sum, h) => sum + h, 0) / 24,
      hourlyDistribution: hours,
      variance: this.calculateVariance(hours)
    }));
  }
  
  findEventCorrelations(events) {
    const correlations = {};
    const correlationGroups = this.groupEventsByCorrelationId(events);
    
    Object.values(correlationGroups).forEach(group => {
      if (group.length > 1) {
        const eventSequence = group.sort((a, b) => a.timestamp - b.timestamp);
        this.updateCorrelationMatrix(correlations, eventSequence);
      }
    });
    
    return correlations;
  }
}

// Service-specific performance analysis
async function analyzeServicePerformance(serviceName, timeRange = '24h') {
  const response = await fetch(`/api/events/services?serviceName=${serviceName}&from=${timeRange}`);
  const serviceData = await response.json();
  
  return {
    performanceMetrics: {
      avgResponseTime: serviceData.avgResponseTime,
      p95ResponseTime: this.calculatePercentile(serviceData.responseTimes, 95),
      errorRate: serviceData.errorRate,
      throughput: serviceData.eventCount / this.getHoursInRange(timeRange)
    },
    trends: {
      responseTimeTrend: this.calculateTrend(serviceData.historicalResponseTimes),
      errorRateTrend: this.calculateTrend(serviceData.historicalErrorRates),
      volumeTrend: this.calculateTrend(serviceData.historicalVolumes)
    },
    recommendations: await this.generatePerformanceRecommendations(serviceData)
  };
}

// User journey analysis for conversion optimization
async function analyzeUserJourneys(timeRange = '7d') {
  const response = await fetch(`/api/events?from=${timeRange}&limit=50000`);
  const { events } = await response.json();
  
  const journeys = this.groupEventsByUser(events);
  
  return {
    conversionFunnels: this.analyzeConversionFunnels(journeys),
    dropoffPoints: this.identifyDropoffPoints(journeys),
    successPatterns: this.findSuccessPatterns(journeys),
    segmentAnalysis: this.analyzeUserSegments(journeys),
    predictiveInsights: await this.generatePredictiveInsights(journeys)
  };
}

// Real-time anomaly detection
class AnomalyDetector {
  constructor() {
    this.baselineMetrics = new Map();
    this.anomalyThresholds = {
      responseTime: 2.0,  // 2 standard deviations
      errorRate: 3.0,     // 3 standard deviations
      volume: 2.5         // 2.5 standard deviations
    };
  }
  
  async detectAnomalies(recentEvents) {
    const anomalies = [];
    
    // Group events by service for analysis
    const serviceEvents = this.groupEventsByService(recentEvents);
    
    for (const [serviceName, events] of serviceEvents) {
      const baseline = await this.getBaseline(serviceName);
      const current = this.calculateCurrentMetrics(events);
      
      // Response time anomalies
      if (this.isAnomalous(current.avgResponseTime, baseline.avgResponseTime, baseline.responseTimeStdDev, this.anomalyThresholds.responseTime)) {
        anomalies.push({
          type: 'performance',
          serviceName,
          metric: 'responseTime',
          current: current.avgResponseTime,
          baseline: baseline.avgResponseTime,
          severity: this.calculateSeverity(current.avgResponseTime, baseline.avgResponseTime, baseline.responseTimeStdDev),
          suggestion: 'Consider scaling resources or investigating performance bottlenecks'
        });
      }
      
      // Error rate anomalies
      if (this.isAnomalous(current.errorRate, baseline.errorRate, baseline.errorRateStdDev, this.anomalyThresholds.errorRate)) {
        anomalies.push({
          type: 'reliability',
          serviceName,
          metric: 'errorRate',
          current: current.errorRate,
          baseline: baseline.errorRate,
          severity: this.calculateSeverity(current.errorRate, baseline.errorRate, baseline.errorRateStdDev),
          suggestion: 'Investigate recent deployments or external dependencies'
        });
      }
    }
    
    return anomalies;
  }
}
```

### Advanced ML Feature Engineering

```python
# Python feature engineering for ML models
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class EventFeatureExtractor:
    def __init__(self):
        self.feature_cache = {}
    
    def extract_features(self, events_df):
        """Extract comprehensive features from event data for ML training"""
        
        features = pd.DataFrame()
        
        # Temporal features
        features['hour'] = pd.to_datetime(events_df['timestamp']).dt.hour
        features['day_of_week'] = pd.to_datetime(events_df['timestamp']).dt.dayofweek
        features['is_weekend'] = features['day_of_week'].isin([5, 6])
        features['is_business_hours'] = features['hour'].between(9, 17)
        
        # Service-based features
        features['service_name'] = events_df['serviceName'].fillna('unknown')
        features['response_time'] = events_df['responseTimeMs'].fillna(0)
        features['status_code'] = events_df['statusCode'].fillna(200)
        features['is_error'] = features['status_code'] >= 400
        
        # User behavior features
        features['session_id'] = events_df['sessionId']
        features['user_role'] = events_df['userRole'].fillna('anonymous')
        features['correlation_id'] = events_df['correlationId']
        
        # Sequence features
        features['events_per_session'] = features.groupby('session_id')['session_id'].transform('count')
        features['time_since_session_start'] = self.calculate_session_time_features(events_df)
        features['event_sequence_position'] = features.groupby('session_id').cumcount() + 1
        
        # Statistical features
        features['response_time_zscore'] = self.calculate_zscore(features['response_time'], features['service_name'])
        features['volume_zscore'] = self.calculate_volume_zscore(events_df)
        
        # Interaction features
        features['service_user_interaction'] = features['service_name'] + '_' + features['user_role']
        features['hour_service_interaction'] = features['hour'].astype(str) + '_' + features['service_name']
        
        # Business value features
        features['estimated_revenue_impact'] = self.estimate_revenue_impact(events_df)
        features['user_engagement_score'] = self.calculate_engagement_score(events_df)
        features['conversion_probability'] = self.predict_conversion_probability(events_df)
        
        return features
    
    def calculate_session_time_features(self, events_df):
        """Calculate time-based session features"""
        session_starts = events_df.groupby('sessionId')['timestamp'].min()
        return events_df.apply(lambda row: 
            (pd.to_datetime(row['timestamp']) - pd.to_datetime(session_starts[row['sessionId']])).total_seconds() / 60,
            axis=1
        )
    
    def estimate_revenue_impact(self, events_df):
        """Estimate revenue impact based on event patterns"""
        revenue_weights = {
            'purchase-completed': 100.0,
            'subscription-started': 50.0,
            'premium-feature-used': 10.0,
            'support-ticket-created': -5.0,
            'user-churned': -25.0
        }
        
        return events_df['name'].map(revenue_weights).fillna(0)
    
    def prepare_training_data(self, events_df, target_column='conversion'):
        """Prepare data for ML model training"""
        features = self.extract_features(events_df)
        
        # Handle categorical variables
        categorical_cols = ['service_name', 'user_role', 'service_user_interaction', 'hour_service_interaction']
        features_encoded = pd.get_dummies(features, columns=categorical_cols, prefix=categorical_cols)
        
        # Normalize numerical features
        numerical_cols = ['response_time', 'events_per_session', 'time_since_session_start', 'estimated_revenue_impact']
        features_encoded[numerical_cols] = (features_encoded[numerical_cols] - features_encoded[numerical_cols].mean()) / features_encoded[numerical_cols].std()
        
        # Prepare target variable if available
        if target_column in events_df.columns:
            target = events_df[target_column]
            return features_encoded, target
        
        return features_encoded

# Model training example
class EventPredictionModel:
    def __init__(self):
        self.models = {}
        self.feature_extractor = EventFeatureExtractor()
    
    def train_performance_model(self, training_data):
        """Train a model to predict API response times"""
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_error, r2_score
        
        features = self.feature_extractor.extract_features(training_data)
        target = training_data['responseTimeMs']
        
        X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2, random_state=42)
        
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        # Evaluate model
        predictions = model.predict(X_test)
        mae = mean_absolute_error(y_test, predictions)
        r2 = r2_score(y_test, predictions)
        
        self.models['performance'] = {
            'model': model,
            'mae': mae,
            'r2': r2,
            'feature_importance': dict(zip(features.columns, model.feature_importances_))
        }
        
        return self.models['performance']
    
    def train_anomaly_model(self, training_data):
        """Train an anomaly detection model"""
        from sklearn.ensemble import IsolationForest
        
        features = self.feature_extractor.extract_features(training_data)
        
        model = IsolationForest(contamination=0.1, random_state=42)
        model.fit(features)
        
        self.models['anomaly'] = model
        return model
    
    def predict_performance(self, event_data):
        """Predict response time for new events"""
        if 'performance' not in self.models:
            raise ValueError("Performance model not trained")
        
        features = self.feature_extractor.extract_features(event_data)
        predictions = self.models['performance']['model'].predict(features)
        
        return predictions
    
    def detect_anomalies(self, event_data):
        """Detect anomalies in new events"""
        if 'anomaly' not in self.models:
            raise ValueError("Anomaly model not trained")
        
        features = self.feature_extractor.extract_features(event_data)
        anomaly_scores = self.models['anomaly'].decision_function(features)
        is_anomaly = self.models['anomaly'].predict(features) == -1
        
        return anomaly_scores, is_anomaly
```

### AI-Powered Insights and Recommendations

```typescript
// AI insights generation service
class AIInsightsEngine {
  private mlModels: Map<string, any> = new Map();
  private insightCache: Map<string, any> = new Map();
  
  async generateInsights(timeRange: string = '24h'): Promise<AIInsight[]> {
    const [events, serviceStats, userJourneys] = await Promise.all([
      this.fetchEvents(timeRange),
      this.fetchServiceStatistics(timeRange),
      this.fetchUserJourneys(timeRange)
    ]);
    
    const insights: AIInsight[] = [];
    
    // Performance insights
    insights.push(...await this.generatePerformanceInsights(serviceStats));
    
    // User experience insights
    insights.push(...await this.generateUXInsights(userJourneys));
    
    // Business insights
    insights.push(...await this.generateBusinessInsights(events));
    
    // Security insights
    insights.push(...await this.generateSecurityInsights(events));
    
    // Predictive insights
    insights.push(...await this.generatePredictiveInsights(events));
    
    return insights.sort((a, b) => b.priority - a.priority);
  }
  
  private async generatePerformanceInsights(serviceStats: ServiceStats[]): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    for (const service of serviceStats) {
      // High response time insight
      if (service.avgResponseTime > 500) {
        insights.push({
          id: `perf-${service.serviceName}-response-time`,
          type: 'performance',
          priority: 0.9,
          title: `High Response Time in ${service.serviceName}`,
          description: `Average response time of ${service.avgResponseTime}ms exceeds recommended threshold of 500ms`,
          recommendations: [
            'Implement caching for frequently accessed data',
            'Optimize database queries',
            'Consider horizontal scaling',
            'Review third-party API dependencies'
          ],
          impact: {
            userExperience: 0.8,
            businessMetrics: 0.6,
            technicalDebt: 0.7
          },
          confidence: 0.95,
          dataPoints: {
            current: service.avgResponseTime,
            threshold: 500,
            trend: await this.calculateResponseTimeTrend(service.serviceName)
          }
        });
      }
      
      // Error rate insight
      if (service.errorRate > 5) {
        insights.push({
          id: `reliability-${service.serviceName}-error-rate`,
          type: 'reliability',
          priority: 0.95,
          title: `High Error Rate in ${service.serviceName}`,
          description: `Error rate of ${service.errorRate}% indicates potential reliability issues`,
          recommendations: [
            'Implement circuit breakers',
            'Add comprehensive error handling',
            'Review recent deployments',
            'Monitor upstream dependencies'
          ],
          impact: {
            userExperience: 0.9,
            businessMetrics: 0.8,
            technicalDebt: 0.6
          },
          confidence: 0.9
        });
      }
    }
    
    return insights;
  }
  
  private async generateUXInsights(userJourneys: UserJourney[]): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    // Analyze conversion funnels
    const conversionData = this.analyzeConversionFunnels(userJourneys);
    
    if (conversionData.dropoffRate > 0.3) {
      insights.push({
        id: 'ux-conversion-dropoff',
        type: 'user-experience',
        priority: 0.85,
        title: 'High User Dropoff Detected',
        description: `${(conversionData.dropoffRate * 100).toFixed(1)}% of users are dropping off in the conversion funnel`,
        recommendations: [
          'Simplify the registration process',
          'Add progress indicators',
          'Implement exit-intent surveys',
          'A/B test different flow variations'
        ],
        impact: {
          userExperience: 0.9,
          businessMetrics: 0.95,
          technicalDebt: 0.3
        },
        confidence: 0.8,
        dataPoints: {
          dropoffStage: conversionData.primaryDropoffStage,
          affectedUsers: conversionData.affectedUserCount
        }
      });
    }
    
    return insights;
  }
  
  private async generatePredictiveInsights(events: StoredEvent[]): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    // Predict system capacity needs
    const capacityPrediction = await this.predictCapacityNeeds(events);
    
    if (capacityPrediction.daysUntilCapacityLimit < 30) {
      insights.push({
        id: 'capacity-prediction',
        type: 'predictive',
        priority: 0.8,
        title: 'Capacity Limit Approaching',
        description: `Current growth trends suggest capacity limits will be reached in ${capacityPrediction.daysUntilCapacityLimit} days`,
        recommendations: [
          'Plan infrastructure scaling',
          'Implement auto-scaling policies',
          'Optimize resource utilization',
          'Consider load balancing improvements'
        ],
        impact: {
          userExperience: 0.7,
          businessMetrics: 0.8,
          technicalDebt: 0.5
        },
        confidence: capacityPrediction.confidence
      });
    }
    
    return insights;
  }
}

interface AIInsight {
  id: string;
  type: 'performance' | 'reliability' | 'user-experience' | 'business' | 'security' | 'predictive';
  priority: number; // 0-1, higher is more important
  title: string;
  description: string;
  recommendations: string[];
  impact: {
    userExperience: number; // 0-1
    businessMetrics: number; // 0-1
    technicalDebt: number; // 0-1
  };
  confidence: number; // 0-1
  dataPoints?: Record<string, any>;
  actions?: {
    label: string;
    url?: string;
    apiCall?: {
      endpoint: string;
      method: string;
      payload?: any;
    };
  }[];
}
```

This comprehensive guide now provides complete information for AI systems to consume the event tracking data, including:

1. **Complete API documentation** with all endpoints, request/response structures
2. **Frontend integration examples** for React, Vue.js, and vanilla JavaScript
3. **Backend integration examples** for Node.js, Python, and Java
4. **Detailed data structures** and TypeScript interfaces
5. **AI prompt engineering templates** for different analysis types
6. **ML feature engineering** examples and training data preparation
7. **Advanced analytics capabilities** for real-time insights
8. **Service organization** and naming conventions
9. **Real-time streaming** consumption patterns
10. **Comprehensive examples** for both pushing data to and consuming data from the system

The guide is structured to help AI systems understand how to effectively integrate with, consume data from, and generate insights using this event tracking platform.

## CORS Configuration & Cross-Origin Setup

### Automatic CORS Handling

The system includes comprehensive CORS support for cross-origin event ingestion:

```typescript
// Global middleware automatically handles CORS for all API routes
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Monitor-Request, X-User-Id, X-Session-Id, X-Correlation-Id, Accept, Origin, User-Agent, Referer',
  'Access-Control-Allow-Credentials': 'false',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};
```

### Cross-Port Configuration

If you have multiple applications running on different ports (e.g., your main app on port 3000 sending events to the tracking server on port 3001):

**Start the tracking server on a specific port:**
```bash
PORT=3001 npm run dev
# Server will be available at http://localhost:3001
```

**Configure your client application to send events:**
```javascript
// From your app running on port 3000
const TRACKING_API_URL = 'http://localhost:3001';

async function trackEvent(eventName, payload) {
  const response = await fetch(`${TRACKING_API_URL}/api/events/track/${eventName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getCurrentUserId()
    },
    body: JSON.stringify(payload)
  });
  
  return await response.json();
}
```

### CORS Testing

A comprehensive test page is available at `/test-cors.html` to verify CORS functionality:

1. **Access the test page:** `http://localhost:3001/test-cors.html`
2. **Configure API URL:** Set to `http://localhost:3001` (or your tracking server URL)
3. **Run tests:** Click each test button to verify:
   - Single event tracking
   - Batch event tracking
   - Event retrieval
   - Real-time event streaming

### Troubleshooting CORS Issues

**Common CORS Error Messages:**
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource
Reason: CORS request did not succeed
```

**Solutions:**

1. **Verify Server is Running:**
   ```bash
   netstat -aon | findstr :3001  # Check if port 3001 is listening
   ```

2. **Check Console Logs:**
   The middleware logs all API requests with origin information:
   ```
   API Request: POST /api/events/track/user-visit-homepage from origin: http://localhost:3000
   CORS preflight for /api/events/track/user-visit-homepage from origin: http://localhost:3000
   ```

3. **Test with curl:**
   ```bash
   # Test preflight request
   curl -X OPTIONS \
     -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -v http://localhost:3001/api/events/track/test-event

   # Test actual request
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:3000" \
     -d '{"serviceName":"test","metadata":{"test":true}}' \
     -v http://localhost:3001/api/events/track/test-event
   ```

4. **Browser Network Tab:**
   - Check if OPTIONS preflight request succeeds (status 200)
   - Verify CORS headers are present in response
   - Look for specific error messages in browser console

### Production CORS Configuration

For production environments, consider restricting origins:

```typescript
// In middleware.ts or individual route files
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
  // ... other headers
};
```

**Environment Variables:**
```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## Security Considerations

### Content Security Policy
The system includes CSP headers to allow script execution:
```javascript
"Content-Security-Policy": "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: data:"
```

### Rate Limiting
Consider implementing rate limiting for production:
```typescript
// Example rate limiting middleware
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP'
};
```

### Authentication
For sensitive environments, add authentication:
```typescript
// Add to headers for authenticated requests
headers: {
  'Authorization': 'Bearer your-jwt-token',
  'X-API-Key': 'your-api-key'
}
```
