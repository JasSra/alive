/**
 * Advanced Analytics Engine
 * Provides pattern detection, correlation analysis, and real-time insights
 */

import { type GlobalTimelineEvent } from './globalTimeline';

export interface Pattern {
  id: string;
  type: 'sequence' | 'frequency' | 'anomaly' | 'correlation';
  name: string;
  description: string;
  confidence: number; // 0-1
  events: GlobalTimelineEvent[];
  metadata: Record<string, unknown>;
  firstSeen: number;
  lastSeen: number;
  occurrences: number;
}

export interface AnalyticsInsight {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  relatedEvents: string[];
  recommendations?: string[];
  timestamp: number;
  source: 'pattern' | 'threshold' | 'correlation' | 'ml';
}

export interface AnalyticsConfig {
  patternDetection: {
    enabled: boolean;
    minOccurrences: number;
    maxTimeGap: number; // milliseconds
    minConfidence: number;
  };
  anomalyDetection: {
    enabled: boolean;
    lookbackWindow: number; // milliseconds
    sensitivityLevel: number; // 1-5
  };
  correlationAnalysis: {
    enabled: boolean;
    maxDistance: number; // milliseconds
    minCorrelationStrength: number;
  };
}

class AdvancedAnalyticsEngine {
  private patterns: Map<string, Pattern> = new Map();
  private insights: AnalyticsInsight[] = [];
  private config: AnalyticsConfig;
  private subscribers: Set<(insights: AnalyticsInsight[]) => void> = new Set();

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = {
      patternDetection: {
        enabled: true,
        minOccurrences: 3,
        maxTimeGap: 5 * 60 * 1000, // 5 minutes
        minConfidence: 0.7,
      },
      anomalyDetection: {
        enabled: true,
        lookbackWindow: 60 * 60 * 1000, // 1 hour
        sensitivityLevel: 3,
      },
      correlationAnalysis: {
        enabled: true,
        maxDistance: 30 * 1000, // 30 seconds
        minCorrelationStrength: 0.6,
      },
      ...config,
    };
  }

  // Main analysis entry point
  analyzeEvents(events: GlobalTimelineEvent[]): AnalyticsInsight[] {
    this.clearOldInsights();

    if (this.config.patternDetection.enabled) {
      this.detectSequencePatterns(events);
      this.detectFrequencyPatterns(events);
    }

    if (this.config.anomalyDetection.enabled) {
      this.detectAnomalies(events);
    }

    if (this.config.correlationAnalysis.enabled) {
      this.analyzeCorrelations(events);
    }

    this.notifySubscribers();
    return [...this.insights];
  }

  // Pattern Detection: Sequence Patterns
  private detectSequencePatterns(events: GlobalTimelineEvent[]): void {
    const sequences = this.extractEventSequences(events);
    
    sequences.forEach(sequence => {
      if (sequence.length < 2) return;

      const patternKey = this.generateSequenceKey(sequence);
      const existing = this.patterns.get(patternKey);

      if (existing) {
        existing.occurrences++;
        existing.lastSeen = Date.now();
        existing.confidence = Math.min(1, existing.confidence + 0.1);
      } else {
        const pattern: Pattern = {
          id: patternKey,
          type: 'sequence',
          name: `${sequence[0].type} → ${sequence[sequence.length - 1].type}`,
          description: `Recurring sequence: ${sequence.map(e => e.type).join(' → ')}`,
          confidence: 0.5,
          events: sequence,
          metadata: {
            services: Array.from(new Set(sequence.map(e => e.service).filter(Boolean))),
            avgDuration: this.calculateSequenceDuration(sequence),
          },
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          occurrences: 1,
        };
        this.patterns.set(patternKey, pattern);
      }

      // Generate insights for significant patterns
      if (existing && existing.occurrences >= this.config.patternDetection.minOccurrences) {
        this.generateSequenceInsight(existing);
      }
    });
  }

  // Pattern Detection: Frequency Patterns
  private detectFrequencyPatterns(events: GlobalTimelineEvent[]): void {
    const now = Date.now();
    const timeWindows = [60000, 300000, 900000]; // 1min, 5min, 15min

    timeWindows.forEach(window => {
      const recentEvents = events.filter(e => now - e.timestamp <= window);
      const frequencies = this.calculateEventFrequencies(recentEvents);

      Object.entries(frequencies).forEach(([key, count]) => {
        if (count >= this.config.patternDetection.minOccurrences) {
          const patternId = `freq_${key}_${window}`;
          const baseline = this.getHistoricalFrequency(key, window);
          const anomalyScore = baseline > 0 ? count / baseline : 1;

          if (anomalyScore > 2) {  // 2x normal frequency
            this.addInsight({
              id: `${patternId}_${now}`,
              type: anomalyScore > 5 ? 'error' : 'warning',
              title: 'Unusual Activity Frequency',
              description: `${key} occurring ${count} times in ${window/60000}min (${(anomalyScore*100).toFixed(0)}% above normal)`,
              severity: anomalyScore > 5 ? 'high' : 'medium',
              relatedEvents: recentEvents.filter(e => this.eventMatchesKey(e, key)).map(e => e.id),
              recommendations: [
                'Monitor system resources',
                'Check for potential issues',
                'Review recent deployments'
              ],
              timestamp: now,
              source: 'pattern'
            });
          }
        }
      });
    });
  }

  // Anomaly Detection
  private detectAnomalies(events: GlobalTimelineEvent[]): void {
    const now = Date.now();
    const lookback = this.config.anomalyDetection.lookbackWindow;
    const recentEvents = events.filter(e => now - e.timestamp <= lookback);

    // Detect error rate spikes
    this.detectErrorSpikes(recentEvents);
    
    // Detect latency anomalies
    this.detectLatencyAnomalies(recentEvents);
    
    // Detect service unavailability
    this.detectServiceUnavailability(recentEvents);
    
    // Detect unusual event gaps
    this.detectEventGaps(recentEvents);
  }

  private detectErrorSpikes(events: GlobalTimelineEvent[]): void {
    const errorEvents = events.filter(e => 
      e.type === 'request' && 
      e.data.status && 
      e.data.status >= 400
    );

    const totalRequests = events.filter(e => e.type === 'request').length;
    
    if (totalRequests > 10) {
      const errorRate = errorEvents.length / totalRequests;
      const historicalErrorRate = this.getHistoricalErrorRate();
      
      if (errorRate > Math.max(0.1, historicalErrorRate * 2)) {
        this.addInsight({
          id: `error_spike_${Date.now()}`,
          type: 'error',
          title: 'Error Rate Spike Detected',
          description: `Error rate is ${(errorRate * 100).toFixed(1)}% (${errorEvents.length}/${totalRequests} requests)`,
          severity: errorRate > 0.5 ? 'critical' : 'high',
          relatedEvents: errorEvents.map(e => e.id),
          recommendations: [
            'Check application logs',
            'Verify service dependencies', 
            'Monitor system health'
          ],
          timestamp: Date.now(),
          source: 'threshold'
        });
      }
    }
  }

  private detectLatencyAnomalies(events: GlobalTimelineEvent[]): void {
    const requestEvents = events.filter(e => 
      e.type === 'request' && 
      typeof e.data.duration === 'number'
    );

    if (requestEvents.length < 5) return;

    const latencies = requestEvents.map(e => e.data.duration as number);
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance = latencies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);

    const outliers = requestEvents.filter(e => {
      const duration = e.data.duration as number;
      return Math.abs(duration - mean) > 2 * stdDev && duration > mean;
    });

    if (outliers.length > 0 && outliers.length / requestEvents.length > 0.1) {
      this.addInsight({
        id: `latency_anomaly_${Date.now()}`,
        type: 'warning',
        title: 'Latency Anomaly Detected',
        description: `${outliers.length} requests with unusual latency (avg: ${mean.toFixed(0)}ms, max: ${Math.max(...latencies).toFixed(0)}ms)`,
        severity: 'medium',
        relatedEvents: outliers.map(e => e.id),
        recommendations: [
          'Check database performance',
          'Monitor external service calls',
          'Review caching strategies'
        ],
        timestamp: Date.now(),
        source: 'pattern'
      });
    }
  }

  private detectServiceUnavailability(events: GlobalTimelineEvent[]): void {
    const services = new Set(events.map(e => e.service).filter(Boolean));
    const now = Date.now();
    const silenceThreshold = 5 * 60 * 1000; // 5 minutes

    services.forEach(service => {
      const serviceEvents = events.filter(e => e.service === service);
      const lastEvent = Math.max(...serviceEvents.map(e => e.timestamp));
      
      if (now - lastEvent > silenceThreshold) {
        this.addInsight({
          id: `service_silence_${service}_${now}`,
          type: 'warning',
          title: 'Service Silence Detected',
          description: `No events from ${service} for ${((now - lastEvent) / 60000).toFixed(1)} minutes`,
          severity: 'medium',
          relatedEvents: [],
          recommendations: [
            'Check service health',
            'Verify monitoring configuration',
            'Review service logs'
          ],
          timestamp: now,
          source: 'threshold'
        });
      }
    });
  }

  private detectEventGaps(events: GlobalTimelineEvent[]): void {
    if (events.length < 2) return;

    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const gaps: Array<{start: number, end: number, duration: number}> = [];

    for (let i = 1; i < sortedEvents.length; i++) {
      const gap = sortedEvents[i].timestamp - sortedEvents[i - 1].timestamp;
      const avgGap = this.calculateAverageEventGap(events);
      
      if (gap > Math.max(avgGap * 3, 60000)) { // 3x average or 1 minute minimum
        gaps.push({
          start: sortedEvents[i - 1].timestamp,
          end: sortedEvents[i].timestamp,
          duration: gap
        });
      }
    }

    if (gaps.length > 0) {
      const totalGapTime = gaps.reduce((sum, gap) => sum + gap.duration, 0);
      
      this.addInsight({
        id: `event_gaps_${Date.now()}`,
        type: 'info',
        title: 'Event Gaps Detected',
        description: `${gaps.length} significant gaps found, total silence: ${(totalGapTime / 60000).toFixed(1)} minutes`,
        severity: 'low',
        relatedEvents: [],
        recommendations: [
          'Check monitoring coverage',
          'Verify data ingestion',
          'Review system availability'
        ],
        timestamp: Date.now(),
        source: 'pattern'
      });
    }
  }

  // Correlation Analysis
  private analyzeCorrelations(events: GlobalTimelineEvent[]): void {
    const correlations = new Map<string, GlobalTimelineEvent[]>();
    
    // Group events by correlation ID
    events.forEach(event => {
      if (event.correlationId) {
        const existing = correlations.get(event.correlationId) || [];
        existing.push(event);
        correlations.set(event.correlationId, existing);
      }
    });

    // Analyze each correlation
    correlations.forEach((correlatedEvents, correlationId) => {
      if (correlatedEvents.length < 2) return;

      const analysis = this.analyzeCorrelationFlow(correlatedEvents);
      
      if (analysis.hasAnomalies) {
        this.addInsight({
          id: `correlation_anomaly_${correlationId}_${Date.now()}`,
          type: analysis.severity === 'high' ? 'error' : 'warning',
          title: 'Correlation Flow Anomaly',
          description: analysis.description,
          severity: analysis.severity,
          relatedEvents: correlatedEvents.map(e => e.id),
          recommendations: analysis.recommendations,
          timestamp: Date.now(),
          source: 'correlation'
        });
      }
    });
  }

  private analyzeCorrelationFlow(events: GlobalTimelineEvent[]) {
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const duration = sortedEvents[sortedEvents.length - 1].timestamp - sortedEvents[0].timestamp;
    
    let hasAnomalies = false;
    let severity: 'low' | 'medium' | 'high' = 'low';
    let description = '';
    const recommendations: string[] = [];

    // Check for errors in flow
    const errorEvents = sortedEvents.filter(e => 
      (e.type === 'request' && e.data.status && e.data.status >= 400) ||
      (e.type === 'log' && typeof e.data.severity === 'string' && e.data.severity.toLowerCase() === 'error')
    );

    if (errorEvents.length > 0) {
      hasAnomalies = true;
      severity = 'high';
      description = `Correlation flow has ${errorEvents.length} errors over ${(duration / 1000).toFixed(1)}s`;
      recommendations.push('Investigate error causes', 'Check error propagation');
    }

    // Check for unusually long flows
    if (duration > 30000) { // 30 seconds
      hasAnomalies = true;
      if (severity === 'low') severity = 'medium';
      description += (description ? '. ' : '') + `Flow duration is ${(duration / 1000).toFixed(1)}s`;
      recommendations.push('Optimize flow performance', 'Check for bottlenecks');
    }

    // Check for missing expected events
    const hasRequest = sortedEvents.some(e => e.type === 'request');
    const hasResponse = sortedEvents.some(e => e.type === 'request' && e.data.status);
    
    if (hasRequest && !hasResponse) {
      hasAnomalies = true;
      severity = 'medium';
      description += (description ? '. ' : '') + 'Request without response detected';
      recommendations.push('Check for hanging requests', 'Verify response handling');
    }

    return {
      hasAnomalies,
      severity,
      description: description || 'Correlation flow appears normal',
      recommendations
    };
  }

  // Utility methods
  private extractEventSequences(events: GlobalTimelineEvent[]): GlobalTimelineEvent[][] {
    const sequences: GlobalTimelineEvent[][] = [];
    const correlationGroups = new Map<string, GlobalTimelineEvent[]>();

    // Group by correlation ID
    events.forEach(event => {
      if (event.correlationId) {
        const existing = correlationGroups.get(event.correlationId) || [];
        existing.push(event);
        correlationGroups.set(event.correlationId, existing);
      }
    });

    // Extract sequences from each correlation group
    correlationGroups.forEach(group => {
      const sorted = group.sort((a, b) => a.timestamp - b.timestamp);
      if (sorted.length >= 2) {
        sequences.push(sorted);
      }
    });

    return sequences;
  }

  private generateSequenceKey(sequence: GlobalTimelineEvent[]): string {
    return sequence.map(e => `${e.type}:${e.service || 'unknown'}`).join('->');
  }

  private calculateSequenceDuration(sequence: GlobalTimelineEvent[]): number {
    if (sequence.length < 2) return 0;
    const sorted = [...sequence].sort((a, b) => a.timestamp - b.timestamp);
    return sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
  }

  private calculateEventFrequencies(events: GlobalTimelineEvent[]): Record<string, number> {
    const frequencies: Record<string, number> = {};
    
    events.forEach(event => {
      const key = `${event.type}:${event.service || 'unknown'}`;
      frequencies[key] = (frequencies[key] || 0) + 1;
    });

    return frequencies;
  }

  private eventMatchesKey(event: GlobalTimelineEvent, key: string): boolean {
    const eventKey = `${event.type}:${event.service || 'unknown'}`;
    return eventKey === key;
  }

  private calculateAverageEventGap(events: GlobalTimelineEvent[]): number {
    if (events.length < 2) return 60000; // Default 1 minute
    
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const gaps: number[] = [];
    
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp);
    }
    
    return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  }

  private generateSequenceInsight(pattern: Pattern): void {
    this.addInsight({
      id: `sequence_pattern_${pattern.id}_${Date.now()}`,
      type: 'info',
      title: 'Recurring Pattern Detected',
      description: `Pattern "${pattern.name}" has occurred ${pattern.occurrences} times (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`,
      severity: 'low',
      relatedEvents: pattern.events.map(e => e.id),
      recommendations: [
        'Monitor pattern performance',
        'Consider optimization opportunities',
        'Document expected behavior'
      ],
      timestamp: Date.now(),
      source: 'pattern'
    });
  }

  private addInsight(insight: AnalyticsInsight): void {
    // Check for duplicates
    const isDuplicate = this.insights.some(existing => 
      existing.title === insight.title && 
      existing.description === insight.description &&
      Date.now() - existing.timestamp < 60000 // Within 1 minute
    );
    
    if (!isDuplicate) {
      this.insights.push(insight);
      
      // Limit insights to prevent memory issues
      if (this.insights.length > 1000) {
        this.insights = this.insights.slice(-500);
      }
    }
  }

  private clearOldInsights(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    this.insights = this.insights.filter(insight => 
      now - insight.timestamp < maxAge
    );
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback([...this.insights]);
      } catch (error) {
        console.error('Error notifying analytics subscriber:', error);
      }
    });
  }

  // Placeholder methods for historical data (would integrate with actual storage)
  private getHistoricalFrequency(key: string, window: number): number {
    // This would query historical data to establish baselines
    return 1; // Placeholder
  }

  private getHistoricalErrorRate(): number {
    // This would calculate historical error rate baseline
    return 0.05; // 5% placeholder
  }

  // Public API
  subscribe(callback: (insights: AnalyticsInsight[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  getInsights(): AnalyticsInsight[] {
    return [...this.insights];
  }

  getPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  clearInsights(): void {
    this.insights = [];
    this.notifySubscribers();
  }

  clearPatterns(): void {
    this.patterns.clear();
  }
}

// Singleton instance
let analyticsInstance: AdvancedAnalyticsEngine | null = null;

export function getAnalyticsEngine(config?: Partial<AnalyticsConfig>): AdvancedAnalyticsEngine {
  if (typeof window === 'undefined') {
    // Create a temporary instance for server-side rendering
    return new AdvancedAnalyticsEngine(config);
  }
  
  if (!analyticsInstance) {
    analyticsInstance = new AdvancedAnalyticsEngine(config);
  }
  return analyticsInstance;
}

export { AdvancedAnalyticsEngine };