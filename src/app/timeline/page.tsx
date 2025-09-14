"use client";

import { useState, useEffect } from 'react';
import { useLiveCounts } from '@/hooks/useLiveCounts';
import { useGlobalTimeline } from '@/lib/globalTimeline';
import dynamic from 'next/dynamic';

// Dynamically import components to avoid SSR issues
const EnhancedTimeline = dynamic(() => import('@/components/EnhancedTimeline'), { ssr: false });
const GlobalTimelineWidget = dynamic(() => import('@/components/GlobalTimelineWidget'), { ssr: false });
const InsightsPanel = dynamic(() => import('@/components/InsightsPanel'), { ssr: false });

export default function TimelinePage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <div className="text-white text-lg">Loading Timeline...</div>
          </div>
        </div>
      </div>
    );
  }

  return <TimelinePageContent />;
}

function TimelinePageContent() {
  const [selectedCorrelation, setSelectedCorrelation] = useState<string | undefined>();
  const { counts } = useLiveCounts();
  const { state, subscribe, getAllCorrelations } = useGlobalTimeline();
  const [timelineState, setTimelineState] = useState(state);

  useEffect(() => {
    const unsub = subscribe(setTimelineState);
    return unsub;
  }, [subscribe]);

  const handleCorrelationSelect = (correlationId: string) => {
    setSelectedCorrelation(correlationId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Global Timeline & Analytics</h1>
          <p className="text-gray-400">
            Real-time event correlation, pattern detection, and advanced analytics across your entire system.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{(counts.requests ?? 0) + (counts.logs ?? 0) + (counts.events ?? 0) + (counts.metrics ?? 0)}</div>
            <div className="text-sm text-gray-400">Total Events</div>
            <div className="text-xs text-gray-500 mt-1">
              Live tracking active
            </div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{getAllCorrelations().length}</div>
            <div className="text-sm text-gray-400">Correlations</div>
            <div className="text-xs text-gray-500 mt-1">
              Cross-service traces
            </div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{timelineState.insights?.length ?? 0}</div>
            <div className="text-sm text-gray-400">Insights</div>
            <div className="text-xs text-gray-500 mt-1">
              Analytics active
            </div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">{new Set((timelineState.events || []).map(e => e.service).filter(Boolean)).size}</div>
            <div className="text-sm text-gray-400">Services</div>
            <div className="text-xs text-gray-500 mt-1">
              Active services
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline - Takes up 2 columns on large screens */}
          <div className="lg:col-span-2">
            <EnhancedTimeline
              height={400}
              showFilters={true}
              showCorrelations={true}
              selectedCorrelationId={selectedCorrelation}
              onCorrelationSelect={handleCorrelationSelect}
            />
            
            {/* Global Timeline Widget (full view) */}
            <div className="mt-6">
              <GlobalTimelineWidget className="w-full" />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Insights Panel */}
            <InsightsPanel maxInsights={8} />
            
            {/* Quick Actions */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => window.location.href = '/requests'}
                  className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">🌐</span>
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">View Requests</div>
                      <div className="text-xs text-gray-400">HTTP request analysis</div>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                <button
                  onClick={() => window.location.href = '/events'}
                  className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">⚡</span>
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">Live Events</div>
                      <div className="text-xs text-gray-400">Real-time streaming</div>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                <button
                  onClick={() => window.location.href = '/metrics'}
                  className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">📈</span>
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">Metrics</div>
                      <div className="text-xs text-gray-400">Performance data</div>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Getting Started */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Getting Started</h3>
              
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-400 mt-0.5">1.</span>
                  <span>Send OTLP data to <code className="bg-gray-700 px-1 rounded">/api/ingest/otlp</code></span>
                </div>
                
                <div className="flex items-start space-x-2">
                  <span className="text-blue-400 mt-0.5">2.</span>
                  <span>Events will appear in real-time with correlation tracking</span>
                </div>
                
                <div className="flex items-start space-x-2">
                  <span className="text-blue-400 mt-0.5">3.</span>
                  <span>Analytics engine will detect patterns and anomalies</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-700 text-center text-gray-400">
          <p className="text-sm">
            Advanced OTLP integration with real-time correlation tracking and analytics
          </p>
        </div>
      </div>
    </div>
  );
}