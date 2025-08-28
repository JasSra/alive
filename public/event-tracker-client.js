/**
 * Event Tracking Client for Cross-Origin Event Ingestion
 * 
 * Usage from your app running on port 3000:
 * 
 * const tracker = new EventTracker('http://localhost:3001');
 * await tracker.track('user-visit-homepage', { page: '/home' });
 */

class EventTracker {
  constructor(baseUrl = 'http://localhost:3001', serviceName = 'web-app') {
    this.baseUrl = baseUrl;
    this.serviceName = serviceName;
    this.sessionId = this.getOrCreateSessionId();
    this.userId = this.getUserId();
    
    // Test connectivity on initialization
    this.testConnection();
  }

  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('eventTrackerSessionId');
    if (!sessionId) {
      sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('eventTrackerSessionId', sessionId);
    }
    return sessionId;
  }

  getUserId() {
    return localStorage.getItem('userId') || 
           sessionStorage.getItem('userId') || 
           'anonymous-' + Date.now();
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/api/events?limit=1`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Event tracker connected successfully to', this.baseUrl);
      } else {
        console.warn('⚠️ Event tracker connection issue:', response.status);
      }
    } catch (error) {
      console.error('❌ Event tracker connection failed:', error.message);
      console.error('Make sure the event tracking server is running on', this.baseUrl);
    }
  }

  async track(eventName, payload = {}) {
    const eventPayload = {
      ...payload,
      serviceName: this.serviceName,
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct',
      metadata: {
        ...payload.metadata,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        trackingTimestamp: Date.now()
      }
    };

    try {
      console.log(`📊 Tracking event: ${eventName}`);
      
      const response = await fetch(`${this.baseUrl}/api/events/track/${eventName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': this.userId,
          'Origin': window.location.origin
        },
        body: JSON.stringify(eventPayload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Event tracked: ${eventName}`, result);
        
        // Handle AI suggestions if present
        if (result.suggestions && result.suggestions.length > 0) {
          console.log('🤖 AI Suggestions received:', result.suggestions);
          this.handleSuggestions(result.suggestions);
        }
        
        return result;
      } else {
        const errorText = await response.text();
        console.error(`❌ Event tracking failed for ${eventName}:`, response.status, errorText);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.error(`❌ Event tracking error for ${eventName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async trackBatch(events) {
    const batchPayload = {
      batchId: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      events: events.map(event => ({
        eventName: event.eventName,
        payload: {
          ...event.payload,
          serviceName: this.serviceName,
          sessionId: this.sessionId
        }
      }))
    };

    try {
      console.log(`📊 Tracking batch of ${events.length} events`);
      
      const response = await fetch(`${this.baseUrl}/api/events/track/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': this.userId
        },
        body: JSON.stringify(batchPayload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Batch tracked: ${events.length} events`, result);
        return result;
      } else {
        const errorText = await response.text();
        console.error(`❌ Batch tracking failed:`, response.status, errorText);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.error(`❌ Batch tracking error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  handleSuggestions(suggestions) {
    // Emit custom event for suggestions
    window.dispatchEvent(new CustomEvent('aiSuggestions', {
      detail: { suggestions, timestamp: Date.now() }
    }));
  }

  // Convenience methods for common events
  async trackPageView(page = window.location.pathname) {
    return this.track('page-view', {
      metadata: {
        page,
        title: document.title,
        loadTime: performance.timing?.loadEventEnd - performance.timing?.navigationStart
      }
    });
  }

  async trackUserAction(action, element = null) {
    return this.track('user-action', {
      metadata: {
        action,
        element: element ? {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          text: element.textContent?.trim()
        } : null
      }
    });
  }

  async trackApiCall(endpoint, method, statusCode, responseTime) {
    return this.track('api-call', {
      statusCode,
      responseTimeMs: responseTime,
      metadata: {
        endpoint,
        method
      }
    });
  }

  async trackError(error, context = {}) {
    return this.track('error-occurred', {
      metadata: {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        context
      }
    });
  }
}

// Example usage:
if (typeof window !== 'undefined') {
  // Initialize global tracker
  window.EventTracker = EventTracker;
  
  // Auto-initialize if running on port 3000 (targeting 3001)
  if (window.location.port === '3000') {
    window.tracker = new EventTracker('http://localhost:3001', 'main-app');
    
    // Auto-track page view
    window.tracker.trackPageView();
    
    // Listen for AI suggestions
    window.addEventListener('aiSuggestions', (event) => {
      console.log('🤖 AI Suggestions received:', event.detail.suggestions);
    });
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventTracker;
}
