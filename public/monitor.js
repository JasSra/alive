/**
 * Live Network Monitor - Self-Contained Browser Script
 * Usage: Load via <script src="http://localhost:3001/monitor.js"></script>
 * Or visit directly: http://localhost:3001/monitor.js
 * 
 * Captures all network requests, events, and posts them to the server
 * Shows live data for configurable time windows (T-5M, T-20M, etc.)
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
  // Default to the Next.js dev/prod port used by this app
  serverUrl: 'http://localhost:3001/api/events',
  sseUrl: 'http://localhost:3001/api/events/stream',
    userId: 'browser-monitor',
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
    corsMode: 'cors', // Enable CORS
    credentials: 'omit', // No credentials needed
    // Service configuration
    services: [
      { name: 'frontend', color: '#007acc', enabled: true },
      { name: 'api', color: '#28a745', enabled: true },
      { name: 'auth', color: '#ffc107', enabled: false },
      { name: 'database', color: '#dc3545', enabled: false },
      { name: 'payment', color: '#6f42c1', enabled: false }
    ],
    defaultService: 'frontend'
  };

  // Global state
  let isMonitoring = false;
  let eventQueue = [];
  let capturedEvents = [];
  let monitorUI = null;
  let currentTimeWindow = CONFIG.defaultWindow;
  let currentService = CONFIG.defaultService;
  let flushTimer = null;

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
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
    return `${(ms/60000).toFixed(1)}m`;
  };

  // Event capture functions
  const createEvent = (type, name, data = {}) => ({
    id: generateId(),
    type,
    name,
    timestamp: timestamp(),
    timestampMs: now(),
    userId: CONFIG.userId,
    serviceName: currentService, // Add service name to all events
    url: window.location.href,
    userAgent: navigator.userAgent,
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
      const event = createEvent('console-event', 'log', {
        message: args.join(' ')
      });
      queueEvent(event);
      return originalLog.apply(this, args);
    };

    console.error = function(...args) {
      const event = createEvent('console-event', 'error', {
        message: args.join(' ')
      });
      queueEvent(event);
      return originalError.apply(this, args);
    };

    console.warn = function(...args) {
      const event = createEvent('console-event', 'warn', {
        message: args.join(' ')
      });
      queueEvent(event);
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

    updateUI();

    if (eventQueue.length >= CONFIG.batchSize) {
      flushEvents();
    }
  };

  // Send events to server
  const flushEvents = async () => {
    if (eventQueue.length === 0) return;

    const eventsToSend = [...eventQueue];
    eventQueue = [];

    try {
      const response = await fetch(CONFIG.serverUrl, {
        method: 'POST',
        mode: CONFIG.corsMode,
        credentials: CONFIG.credentials,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: eventsToSend })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[Monitor] Sent ${eventsToSend.length} events to server, total: ${result.total}`);
    } catch (error) {
      console.error('[Monitor] Failed to send events:', error);
      // Re-queue events for retry (with limit)
      if (eventsToSend[0]?.retryCount < CONFIG.maxRetries) {
        eventsToSend.forEach(event => {
          event.retryCount = (event.retryCount || 0) + 1;
          eventQueue.push(event);
        });
      } else {
        console.warn(`[Monitor] Dropping ${eventsToSend.length} events after ${CONFIG.maxRetries} retries`);
      }
    }
  };

  // UI Creation
  const createUI = () => {
    // Remove existing UI if present
    if (monitorUI) {
      monitorUI.remove();
    }

    const ui = document.createElement('div');
    ui.id = 'network-monitor-ui';
    ui.innerHTML = `
      <style>
        #network-monitor-ui {
          position: fixed;
          top: 10px;
          right: 10px;
          width: 400px;
          max-height: 80vh;
          background: rgba(0, 0, 0, 0.95);
          color: white;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 11px;
          border: 2px solid #333;
          border-radius: 8px;
          z-index: 999999;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        .monitor-header {
          background: #1a1a1a;
          padding: 8px 12px;
          border-bottom: 1px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .monitor-title {
          font-weight: bold;
          color: #00ff00;
        }
        .monitor-controls {
          display: flex;
          gap: 5px;
        }
        .monitor-btn {
          background: #333;
          border: 1px solid #555;
          color: white;
          padding: 2px 6px;
          font-size: 10px;
          cursor: pointer;
          border-radius: 3px;
        }
        .monitor-btn:hover {
          background: #444;
        }
        .monitor-btn.active {
          background: #007acc;
          border-color: #007acc;
        }
        .monitor-btn.danger {
          background: #dc3545;
          border-color: #dc3545;
        }
        .time-windows {
          display: flex;
          gap: 3px;
          margin: 5px 0;
        }
        .window-btn {
          background: #2a2a2a;
          border: 1px solid #444;
          color: #ccc;
          padding: 2px 6px;
          font-size: 9px;
          cursor: pointer;
          border-radius: 2px;
        }
        .window-btn.active {
          background: #ffa500;
          border-color: #ffa500;
          color: black;
        }
        .service-config {
          margin: 8px 0;
          padding: 8px;
          background: #1a1a1a;
          border-radius: 4px;
          border: 1px solid #333;
        }
        .service-label {
          color: #ccc;
          font-size: 10px;
          margin-bottom: 4px;
          display: block;
        }
        .service-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .service-badge {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 9px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .service-badge.active {
          border-color: #fff;
          box-shadow: 0 0 4px rgba(255,255,255,0.3);
        }
        .service-badge:hover {
          opacity: 0.8;
        }
        .monitor-content {
          padding: 8px;
          max-height: 60vh;
          overflow-y: auto;
        }
        .stats-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          color: #ffa500;
        }
        .event-list {
          max-height: 300px;
          overflow-y: auto;
        }
        .event-item {
          padding: 3px 0;
          border-bottom: 1px solid #2a2a2a;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .event-type {
          color: #00ffff;
          font-weight: bold;
        }
        .event-name {
          color: #ffff00;
        }
        .event-time {
          color: #888;
          font-size: 9px;
        }
        .event-status {
          font-size: 9px;
          padding: 1px 3px;
          border-radius: 2px;
        }
        .status-success { background: #28a745; color: white; }
        .status-error { background: #dc3545; color: white; }
        .status-warning { background: #ffc107; color: black; }
        .correlation-group {
          border-left: 2px solid #00ff00;
          padding-left: 4px;
          margin: 2px 0;
        }
      </style>
      
      <div class="monitor-header">
        <div class="monitor-title">🔍 Live Monitor</div>
        <div class="monitor-controls">
          <button class="monitor-btn" id="toggle-monitor">Stop</button>
          <button class="monitor-btn" id="clear-events">Clear</button>
          <button class="monitor-btn danger" id="close-monitor">×</button>
        </div>
      </div>
      
      <div class="monitor-content">
        <div class="service-config">
          <span class="service-label">🔧 Service Configuration</span>
          <div class="service-badges" id="service-badges"></div>
        </div>
        <div class="time-windows" id="time-windows"></div>
        <div class="stats-row">
          <span>Events: <span id="event-count">0</span></span>
          <span>Queue: <span id="queue-count">0</span></span>
          <span>Service: <span id="current-service">frontend</span></span>
        </div>
        <div class="event-list" id="event-list"></div>
      </div>
    `;

    document.body.appendChild(ui);
    monitorUI = ui;

    // Setup time window buttons
    const windowsContainer = ui.querySelector('#time-windows');
    CONFIG.timeWindows.forEach(window => {
      const btn = document.createElement('button');
      btn.className = `window-btn ${window.minutes === currentTimeWindow ? 'active' : ''}`;
      btn.textContent = window.label;
      btn.onclick = () => setTimeWindow(window.minutes);
      windowsContainer.appendChild(btn);
    });

    // Setup service badges
    const serviceBadgesContainer = ui.querySelector('#service-badges');
    CONFIG.services.forEach(service => {
      const badge = document.createElement('button');
      badge.className = `service-badge ${service.name === currentService ? 'active' : ''}`;
      badge.textContent = service.name;
      badge.style.backgroundColor = service.color;
      badge.style.color = service.color === '#ffc107' ? '#000' : '#fff';
      badge.onclick = () => setService(service.name);
      serviceBadgesContainer.appendChild(badge);
    });

    // Setup event handlers
    ui.querySelector('#toggle-monitor').onclick = toggleMonitoring;
    ui.querySelector('#clear-events').onclick = clearEvents;
    ui.querySelector('#close-monitor').onclick = closeMonitor;

    // Make draggable
    makeDraggable(ui);
  };

  const setTimeWindow = (minutes) => {
    currentTimeWindow = minutes;
    // Update active button
    const buttons = monitorUI.querySelectorAll('.window-btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent === `T-${minutes}M` || 
          (minutes >= 60 && btn.textContent === `T-${minutes/60}H`)) {
        btn.classList.add('active');
      }
    });
    updateUI();
  };

  const setService = (serviceName) => {
    currentService = serviceName;
    // Update active badge
    const badges = monitorUI.querySelectorAll('.service-badge');
    badges.forEach(badge => {
      badge.classList.remove('active');
      if (badge.textContent === serviceName) {
        badge.classList.add('active');
      }
    });
    // Update current service display
    const currentServiceSpan = monitorUI.querySelector('#current-service');
    if (currentServiceSpan) {
      currentServiceSpan.textContent = serviceName;
    }
    console.log(`[Monitor] Switched to service: ${serviceName}`);
  };

  const updateUI = () => {
    if (!monitorUI) return;

    const { from, to } = getTimeWindow(currentTimeWindow);
    const windowEvents = capturedEvents.filter(e => e.timestampMs >= from && e.timestampMs <= to);

    // Update stats
    monitorUI.querySelector('#event-count').textContent = windowEvents.length;
    monitorUI.querySelector('#queue-count').textContent = eventQueue.length;
    monitorUI.querySelector('#current-service').textContent = currentService;

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

    div.innerHTML = `
      <div>
        <span class="event-type">${event.type}</span>
        <span class="event-name">${event.name}</span>
        ${correlationId ? `<span style="color: #00ff00;">●${correlationId.slice(-4)}</span>` : ''}
      </div>
      <div>
        ${event.statusCode ? `<span class="event-status ${statusClass}">${event.statusCode}</span>` : ''}
        ${event.responseTimeMs ? `<span style="color: #ccc;">${event.responseTimeMs}ms</span>` : ''}
        <span class="event-time">${formatTime(event.timestampMs)}</span>
      </div>
    `;

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
    btn.className = `monitor-btn ${isMonitoring ? '' : 'active'}`;

    if (isMonitoring) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  };

  const clearEvents = () => {
    capturedEvents = [];
    eventQueue = [];
    updateUI();
  };

  const closeMonitor = () => {
    stopMonitoring();
    if (monitorUI) {
      monitorUI.remove();
      monitorUI = null;
    }
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
      timestamp: timestamp()
    });
    queueEvent(startEvent);

    console.log('[Monitor] Started monitoring');
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
      timestamp: timestamp()
    });
    queueEvent(stopEvent);

    console.log('[Monitor] Stopped monitoring');
  };

  // Auto-start when script loads
  const init = () => {
    console.log('[Monitor] Initializing Live Network Monitor...');
    createUI();
    startMonitoring();
    
    // Log page load event
    const pageLoadEvent = createEvent('page-event', 'page-load', {
      url: window.location.href,
      title: document.title,
      timestamp: timestamp()
    });
    queueEvent(pageLoadEvent);
  };

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
    close: closeMonitor,
    setTimeWindow,
    setService,
    getEvents: () => capturedEvents,
    getConfig: () => CONFIG
  };

})();
