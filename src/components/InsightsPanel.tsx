"use client";

import { useState, useEffect } from 'react';
import { useGlobalTimeline } from '@/lib/globalTimeline';
import type { AnalyticsInsight } from '@/lib/analytics';

interface InsightsPanelProps {
  className?: string;
  maxInsights?: number;
  autoHide?: boolean;
}

export default function InsightsPanel({ 
  className = '', 
  maxInsights = 10,
  autoHide = false
}: InsightsPanelProps) {
  const { 
    state, 
    subscribe, 
    getInsights, 
    dismissInsight,
    enableAnalytics
  } = useGlobalTimeline();
  
  const [localState, setLocalState] = useState(state);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(!autoHide);

  useEffect(() => {
    const unsubscribe = subscribe(setLocalState);
    return unsubscribe;
  }, [subscribe]);

  const insights = getInsights().slice(0, maxInsights);
  const criticalInsights = insights.filter(i => i.severity === 'critical');
  const highInsights = insights.filter(i => i.severity === 'high');
  const mediumInsights = insights.filter(i => i.severity === 'medium');
  const lowInsights = insights.filter(i => i.severity === 'low');

  const getInsightIcon = (insight: AnalyticsInsight) => {
    switch (insight.type) {
      case 'error': return '🔥';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return '📊';
    }
  };

  const getSeverityColor = (severity: AnalyticsInsight['severity']) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-900/20';
      case 'high': return 'border-orange-500 bg-orange-900/20';
      case 'medium': return 'border-yellow-500 bg-yellow-900/20';
      case 'low': return 'border-blue-500 bg-blue-900/20';
      default: return 'border-gray-500 bg-gray-900/20';
    }
  };

  const getTypeColor = (type: AnalyticsInsight['type']) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-orange-400';
      case 'info': return 'text-blue-400';
      case 'success': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const handleInsightClick = (insight: AnalyticsInsight) => {
    setExpandedInsight(expandedInsight === insight.id ? null : insight.id);
  };

  const handleDismiss = (insightId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    dismissInsight(insightId);
  };

  if (autoHide && insights.length === 0) {
    return null;
  }

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-white">Analytics Insights</h3>
          {insights.length > 0 && (
            <div className="flex items-center space-x-2">
              {criticalInsights.length > 0 && (
                <span className="px-2 py-1 text-xs bg-red-600 text-white rounded">
                  {criticalInsights.length} Critical
                </span>
              )}
              {highInsights.length > 0 && (
                <span className="px-2 py-1 text-xs bg-orange-600 text-white rounded">
                  {highInsights.length} High
                </span>
              )}
              {mediumInsights.length > 0 && (
                <span className="px-2 py-1 text-xs bg-yellow-600 text-white rounded">
                  {mediumInsights.length} Medium
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => enableAnalytics(!localState.analyticsEnabled)}
            className={`px-3 py-1 text-sm rounded ${
              localState.analyticsEnabled
                ? 'bg-green-600 text-white'
                : 'bg-gray-600 text-gray-300'
            }`}
          >
            {localState.analyticsEnabled ? 'Analytics On' : 'Analytics Off'}
          </button>
          
          {autoHide && (
            <button
              onClick={() => setIsVisible(!isVisible)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isVisible && (
        <div className="p-4">
          {!localState.analyticsEnabled && (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-sm">Analytics is disabled</div>
              <button
                onClick={() => enableAnalytics(true)}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Enable Analytics
              </button>
            </div>
          )}

          {localState.analyticsEnabled && insights.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">🔍</div>
              <div className="text-sm">No insights yet</div>
              <div className="text-xs mt-1">Analytics is running in the background</div>
            </div>
          )}

          {localState.analyticsEnabled && insights.length > 0 && (
            <div className="space-y-3">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-all hover:border-opacity-70 ${getSeverityColor(insight.severity)}`}
                  onClick={() => handleInsightClick(insight)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <span className="text-xl mt-0.5">{getInsightIcon(insight)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-white truncate">
                            {insight.title}
                          </h4>
                          <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(insight.type)} bg-current bg-opacity-20`}>
                            {insight.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mt-1">
                          {insight.description}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">
                            {formatTimestamp(insight.timestamp)} • Source: {insight.source}
                          </span>
                          {insight.relatedEvents.length > 0 && (
                            <span className="text-xs text-blue-400">
                              {insight.relatedEvents.length} related events
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={(e) => handleDismiss(insight.id, e)}
                        className="p-1 text-gray-400 hover:text-white"
                        title="Dismiss"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedInsight === insight.id && (
                    <div className="mt-4 pt-3 border-t border-gray-600">
                      {insight.recommendations && insight.recommendations.length > 0 && (
                        <div className="mb-3">
                          <h5 className="text-xs font-medium text-gray-400 mb-2">Recommendations:</h5>
                          <ul className="space-y-1">
                            {insight.recommendations.map((rec, index) => (
                              <li key={index} className="text-xs text-gray-300 flex items-start space-x-2">
                                <span className="text-blue-400 mt-0.5">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {insight.relatedEvents.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-400 mb-2">
                            Related Events ({insight.relatedEvents.length}):
                          </h5>
                          <div className="text-xs text-gray-400 font-mono">
                            {insight.relatedEvents.slice(0, 5).map((eventId, index) => (
                              <div key={index} className="truncate">
                                {eventId}
                              </div>
                            ))}
                            {insight.relatedEvents.length > 5 && (
                              <div className="text-blue-400">
                                +{insight.relatedEvents.length - 5} more...
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}