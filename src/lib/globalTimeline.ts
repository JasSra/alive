/**
 * Global Timeline State Management
 * Provides cross-page persistence and correlation tracking for timelines
 */

import { getAnalyticsEngine, type AnalyticsInsight } from './analytics';

export interface GlobalTimelineEvent {
  id: string;
  timestamp: number;
  correlationId?: string;
  service?: string;
  type: 'request' | 'log' | 'event' | 'metric' | 'raw';
  data: {
    message?: string;
    method?: string;
    path?: string;
    status?: number;
    duration?: number;
    severity?: string | number;
    name?: string;
    value?: number | string;
    attrs?: Record<string, unknown>;
  };
  color?: string;
}

export interface GlobalTimelineState {
  events: GlobalTimelineEvent[];
  correlations: Map<string, GlobalTimelineEvent[]>;
  insights: AnalyticsInsight[];
  timeRange: {
    start: number;
    end: number;
  };
  selectedCorrelation?: string;
  selectedEvent?: string;
  filters: {
    services?: string[];
    types?: string[];
    severities?: string[];
    correlationId?: string;
  };
  isLive: boolean;
  maxEvents: number;
  analyticsEnabled: boolean;
}

class GlobalTimelineManager {
  private state: GlobalTimelineState;
  private subscribers: Set<(state: GlobalTimelineState) => void> = new Set();
  private persistenceKey = 'alive-global-timeline';
  private broadcastChannel?: BroadcastChannel;
  private analytics = getAnalyticsEngine();
  private analyticsUpdateTimer?: NodeJS.Timeout;

  constructor() {
    this.state = this.loadPersistedState();
    
    // Enable cross-tab synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('alive-timeline-sync');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'timeline-update') {
          this.setState(event.data.state);
        }
      };
    }

    // Subscribe to analytics insights
    this.analytics.subscribe((insights) => {
      this.setState({ insights });
    });

    // Setup periodic analytics updates
    this.setupAnalyticsUpdates();
  }

  private loadPersistedState(): GlobalTimelineState {
    if (typeof window === 'undefined') {
      return this.getInitialState();
    }
    
    try {
      const stored = localStorage.getItem(this.persistenceKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Restore Map from JSON
        parsed.correlations = new Map(parsed.correlations || []);
        return { ...this.getInitialState(), ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load persisted timeline state:', e);
    }
    
    return this.getInitialState();
  }

  private getInitialState(): GlobalTimelineState {
    const now = Date.now();
    return {
      events: [],
      correlations: new Map(),
      insights: [],
      timeRange: {
        start: now - 24 * 60 * 60 * 1000, // Last 24 hours
        end: now,
      },
      filters: {},
      isLive: true,
      maxEvents: 1000,
      analyticsEnabled: true,
    };
  }

  private persistState(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const toStore = {
        ...this.state,
        // Convert Map to array for JSON serialization
        correlations: Array.from(this.state.correlations.entries()),
      };
      localStorage.setItem(this.persistenceKey, JSON.stringify(toStore));
    } catch (e) {
      console.warn('Failed to persist timeline state:', e);
    }
  }

  private setState(newState: Partial<GlobalTimelineState>): void {
    this.state = { ...this.state, ...newState };
    this.persistState();
    this.notifySubscribers();
    
    // Broadcast to other tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'timeline-update',
        state: this.state,
      });
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state);
      } catch (e) {
        console.error('Timeline subscriber error:', e);
      }
    });
  }

  // Public API
  
  addEvent(event: Omit<GlobalTimelineEvent, 'id'>): string {
    const id = this.generateId();
    const fullEvent: GlobalTimelineEvent = { ...event, id };
    
    // Add to events list
    const events = [...this.state.events, fullEvent];
    
    // Maintain size limit
    if (events.length > this.state.maxEvents) {
      events.splice(0, events.length - this.state.maxEvents);
    }
    
    // Update correlations mapping
    const correlations = new Map(this.state.correlations);
    if (event.correlationId) {
      const existing = correlations.get(event.correlationId) || [];
      correlations.set(event.correlationId, [...existing, fullEvent]);
    }
    
    // Update time range if live
    let timeRange = this.state.timeRange;
    if (this.state.isLive) {
      timeRange = {
        start: Math.min(timeRange.start, event.timestamp),
        end: Math.max(timeRange.end, event.timestamp),
      };
    }
    
    this.setState({ events, correlations, timeRange });
    
    // Trigger analytics update if enabled
    if (this.state.analyticsEnabled) {
      this.scheduleAnalyticsUpdate();
    }
    
    return id;
  }

  addEvents(events: Array<Omit<GlobalTimelineEvent, 'id'>>): string[] {
    return events.map(event => this.addEvent(event));
  }

  getFilteredEvents(): GlobalTimelineEvent[] {
    let filtered = this.state.events;
    const { filters, timeRange } = this.state;
    
    // Time range filter
    filtered = filtered.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );
    
    // Service filter
    if (filters.services?.length) {
      filtered = filtered.filter(e => 
        !e.service || filters.services!.includes(e.service)
      );
    }
    
    // Type filter
    if (filters.types?.length) {
      filtered = filtered.filter(e => 
        filters.types!.includes(e.type)
      );
    }
    
    // Correlation filter
    if (filters.correlationId) {
      filtered = filtered.filter(e => 
        e.correlationId === filters.correlationId
      );
    }
    
    return filtered.sort((a, b) => a.timestamp - b.timestamp);
  }

  getCorrelatedEvents(correlationId: string): GlobalTimelineEvent[] {
    return this.state.correlations.get(correlationId) || [];
  }

  getAllCorrelations(): Array<{ id: string; events: GlobalTimelineEvent[]; count: number }> {
    return Array.from(this.state.correlations.entries())
      .map(([id, events]) => ({ id, events, count: events.length }))
      .sort((a, b) => b.count - a.count);
  }

  setTimeRange(start: number, end: number): void {
    this.setState({ 
      timeRange: { start, end },
      isLive: false // Disable live mode when manually setting range
    });
  }

  setFilters(filters: Partial<GlobalTimelineState['filters']>): void {
    this.setState({ 
      filters: { ...this.state.filters, ...filters }
    });
  }

  selectCorrelation(correlationId?: string): void {
    this.setState({ selectedCorrelation: correlationId });
  }

  selectEvent(eventId?: string): void {
    this.setState({ selectedEvent: eventId });
  }

  setLiveMode(isLive: boolean): void {
    let updates: Partial<GlobalTimelineState> = { isLive };
    
    if (isLive) {
      // Reset to recent time range
      const now = Date.now();
      updates.timeRange = {
        start: now - 60 * 60 * 1000, // Last hour
        end: now,
      };
    }
    
    this.setState(updates);
  }

  clearEvents(): void {
    this.setState({
      events: [],
      correlations: new Map(),
      selectedCorrelation: undefined,
      selectedEvent: undefined,
      insights: [],
    });
    this.analytics.clearInsights();
    this.analytics.clearPatterns();
  }

  // Analytics methods
  
  private setupAnalyticsUpdates(): void {
    // Run analytics every 30 seconds
    this.analyticsUpdateTimer = setInterval(() => {
      if (this.state.analyticsEnabled && this.state.events.length > 0) {
        this.runAnalytics();
      }
    }, 30000);
  }

  private scheduleAnalyticsUpdate(): void {
    // Debounced analytics update
    if (this.analyticsUpdateTimer) {
      clearTimeout(this.analyticsUpdateTimer);
    }
    
    this.analyticsUpdateTimer = setTimeout(() => {
      this.runAnalytics();
    }, 5000); // 5 second delay to batch multiple events
  }

  private runAnalytics(): void {
    try {
      const recentEvents = this.getFilteredEvents();
      this.analytics.analyzeEvents(recentEvents);
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }

  enableAnalytics(enabled: boolean): void {
    this.setState({ analyticsEnabled: enabled });
    
    if (!enabled && this.analyticsUpdateTimer) {
      clearInterval(this.analyticsUpdateTimer);
    } else if (enabled) {
      this.setupAnalyticsUpdates();
      this.runAnalytics(); // Run immediately
    }
  }

  getInsights(): AnalyticsInsight[] {
    return this.state.insights;
  }

  dismissInsight(insightId: string): void {
    const insights = this.state.insights.filter(i => i.id !== insightId);
    this.setState({ insights });
  }

  subscribe(callback: (state: GlobalTimelineState) => void): () => void {
    this.subscribers.add(callback);
    // Immediately notify with current state
    callback(this.state);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getState(): GlobalTimelineState {
    return { ...this.state };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let globalTimelineInstance: GlobalTimelineManager | null = null;

export function getGlobalTimeline(): GlobalTimelineManager {
  if (typeof window === 'undefined') {
    // Create a temporary instance for server-side rendering
    return new GlobalTimelineManager();
  }
  
  if (!globalTimelineInstance) {
    globalTimelineInstance = new GlobalTimelineManager();
  }
  return globalTimelineInstance;
}

// React hook for components
export function useGlobalTimeline() {
  if (typeof window === 'undefined') {
    // Server-side fallback - return empty state and no-op functions
    const emptyState: GlobalTimelineState = {
      events: [],
      correlations: new Map(),
      insights: [],
      timeRange: { start: Date.now() - 3600000, end: Date.now() },
      filters: {},
      isLive: true,
      maxEvents: 1000,
      analyticsEnabled: true,
    };
    
    return {
      state: emptyState,
      addEvent: () => '',
      addEvents: () => [],
      getFilteredEvents: () => [],
      getCorrelatedEvents: () => [],
      getAllCorrelations: () => [],
      setTimeRange: () => {},
      setFilters: () => {},
      selectCorrelation: () => {},
      selectEvent: () => {},
      setLiveMode: () => {},
      clearEvents: () => {},
      subscribe: () => () => {},
      enableAnalytics: () => {},
      getInsights: () => [],
      dismissInsight: () => {},
    };
  }
  
  const timeline = getGlobalTimeline();
  
  return {
    state: timeline.getState(),
    addEvent: timeline.addEvent.bind(timeline),
    addEvents: timeline.addEvents.bind(timeline),
    getFilteredEvents: timeline.getFilteredEvents.bind(timeline),
    getCorrelatedEvents: timeline.getCorrelatedEvents.bind(timeline),
    getAllCorrelations: timeline.getAllCorrelations.bind(timeline),
    setTimeRange: timeline.setTimeRange.bind(timeline),
    setFilters: timeline.setFilters.bind(timeline),
    selectCorrelation: timeline.selectCorrelation.bind(timeline),
    selectEvent: timeline.selectEvent.bind(timeline),
    setLiveMode: timeline.setLiveMode.bind(timeline),
    clearEvents: timeline.clearEvents.bind(timeline),
    subscribe: timeline.subscribe.bind(timeline),
    enableAnalytics: timeline.enableAnalytics.bind(timeline),
    getInsights: timeline.getInsights.bind(timeline),
    dismissInsight: timeline.dismissInsight.bind(timeline),
  };
}