'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Filters } from '@/components/Filters';
import { LiveEventTable } from '@/components/LiveEventTable';
import { useLiveFeed } from '@/hooks/useLiveFeed';
import { ChartRenderer } from '@/components/ChartRenderer';

interface RequestAnalytics {
  successRate: number;
  errorRate: number;
  totalRequests: number;
  totalErrors: number;
  latencyStats: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  pathAnalytics: Array<{
    path: string;
    method: string;
    count: number;
    errorCount: number;
    successRate: number;
    errorRate: number;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    errorCodes: Record<string, number>;
  }>;
  errorCodeDistribution: Record<string, number>;
  ipAddresses: Array<{
    ip: string;
    requestCount: number;
    errorCount: number;
    lastSeen: string;
  }>;
}

export default function RequestsPage() {
  const { events: liveEvents, loading } = useLiveFeed(100);
  const [analytics, setAnalytics] = useState<RequestAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const response = await fetch('/api/events/request-analytics?hours=24&limit=100');
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch request analytics:', error);
      setAnalyticsError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter for request-related events
  const requestEvents = liveEvents.filter(event => 
    /^(request|http|api|endpoint|span)/i.test(event.eventType || event.type || event.name || '')
  );

  // Success/Error rate chart data
  const successErrorData = analytics ? {
    data: [{
      x: ['Success', 'Error'],
      y: [analytics.successRate, analytics.errorRate],
      type: 'bar' as const,
      marker: {
        color: ['#10B981', '#EF4444']
      }
    }],
    layout: {
      title: 'Success vs Error Rate (%)',
      height: 300,
      margin: { t: 50, r: 20, b: 40, l: 40 }
    }
  } : null;

  // Latency statistics chart
  const latencyData = analytics ? {
    data: [{
      x: ['Min', 'Avg', 'P50', 'P95', 'P99', 'Max'],
      y: [
        analytics.latencyStats.min,
        analytics.latencyStats.avg,
        analytics.latencyStats.p50,
        analytics.latencyStats.p95,
        analytics.latencyStats.p99,
        analytics.latencyStats.max
      ],
      type: 'bar' as const,
      marker: {
        color: '#6366F1'
      }
    }],
    layout: {
      title: 'Latency Statistics (ms)',
      height: 300,
      margin: { t: 50, r: 20, b: 40, l: 60 }
    }
  } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Request Analytics</h1>
          <p className="text-gray-600">Monitor HTTP request performance, success rates, and error patterns</p>
        </div>

        <Filters />

        {/* Analytics Summary Cards */}
        {analyticsLoading ? (
          <div className="mb-8 p-6 bg-white rounded-lg shadow text-center">
            <p className="text-gray-500">Loading analytics...</p>
          </div>
        ) : analyticsError ? (
          <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">Error loading analytics: {analyticsError}</p>
            <button 
              onClick={fetchAnalytics}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : analytics ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Requests</h3>
                <p className="mt-2 text-3xl font-extrabold text-gray-900">{analytics.totalRequests}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Success Rate</h3>
                <p className="mt-2 text-3xl font-extrabold text-green-600">{analytics.successRate.toFixed(1)}%</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Error Rate</h3>
                <p className="mt-2 text-3xl font-extrabold text-red-600">{analytics.errorRate.toFixed(1)}%</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Avg Latency</h3>
                <p className="mt-2 text-3xl font-extrabold text-blue-600">{analytics.latencyStats.avg.toFixed(0)}ms</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {successErrorData && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <ChartRenderer data={successErrorData} />
                </div>
              )}
              {latencyData && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <ChartRenderer data={latencyData} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mb-8 p-6 bg-white rounded-lg shadow text-center">
            <p className="text-gray-500">No analytics data available</p>
          </div>
        )}

        {/* Live Request Events */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Live Request Events (Max 100)</h2>
            <p className="text-sm text-gray-500">Real-time HTTP request and response events</p>
          </div>
          <LiveEventTable events={requestEvents} loading={loading} />
        </div>
      </main>
    </div>
  );
}
