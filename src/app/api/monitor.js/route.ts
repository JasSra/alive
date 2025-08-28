import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Get the origin from the request
  const origin = request.headers.get('origin') || 
                 request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 
                 `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  // Generate the monitor script with dynamic configuration
  const monitorScript = `/**
 * Live Network Monitor - Self-Contained Browser Script
 * Auto-configured for origin: ${origin}
 * Usage: Load via <script src="${origin}/api/monitor.js"></script>
 * 
 * Captures all network requests, events, and posts them to the server
 * Shows live data for configurable time windows (T-5M, T-20M, etc.)
 */

(function() {
  'use strict';

  // Auto-detected Configuration
  const DETECTED_ORIGIN = '${origin}';
  
  // Configuration
  const CONFIG = {
    serverUrl: DETECTED_ORIGIN + '/api/events',
    sseUrl: DETECTED_ORIGIN + '/api/events/stream',
    userId: 'browser-monitor',
    serviceName: null, // Service identifier for grouping events
    batchSize: 10,
    flushInterval: 2000, // 2 seconds
    maxRetries: 3,
    timeWindows: [
      { label: 'T-5M', minutes: 5 },
      { label: 'T-20M', minutes: 20 },
      { label: 'T-1H', minutes: 60 },
      { label: 'T-6H', minutes: 360 }
    ],
    defaultWindow: 5, // minutes
    corsMode: 'cors',
    credentials: 'omit',
    hiddenMode: true, // Start in hidden mode
    debugStyle: true  // Use debug tool styling
  };

  // Global state
  let isMonitoring = false;
  let eventQueue = [];
  let capturedEvents = [];
  let monitorUI = null;
  let currentTimeWindow = CONFIG.defaultWindow;
  let flushTimer = null;
  let isHidden = CONFIG.hiddenMode;

  // Utility functions
  const generateId = () => Math.random().toString(36).substr(2, 9);
  const timestamp = () => new Date().toISOString();
  const now = () => Date.now();

  // Time window calculations
  const getTimeWindow = (minutes) => {
    const toTime = now();
    const fromTime = toTime - (minutes * 60 * 1000);
    return { from: fromTime, to: toTime };
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString() + '.' + d.getMilliseconds().toString().padStart(3, '0');
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return \`\${ms}ms\`;
    if (ms < 60000) return \`\${(ms/1000).toFixed(1)}s\`;
    return \`\${(ms/60000).toFixed(1)}m\`;
  };

  // Event capture functions
  const createEvent = (type, name, data = {}) => ({
    id: generateId(),
    type,
    name,
    timestamp: timestamp(),
    timestampMs: now(),
    userId: CONFIG.userId,
    serviceName: CONFIG.serviceName || window.location.hostname || 'unknown',
    url: window.location.href,
    userAgent: navigator.userAgent,
    origin: DETECTED_ORIGIN,
    ...data
  });

  // Network request interceptor
  const interceptNetworkRequests = () => {
    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const startTime = now();
      const url = args[0];
      const options = args[1] || {};
      const correlationId = generateId();

      // Log request
      const requestEvent = createEvent('network-request', 'fetch', {
        correlationId,
        method: options.method || 'GET',
        url: url.toString(),
        headers: options.headers,
        hasBody: !!options.body
      });
      queueEvent(requestEvent);

      try {
        const response = await originalFetch.apply(this, args);
        const endTime = now();
        
        // Log response
        const responseEvent = createEvent('network-response', 'fetch', {
          correlationId,
          statusCode: response.status,
          statusText: response.statusText,
          url: url.toString(),
          responseTimeMs: endTime - startTime,
          headers: Object.fromEntries(response.headers.entries())
        });
        queueEvent(responseEvent);

        return response;
      } catch (error) {
        const endTime = now();
        
        // Log error
        const errorEvent = createEvent('network-error', 'fetch', {
          correlationId,
          error: error.message,
          url: url.toString(),
          responseTimeMs: endTime - startTime
        });
        queueEvent(errorEvent);

        throw error;
      }
    };

    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this._monitorData = {
        method,
        url: url.toString(),
        startTime: now(),
        correlationId: generateId()
      };
      return originalXHROpen.apply(this, [method, url, ...args]);
    };

    XMLHttpRequest.prototype.send = function(body) {
      if (this._monitorData) {
        const { correlationId, method, url } = this._monitorData;
        
        // Log request
        const requestEvent = createEvent('network-request', 'xhr', {
          correlationId,
          method,
          url,
          hasBody: !!body
        });
        queueEvent(requestEvent);

        // Set up response handlers
        const originalOnload = this.onload;
        const originalOnerror = this.onerror;

        this.onload = function() {
          const endTime = now();
          const responseEvent = createEvent('network-response', 'xhr', {
            correlationId,
            statusCode: this.status,
            statusText: this.statusText,
            url,
            responseTimeMs: endTime - this._monitorData.startTime
          });
          queueEvent(responseEvent);
          
          if (originalOnload) originalOnload.apply(this, arguments);
        };

        this.onerror = function() {
          const endTime = now();
          const errorEvent = createEvent('network-error', 'xhr', {
            correlationId,
            error: 'Network error',
            url,
            responseTimeMs: endTime - this._monitorData.startTime
          });
          queueEvent(errorEvent);
          
          if (originalOnerror) originalOnerror.apply(this, arguments);
        };
      }

      return originalXHRSend.apply(this, arguments);
    };
  };

  // DOM event interceptor
  const interceptDOMEvents = () => {
    const eventTypes = ['click', 'scroll', 'keydown', 'focus', 'blur', 'submit'];
    
    eventTypes.forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        const event = createEvent('dom-event', eventType, {
          target: e.target.tagName,
          targetId: e.target.id,
          targetClass: e.target.className,
          x: e.clientX,
          y: e.clientY
        });
        queueEvent(event);
      }, true);
    });

    // Page visibility changes
    document.addEventListener('visibilitychange', () => {
      const event = createEvent('page-event', 'visibility-change', {
        hidden: document.hidden
      });
      queueEvent(event);
    });

    // Page navigation
    window.addEventListener('beforeunload', () => {
      const event = createEvent('page-event', 'page-unload', {});
      queueEvent(event);
      flushEvents(); // Immediate flush on page unload
    });
  };

  // Console interceptor
  const interceptConsole = () => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = function(...args) {
      // Don't capture our own monitor logs
      const message = args.join(' ');
      if (!message.includes('[Monitor]')) {
        const event = createEvent('console-event', 'log', {
          message: args.join(' ')
        });
        queueEvent(event);
      }
      return originalLog.apply(this, args);
    };

    console.error = function(...args) {
      const message = args.join(' ');
      if (!message.includes('[Monitor]')) {
        const event = createEvent('console-event', 'error', {
          message: args.join(' ')
        });
        queueEvent(event);
      }
      return originalError.apply(this, args);
    };

    console.warn = function(...args) {
      const message = args.join(' ');
      if (!message.includes('[Monitor]')) {
        const event = createEvent('console-event', 'warn', {
          message: args.join(' ')
        });
        queueEvent(event);
      }
      return originalWarn.apply(this, args);
    };
  };

  // Event queue management
  const queueEvent = (event) => {
    eventQueue.push(event);
    capturedEvents.push(event);
    
    // Keep only events within the maximum time window
    const maxWindow = Math.max(...CONFIG.timeWindows.map(w => w.minutes));
    const cutoff = now() - (maxWindow * 60 * 1000);
    capturedEvents = capturedEvents.filter(e => e.timestampMs > cutoff);

    if (monitorUI) {
      updateUI();
    }

    if (eventQueue.length >= CONFIG.batchSize) {
      flushEvents();
    }
  };

  // Send events to server
  const flushEvents = async () => {
    if (eventQueue.length === 0) return;

    const eventsToSend = [...eventQueue];
    eventQueue = [];

    // Log our own network request
    const networkStartTime = now();
    const correlationId = generateId();
    
    // Create monitor request event (but don't queue it to avoid infinite loop)
    const monitorRequestEvent = createEvent('monitor-network', 'monitor-request', {
      correlationId,
      url: CONFIG.serverUrl,
      method: 'POST',
      eventCount: eventsToSend.length,
      timestamp: timestamp()
    });

    try {
      const response = await fetch(CONFIG.serverUrl, {
        method: 'POST',
        mode: CONFIG.corsMode,
        credentials: CONFIG.credentials,
        headers: {
          'Content-Type': 'application/json',
          'X-Monitor-Request': 'true', // Mark as monitor request
        },
        body: JSON.stringify({ events: eventsToSend })
      });

      const networkEndTime = now();
      const responseTime = networkEndTime - networkStartTime;

      if (!response.ok) {
        // Log monitor network error
        const errorEvent = createEvent('monitor-network', 'monitor-error', {
          correlationId,
          statusCode: response.status,
          statusText: response.statusText,
          responseTimeMs: responseTime,
          error: \`Server responded with \${response.status}: \${response.statusText}\`,
          url: CONFIG.serverUrl
        });
        
        // Store monitor errors in a separate array to display in UI
        if (!window.monitorErrors) window.monitorErrors = [];
        window.monitorErrors.push(errorEvent);
        if (window.monitorErrors.length > 10) window.monitorErrors.shift(); // Keep only last 10
        
        throw new Error(\`Server responded with \${response.status}: \${response.statusText}\`);
      }

      const result = await response.json();
      
      // Log successful monitor network response
      const successEvent = createEvent('monitor-network', 'monitor-success', {
        correlationId,
        statusCode: response.status,
        responseTimeMs: responseTime,
        eventsSent: eventsToSend.length,
        totalProcessed: result.total,
        url: CONFIG.serverUrl
      });
      
      // Store monitor successes for UI display
      if (!window.monitorLogs) window.monitorLogs = [];
      window.monitorLogs.push(successEvent);
      if (window.monitorLogs.length > 20) window.monitorLogs.shift(); // Keep only last 20
      
      // Only log in debug mode
      if (!isHidden) {
        console.log(\`[Monitor] ✅ Sent \${eventsToSend.length} events (\${responseTime}ms) - Total: \${result.total}\`);
      }
    } catch (error) {
      const networkEndTime = now();
      const responseTime = networkEndTime - networkStartTime;
      
      // Log monitor network error
      const errorEvent = createEvent('monitor-network', 'monitor-error', {
        correlationId,
        error: error.message,
        responseTimeMs: responseTime,
        url: CONFIG.serverUrl,
        retryAttempt: eventsToSend[0]?.retryCount || 0
      });
      
      if (!window.monitorErrors) window.monitorErrors = [];
      window.monitorErrors.push(errorEvent);
      if (window.monitorErrors.length > 10) window.monitorErrors.shift();
      
      console.error(\`[Monitor] ❌ Failed to send events to \${CONFIG.serverUrl}:\`, error);
      
      // Re-queue events for retry (with limit)
      if (eventsToSend[0]?.retryCount < CONFIG.maxRetries) {
        eventsToSend.forEach(event => {
          event.retryCount = (event.retryCount || 0) + 1;
          eventQueue.push(event);
        });
        console.warn(\`[Monitor] 🔄 Retrying \${eventsToSend.length} events (attempt \${(eventsToSend[0]?.retryCount || 0) + 1}/\${CONFIG.maxRetries})\`);
      } else {
        console.warn(\`[Monitor] 🗑️ Dropping \${eventsToSend.length} events after \${CONFIG.maxRetries} retries\`);
      }
    }
  };

  // Debug-style UI Creation
  const createUI = () => {
    // Remove existing UI if present
    if (monitorUI) {
      monitorUI.remove();
    }

    const ui = document.createElement('div');
    ui.id = 'network-monitor-ui';
    ui.style.display = isHidden ? 'none' : 'block';
    ui.innerHTML = \`
      <style>
        #network-monitor-ui {
          position: fixed;
          top: 10px;
          right: 10px;
          width: 420px;
          max-height: 85vh;
          background: #0d1117;
          color: #c9d1d9;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', monospace;
          font-size: 10px;
          border: 1px solid #30363d;
          border-radius: 6px;
          z-index: 999999;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
        }
        .monitor-header {
          background: linear-gradient(90deg, #21262d 0%, #161b22 100%);
          padding: 6px 10px;
          border-bottom: 1px solid #30363d;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: move;
        }
        .monitor-title {
          font-weight: 600;
          color: #7c3aed;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .monitor-title::before {
          content: "●";
          color: #10b981;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .monitor-controls {
          display: flex;
          gap: 3px;
        }
        .monitor-btn {
          background: #21262d;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 2px 6px;
          font-size: 9px;
          cursor: pointer;
          border-radius: 3px;
          transition: all 0.15s;
        }
        .monitor-btn:hover {
          background: #30363d;
          border-color: #58a6ff;
        }
        .monitor-btn.active {
          background: #1f6feb;
          border-color: #1f6feb;
          color: white;
        }
        .monitor-btn.danger {
          background: #da3633;
          border-color: #da3633;
          color: white;
        }
        .monitor-btn.danger:hover {
          background: #b62324;
        }
        .time-windows {
          display: flex;
          gap: 2px;
          margin: 6px 8px;
          padding: 4px;
          background: #161b22;
          border-radius: 4px;
        }
        .window-btn {
          background: #21262d;
          border: 1px solid #30363d;
          color: #8b949e;
          padding: 2px 6px;
          font-size: 8px;
          cursor: pointer;
          border-radius: 2px;
          transition: all 0.15s;
          min-width: 32px;
          text-align: center;
        }
        .window-btn:hover {
          background: #30363d;
          color: #c9d1d9;
        }
        .window-btn.active {
          background: #fd7e14;
          border-color: #fd7e14;
          color: #000;
          font-weight: 600;
        }
        .monitor-content {
          padding: 8px;
          max-height: 65vh;
          overflow-y: auto;
        }
        .stats-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 4px 6px;
          background: #161b22;
          border-radius: 3px;
          font-size: 9px;
          border-left: 3px solid #fd7e14;
        }
        .stats-row span {
          color: #58a6ff;
        }
        .stats-row span:last-child {
          color: #7c3aed;
        }
        .event-list {
          max-height: 350px;
          overflow-y: auto;
          border: 1px solid #30363d;
          border-radius: 3px;
          background: #0d1117;
        }
        .event-item {
          padding: 3px 6px;
          border-bottom: 1px solid #21262d;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
          transition: background 0.15s;
        }
        .event-item:hover {
          background: #161b22;
        }
        .event-type {
          color: #7ee787;
          font-weight: 500;
          font-family: monospace;
        }
        .event-name {
          color: #f0883e;
          margin-left: 4px;
        }
        .event-time {
          color: #6e7681;
          font-size: 8px;
          font-family: monospace;
        }
        .event-status {
          font-size: 8px;
          padding: 1px 3px;
          border-radius: 2px;
          font-weight: 500;
        }
        .status-success { background: #238636; color: white; }
        .status-error { background: #da3633; color: white; }
        .status-warning { background: #fb8500; color: black; }
        .correlation-group {
          border-left: 2px solid #7c3aed;
          margin: 1px 0;
          background: rgba(124, 58, 237, 0.05);
        }
        .monitor-content::-webkit-scrollbar,
        .event-list::-webkit-scrollbar {
          width: 4px;
        }
        .monitor-content::-webkit-scrollbar-track,
        .event-list::-webkit-scrollbar-track {
          background: #161b22;
        }
        .monitor-content::-webkit-scrollbar-thumb,
        .event-list::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 2px;
        }
        .monitor-content::-webkit-scrollbar-thumb:hover,
        .event-list::-webkit-scrollbar-thumb:hover {
          background: #58a6ff;
        }
        .config-section {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 4px;
          padding: 6px;
          margin: 4px 6px;
          font-size: 9px;
        }
        .config-title {
          color: #58a6ff;
          font-size: 9px;
          font-weight: 600;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .config-input {
          width: 100%;
          background: #0d1117;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 3px 5px;
          font-size: 9px;
          font-family: monospace;
          border-radius: 3px;
          margin-bottom: 4px;
          box-sizing: border-box;
        }
        .config-input:focus {
          outline: none;
          border-color: #58a6ff;
          box-shadow: 0 0 0 1px #58a6ff;
        }
        .monitor-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8px;
          color: #6e7681;
          margin: 2px 6px;
          padding: 3px 6px;
          background: #161b22;
          border-radius: 3px;
        }
        .status-indicator {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          margin-right: 3px;
        }
        .status-success { background: #238636; }
        .status-error { background: #f85149; }
        .status-warning { background: #fb8500; }
        .network-logs {
          max-height: 80px;
          overflow-y: auto;
          font-size: 8px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 3px;
          padding: 3px;
        }
        .network-log-entry {
          padding: 1px 3px;
          margin: 1px 0;
          border-radius: 2px;
          font-family: monospace;
        }
        .log-success { background: rgba(35, 134, 54, 0.15); color: #7dda58; }
        .log-error { background: rgba(248, 81, 73, 0.15); color: #ff6b6b; }
        .log-timestamp { color: #6e7681; font-size: 7px; }
      </style>
      
      <div class="monitor-header">
        <div class="monitor-title">DEBUG MONITOR</div>
        <div class="monitor-controls">
          <button class="monitor-btn" id="toggle-monitor">Stop</button>
          <button class="monitor-btn" id="clear-events">Clear</button>
          <button class="monitor-btn" id="toggle-config">Config</button>
          <button class="monitor-btn" id="hide-monitor">Hide</button>
          <button class="monitor-btn danger" id="close-monitor">×</button>
        </div>
      </div>
      
      <div class="monitor-status">
        <span>
          <span class="status-indicator" id="connection-status"></span>
          <span id="connection-text">Connecting...</span>
        </span>
        <span id="last-request-time">No requests yet</span>
      </div>
      
      <div class="config-section" id="config-section" style="display: none;">
        <div class="config-title">🔧 Service Configuration</div>
        <div>
          <label style="display: block; margin-bottom: 2px; color: #8b949e;">Service Name:</label>
          <input type="text" class="config-input" id="service-name-input" placeholder="my-service">
          <button class="monitor-btn" id="update-service-name" style="font-size: 8px;">Update Name</button>
        </div>
        <div style="margin-top: 8px;">
          <label style="display: block; margin-bottom: 2px; color: #8b949e;">API Endpoint:</label>
          <input type="text" class="config-input" id="server-url-input" placeholder="http://localhost:3000/api/events">
          <button class="monitor-btn" id="update-server-url" style="font-size: 8px;">Update URL</button>
        </div>
        <div class="config-title" style="margin-top: 8px;">📡 Network Activity</div>
        <div class="network-logs" id="network-logs">
          <div style="color: #6e7681; text-align: center; font-size: 7px; padding: 8px;">Network activity will appear here...</div>
        </div>
      </div>
      
      <div class="monitor-content">
        <div class="time-windows" id="time-windows"></div>
        <div class="stats-row">
          <span>Events: <span id="event-count">0</span></span>
          <span>Queue: <span id="queue-count">0</span></span>
          <span>Window: <span id="current-window">T-5M</span></span>
        </div>
        <div class="event-list" id="event-list"></div>
      </div>
    \`;

    document.body.appendChild(ui);
    monitorUI = ui;

    // Setup time window buttons
    const windowsContainer = ui.querySelector('#time-windows');
    CONFIG.timeWindows.forEach(window => {
      const btn = document.createElement('button');
      btn.className = \`window-btn \${window.minutes === currentTimeWindow ? 'active' : ''}\`;
      btn.textContent = window.label;
      btn.onclick = () => setTimeWindow(window.minutes);
      windowsContainer.appendChild(btn);
    });

    // Setup event handlers
    ui.querySelector('#toggle-monitor').onclick = toggleMonitoring;
    ui.querySelector('#clear-events').onclick = clearEvents;
    ui.querySelector('#hide-monitor').onclick = hideMonitor;
    ui.querySelector('#close-monitor').onclick = closeMonitor;
    ui.querySelector('#toggle-config').onclick = toggleConfig;
    ui.querySelector('#update-server-url').onclick = updateServerUrl;
    ui.querySelector('#update-service-name').onclick = updateServiceName;
    
    // Initialize config inputs with current values
    ui.querySelector('#server-url-input').value = CONFIG.serverUrl;
    ui.querySelector('#service-name-input').value = CONFIG.serviceName || '';
    
    // Update connection status
    updateConnectionStatus();

    // Make draggable
    makeDraggable(ui);
  };

  const setTimeWindow = (minutes) => {
    currentTimeWindow = minutes;
    if (monitorUI) {
      // Update active button
      const buttons = monitorUI.querySelectorAll('.window-btn');
      buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === \`T-\${minutes}M\` || 
            (minutes >= 60 && btn.textContent === \`T-\${minutes/60}H\`)) {
          btn.classList.add('active');
        }
      });
      updateUI();
    }
  };

  const updateUI = () => {
    if (!monitorUI) return;

    const { from, to } = getTimeWindow(currentTimeWindow);
    const windowEvents = capturedEvents.filter(e => e.timestampMs >= from && e.timestampMs <= to);

    // Update stats
    monitorUI.querySelector('#event-count').textContent = windowEvents.length;
    monitorUI.querySelector('#queue-count').textContent = eventQueue.length;
    monitorUI.querySelector('#current-window').textContent = 
      currentTimeWindow < 60 ? \`T-\${currentTimeWindow}M\` : \`T-\${currentTimeWindow/60}H\`;

    // Update connection status and network logs
    updateConnectionStatus();
    updateNetworkLogs();

    // Update event list
    const eventList = monitorUI.querySelector('#event-list');
    eventList.innerHTML = '';

    // Group events by correlation ID
    const correlatedEvents = {};
    const standaloneEvents = [];

    windowEvents.slice(-50).reverse().forEach(event => {
      if (event.correlationId) {
        if (!correlatedEvents[event.correlationId]) {
          correlatedEvents[event.correlationId] = [];
        }
        correlatedEvents[event.correlationId].push(event);
      } else {
        standaloneEvents.push(event);
      }
    });

    // Render correlated events
    Object.entries(correlatedEvents).forEach(([corrId, events]) => {
      const group = document.createElement('div');
      group.className = 'correlation-group';
      
      events.forEach(event => {
        group.appendChild(createEventElement(event, corrId));
      });
      
      eventList.appendChild(group);
    });

    // Render standalone events
    standaloneEvents.forEach(event => {
      eventList.appendChild(createEventElement(event));
    });
  };

  const createEventElement = (event, correlationId = null) => {
    const div = document.createElement('div');
    div.className = 'event-item';

    const statusClass = event.statusCode ? 
      (event.statusCode >= 400 ? 'status-error' : 'status-success') :
      (event.type.includes('error') ? 'status-error' : 'status-warning');

    div.innerHTML = \`
      <div>
        <span class="event-type">\${event.type}</span>
        <span class="event-name">\${event.name}</span>
        \${correlationId ? \`<span style="color: #7c3aed;">●\${correlationId.slice(-4)}</span>\` : ''}
      </div>
      <div>
        \${event.statusCode ? \`<span class="event-status \${statusClass}">\${event.statusCode}</span>\` : ''}
        \${event.responseTimeMs ? \`<span style="color: #8b949e;">\${event.responseTimeMs}ms</span>\` : ''}
        <span class="event-time">\${formatTime(event.timestampMs)}</span>
      </div>
    \`;

    return div;
  };

  const makeDraggable = (element) => {
    let isDragging = false;
    let currentX, currentY, initialX, initialY;

    const header = element.querySelector('.monitor-header');
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      initialX = e.clientX - element.offsetLeft;
      initialY = e.clientY - element.offsetTop;
      
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        element.style.left = currentX + 'px';
        element.style.top = currentY + 'px';
      }
    }

    function dragEnd() {
      isDragging = false;
    }
  };

  // Control functions
  const toggleMonitoring = () => {
    isMonitoring = !isMonitoring;
    const btn = monitorUI.querySelector('#toggle-monitor');
    btn.textContent = isMonitoring ? 'Stop' : 'Start';
    btn.className = \`monitor-btn \${isMonitoring ? '' : 'active'}\`;

    if (isMonitoring) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  };

  const clearEvents = () => {
    capturedEvents = [];
    eventQueue = [];
    if (monitorUI) {
      updateUI();
    }
  };

  const hideMonitor = () => {
    isHidden = true;
    if (monitorUI) {
      monitorUI.style.display = 'none';
    }
  };

  const showMonitor = () => {
    isHidden = false;
    if (!monitorUI) {
      createUI();
    } else {
      monitorUI.style.display = 'block';
    }
    updateUI();
  };

  const closeMonitor = () => {
    stopMonitoring();
    if (monitorUI) {
      monitorUI.remove();
      monitorUI = null;
    }
  };

  // Configuration functions
  const toggleConfig = () => {
    if (!monitorUI) return;
    const configSection = monitorUI.querySelector('#config-section');
    const isVisible = configSection.style.display !== 'none';
    configSection.style.display = isVisible ? 'none' : 'block';
    
    // Update button text
    const toggleBtn = monitorUI.querySelector('#toggle-config');
    toggleBtn.textContent = isVisible ? 'Config' : 'Hide Config';
    toggleBtn.classList.toggle('active', !isVisible);
  };

  const updateServerUrl = () => {
    if (!monitorUI) return;
    const input = monitorUI.querySelector('#server-url-input');
    const newUrl = input.value.trim();
    
    if (!newUrl) {
      alert('Please enter a valid server URL');
      return;
    }
    
    // Update configuration
    CONFIG.serverUrl = newUrl;
    CONFIG.sseUrl = newUrl.replace('/api/events', '/api/events/stream');
    
    console.log(\`[Monitor] 🔄 Server URL updated to: \${newUrl}\`);
    
    // Clear any pending events and restart monitoring
    eventQueue = [];
    if (isMonitoring) {
      stopMonitoring();
      setTimeout(() => {
        startMonitoring();
        console.log('[Monitor] ✅ Restarted monitoring with new server URL');
      }, 100);
    }
    
    updateConnectionStatus();
    updateNetworkLogs();
  };

  const updateServiceName = () => {
    if (!monitorUI) return;
    const input = monitorUI.querySelector('#service-name-input');
    const newServiceName = input.value.trim();
    
    // Update configuration (allow empty to use default)
    CONFIG.serviceName = newServiceName || null;
    
    console.log(\`[Monitor] 🏷️ Service name updated to: \${CONFIG.serviceName || 'auto-detected'}\`);
    
    // Log an event to mark the service name change
    const serviceEvent = createEvent('monitor-config', 'service-name-changed', {
      oldServiceName: CONFIG.serviceName,
      newServiceName: newServiceName || null,
      autoDetected: !newServiceName
    });
    
    addEvent(serviceEvent);
    
    updateConnectionStatus();
  };

  const updateConnectionStatus = () => {
    if (!monitorUI) return;
    const statusIndicator = monitorUI.querySelector('#connection-status');
    const statusText = monitorUI.querySelector('#connection-text');
    const lastRequestTime = monitorUI.querySelector('#last-request-time');
    
    // Check recent monitor errors/successes
    const recentErrors = window.monitorErrors || [];
    const recentLogs = window.monitorLogs || [];
    const recentActivity = [...recentErrors, ...recentLogs].sort((a, b) => b.timestampMs - a.timestampMs);
    
    if (recentActivity.length === 0) {
      statusIndicator.className = 'status-indicator status-warning';
      statusText.textContent = 'No activity';
      lastRequestTime.textContent = 'No requests yet';
    } else {
      const lastActivity = recentActivity[0];
      const wasError = recentErrors.includes(lastActivity);
      
      statusIndicator.className = \`status-indicator \${wasError ? 'status-error' : 'status-success'}\`;
      statusText.textContent = wasError ? 'Connection Error' : 'Connected';
      lastRequestTime.textContent = new Date(lastActivity.timestampMs).toLocaleTimeString();
    }
  };

  const updateNetworkLogs = () => {
    if (!monitorUI) return;
    const logsContainer = monitorUI.querySelector('#network-logs');
    
    const recentErrors = (window.monitorErrors || []).slice(-5);
    const recentLogs = (window.monitorLogs || []).slice(-5);
    const allLogs = [...recentErrors, ...recentLogs].sort((a, b) => b.timestampMs - a.timestampMs).slice(0, 8);
    
    if (allLogs.length === 0) {
      logsContainer.innerHTML = '<div style="color: #6e7681; text-align: center; font-size: 7px; padding: 8px;">Network activity will appear here...</div>';
      return;
    }
    
    logsContainer.innerHTML = allLogs.map(log => {
      const isError = (window.monitorErrors || []).includes(log);
      const time = new Date(log.timestampMs).toLocaleTimeString();
      const status = isError ? 'ERROR' : 'SUCCESS';
      const responseTime = log.responseTimeMs ? \` (\${log.responseTimeMs}ms)\` : '';
      
      return \`
        <div class="network-log-entry \${isError ? 'log-error' : 'log-success'}">
          <span class="log-timestamp">\${time}</span> 
          \${status}\${responseTime}
          \${isError && log.error ? \` - \${log.error.substring(0, 40)}...\` : ''}
        </div>
      \`;
    }).join('');
  };

  // Main control functions
  const startMonitoring = () => {
    if (isMonitoring) return;

    isMonitoring = true;
    interceptNetworkRequests();
    interceptDOMEvents();
    interceptConsole();

    // Start flush timer
    flushTimer = setInterval(flushEvents, CONFIG.flushInterval);

    // Log start event
    const startEvent = createEvent('monitor-event', 'monitoring-started', {
      url: window.location.href,
      timestamp: timestamp(),
      origin: DETECTED_ORIGIN
    });
    queueEvent(startEvent);

    if (!isHidden) {
      console.log('[Monitor] Started monitoring at:', DETECTED_ORIGIN);
    }
  };

  const stopMonitoring = () => {
    if (!isMonitoring) return;

    isMonitoring = false;

    // Clear flush timer
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }

    // Final flush
    flushEvents();

    // Log stop event
    const stopEvent = createEvent('monitor-event', 'monitoring-stopped', {
      url: window.location.href,
      timestamp: timestamp(),
      origin: DETECTED_ORIGIN
    });
    queueEvent(stopEvent);

    if (!isHidden) {
      console.log('[Monitor] Stopped monitoring');
    }
  };

  // Auto-start when script loads
  const init = () => {
    if (!isHidden) {
      console.log('[Monitor] Initializing Live Network Monitor for:', DETECTED_ORIGIN);
      createUI();
    }
    startMonitoring();
    
    // Log page load event
    const pageLoadEvent = createEvent('page-event', 'page-load', {
      url: window.location.href,
      title: document.title,
      timestamp: timestamp(),
      origin: DETECTED_ORIGIN
    });
    queueEvent(pageLoadEvent);
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+M to toggle monitor visibility
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      if (isHidden) {
        showMonitor();
      } else {
        hideMonitor();
      }
    }
  });

  // Initialize immediately if DOM is ready, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose global controls
  window.LiveMonitor = {
    start: startMonitoring,
    stop: stopMonitoring,
    clear: clearEvents,
    show: showMonitor,
    hide: hideMonitor,
    close: closeMonitor,
    setTimeWindow,
    getEvents: () => capturedEvents,
    getConfig: () => CONFIG,
    setServerUrl: (url) => {
      CONFIG.serverUrl = url;
      CONFIG.sseUrl = url.replace('/api/events', '/api/events/stream');
      console.log(\`[Monitor] Server URL updated to: \${url}\`);
    },
    setServiceName: (serviceName) => {
      CONFIG.serviceName = serviceName || null;
      console.log(\`[Monitor] Service name updated to: \${CONFIG.serviceName || 'auto-detected'}\`);
      if (monitorUI) {
        monitorUI.querySelector('#service-name-input').value = serviceName || '';
      }
    },
    getServiceName: () => CONFIG.serviceName || window.location.hostname || 'unknown',
    getNetworkLogs: () => ({
      errors: window.monitorErrors || [],
      success: window.monitorLogs || []
    }),
    isHidden: () => isHidden,
    toggle: () => isHidden ? showMonitor() : hideMonitor(),
    toggleConfig: toggleConfig
  };

})();

console.log('[Monitor] 🚀 Script loaded successfully!');
console.log('[Monitor] 📘 Controls: Ctrl+Shift+M (toggle) | window.LiveMonitor (API)');
console.log('[Monitor] ⚙️ Features: Network logging, configurable server URL, debug panel');
console.log('[Monitor] 🔧 Current server:', '${origin}/api/events');
`;

  return new NextResponse(monitorScript, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
