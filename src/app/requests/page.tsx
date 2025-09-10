"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getIngestRecent, type RequestAnalytics } from "@/lib/api";
import RequestDetailsPanel from "@/components/RequestDetailsPanel";
import MetricsChartModal from "@/components/MetricsChartModal";
import CompactMemoryIndicator from "@/components/CompactMemoryIndicator";
import styles from "./filters.module.css";

interface DetailedRequestAnalytics extends RequestAnalytics {
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
  latencyStats: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errorCodeDistribution: Record<string, number>;
  ipAddresses: Array<{
    ip: string;
    requestCount: number;
    errorCount: number;
    lastSeen: string;
  }>;
}

interface IngestRequest {
  t: number;
  service?: string;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  attrs?: Record<string, unknown>;
  raw?: unknown;
  correlationId?: string;
  [key: string]: unknown;
}

interface IngestResponse {
  data: IngestRequest[];
  count: number;
  cap: number;
}

interface AlternativeIngestResponse {
  ok: boolean;
  kind: string;
  count: number;
  items: IngestRequest[];
}

// Lightweight timeline component integrated into the page
function QuickTimeline({ requests }: { requests: IngestRequest[] }) {
  const timelineData = useMemo(() => {
    if (!requests.length) return null;

    // Get the time range from actual data
    const timestamps = requests.map(r => r.t).sort((a, b) => a - b);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime;
    
    // Create reasonable time buckets based on data range
    const bucketCount = Math.min(60, Math.max(10, Math.ceil(timeRange / (5 * 60 * 1000)))); // 5-minute buckets, max 60 buckets
    const bucketSize = timeRange / bucketCount;
    
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      time: minTime + (i * bucketSize),
      count: 0,
      errors: 0
    }));

    // Fill buckets with data
    requests.forEach(req => {
      const bucketIndex = Math.floor((req.t - minTime) / bucketSize);
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        buckets[bucketIndex].count++;
        if (req.status && req.status >= 400) {
          buckets[bucketIndex].errors++;
        }
      }
    });

    return buckets;
  }, [requests]);

  if (!timelineData) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold mb-4">Request Timeline</h3>
        <div className="text-gray-400 text-center py-8">No timeline data available</div>
      </div>
    );
  }

  const maxCount = Math.max(...timelineData.map(b => b.count));

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6">
      <h3 className="text-lg font-semibold mb-4">Request Timeline</h3>
      <div className="flex items-end space-x-1 h-24 overflow-x-auto">
        {timelineData.map((bucket, i) => {
          const height = maxCount > 0 ? Math.round((bucket.count / maxCount) * 12) : 0;
          const errorRate = bucket.count > 0 ? (bucket.errors / bucket.count) * 100 : 0;
          const barColor = errorRate > 50 ? 'bg-red-500' : errorRate > 20 ? 'bg-yellow-500' : 'bg-blue-500';
          
          // Convert height to Tailwind classes
          let heightClass = 'h-1';
          if (height >= 11) heightClass = 'h-12';
          else if (height >= 10) heightClass = 'h-11';
          else if (height >= 9) heightClass = 'h-10';
          else if (height >= 8) heightClass = 'h-9';
          else if (height >= 7) heightClass = 'h-8';
          else if (height >= 6) heightClass = 'h-7';
          else if (height >= 5) heightClass = 'h-6';
          else if (height >= 4) heightClass = 'h-5';
          else if (height >= 3) heightClass = 'h-4';
          else if (height >= 2) heightClass = 'h-3';
          else if (height >= 1) heightClass = 'h-2';
          
          return (
            <div
              key={i}
              className="group relative flex-shrink-0 w-2 cursor-pointer hover:w-3 transition-all h-full flex items-end"
              title={`${new Date(bucket.time).toLocaleTimeString()}: ${bucket.count} requests${bucket.errors > 0 ? `, ${bucket.errors} errors` : ''}`}
            >
              <div className={`w-full ${barColor} ${heightClass} rounded-sm transition-all`} />
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                <div>{new Date(bucket.time).toLocaleTimeString()}</div>
                <div>{bucket.count} requests</div>
                {bucket.errors > 0 && <div className="text-red-300">{bucket.errors} errors</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-gray-400 mt-2 text-center">
        {timelineData.length > 0 && (
          <>
            {new Date(timelineData[0].time).toLocaleString()} - {new Date(timelineData[timelineData.length - 1].time).toLocaleString()}
          </>
        )}
      </div>
    </div>
  );
}

// Path Analytics component
function PathAnalytics({ analytics }: { analytics: DetailedRequestAnalytics | null }) {
  if (!analytics?.pathAnalytics?.length) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-semibold mb-4">Path Analytics</h3>
        <div className="text-gray-400 text-center py-8">No path analytics available</div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6">
      <h3 className="text-lg font-semibold mb-4">Path Analytics</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 font-medium">Path</th>
              <th className="text-left py-2 px-3 font-medium">Method</th>
              <th className="text-right py-2 px-3 font-medium">Requests</th>
              <th className="text-right py-2 px-3 font-medium">Success Rate</th>
              <th className="text-right py-2 px-3 font-medium">Avg Latency</th>
              <th className="text-right py-2 px-3 font-medium">Errors</th>
            </tr>
          </thead>
          <tbody>
            {analytics.pathAnalytics.slice(0, 10).map((path) => (
              <tr key={`${path.path}-${path.method}`} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2 px-3 font-mono text-xs text-blue-300 truncate max-w-xs" title={path.path}>
                  {path.path}
                </td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-1 text-xs rounded font-medium ${
                    path.method === 'GET' ? 'bg-green-500/20 text-green-300' :
                    path.method === 'POST' ? 'bg-blue-500/20 text-blue-300' :
                    path.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-300' :
                    path.method === 'DELETE' ? 'bg-red-500/20 text-red-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>
                    {path.method}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-medium">{path.count.toLocaleString()}</td>
                <td className="py-2 px-3 text-right">
                  <span className={`font-medium ${
                    path.successRate >= 95 ? 'text-green-400' :
                    path.successRate >= 90 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {path.successRate.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-medium">
                  {path.avgLatency.toFixed(0)}ms
                </td>
                <td className="py-2 px-3 text-right">
                  {path.errorCount > 0 ? (
                    <span className="text-red-400 font-medium">{path.errorCount}</span>
                  ) : (
                    <span className="text-gray-500">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {analytics.pathAnalytics.length > 10 && (
          <div className="text-center mt-4">
            <span className="text-gray-400 text-xs">
              Showing top 10 of {analytics.pathAnalytics.length} paths
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Lightweight metrics cards
function MetricsCards({ 
  analytics, 
  requestCount, 
  onChartClick 
}: { 
  analytics: DetailedRequestAnalytics | null;
  requestCount: number;
  onChartClick: (type: string) => void;
}) {
  if (!analytics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 animate-pulse">
            <div className="h-4 bg-white/10 rounded mb-2"></div>
            <div className="h-8 bg-white/10 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const successRate = 100 - analytics.errorRate;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div 
        className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 cursor-pointer hover:bg-white/10 transition-all group"
        onClick={() => onChartClick('requests')}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm group-hover:text-gray-300">Total Requests</p>
            <p className="text-2xl font-bold text-white">{requestCount.toLocaleString()}</p>
          </div>
          <div className="text-blue-400 group-hover:text-blue-300">📊</div>
        </div>
      </div>

      <div 
        className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 cursor-pointer hover:bg-white/10 transition-all group"
        onClick={() => onChartClick('success')}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm group-hover:text-gray-300">Success Rate</p>
            <p className="text-2xl font-bold text-green-400">{successRate.toFixed(1)}%</p>
          </div>
          <div className="text-green-400 group-hover:text-green-300">✅</div>
        </div>
      </div>

      <div 
        className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 cursor-pointer hover:bg-white/10 transition-all group"
        onClick={() => onChartClick('latency')}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm group-hover:text-gray-300">Avg Latency</p>
            <p className="text-2xl font-bold text-yellow-400">{analytics.latencyStats.avg.toFixed(0)}ms</p>
          </div>
          <div className="text-yellow-400 group-hover:text-yellow-300">⚡</div>
        </div>
      </div>

      <div 
        className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 cursor-pointer hover:bg-white/10 transition-all group"
        onClick={() => onChartClick('errors')}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm group-hover:text-gray-300">Error Rate</p>
            <p className="text-2xl font-bold text-red-400">{analytics.errorRate.toFixed(1)}%</p>
          </div>
          <div className="text-red-400 group-hover:text-red-300">🚨</div>
        </div>
      </div>
    </div>
  );
}

export default function RequestsPage() {
  const [analytics, setAnalytics] = useState<DetailedRequestAnalytics | null>(null);
  const [requests, setRequests] = useState<IngestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Enhanced filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [limit, setLimit] = useState(50);
  
  // Panel state
  const [selectedRequest, setSelectedRequest] = useState<IngestRequest | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Clear data state
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Chart modal state
  const [chartModal, setChartModal] = useState<{
    isOpen: boolean;
    title: string;
    data: Array<{ label: string; value: number; color: string; bgColor: string }>;
  }>({
    isOpen: false,
    title: '',
    data: []
  });

  // Optimized data fetching with time range support
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Convert time range to hours
      const timeRangeHours = {
        '1h': 1,
        '6h': 6, 
        '24h': 24,
        '7d': 168
      }[timeRange];
      
      const [analyticsData, requestsData] = await Promise.all([
        fetch(`/api/events/request-analytics?hours=${timeRangeHours}&limit=1000`)
          .then(res => res.ok ? res.json() : null)
          .catch(() => null),
        getIngestRecent({ kind: "requests", limit })
      ]);
      
      if (analyticsData) setAnalytics(analyticsData);
      
      const responseData = requestsData as IngestResponse;
      if (responseData?.data) {
        setRequests(responseData.data);
      } else if ((requestsData as AlternativeIngestResponse)?.items) {
        // Handle alternative API format with 'items' instead of 'data'
        setRequests((requestsData as AlternativeIngestResponse).items);
      }
    } catch (err) {
      console.error("Failed to fetch request data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [limit, timeRange]);

  // Clear all data function
  const clearAllData = useCallback(async () => {
    try {
      setIsClearing(true);
      const response = await fetch('/api/events/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to clear data');
      }

      const result = await response.json();
      console.log(`Cleared ${result.removed} items from server`);
      
      // Reset local state
      setRequests([]);
      setAnalytics(null);
      setSelectedRequest(null);
      setIsPanelOpen(false);
      setShowClearConfirm(false);
      
      // Refresh data to confirm
      await fetchData();
    } catch (err) {
      console.error("Failed to clear data:", err);
      setError(err instanceof Error ? err.message : "Failed to clear data");
    } finally {
      setIsClearing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds when enabled
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  // Helper function to extract path from URL
  const extractPath = (path: string | undefined): string => {
    if (!path) return 'Unknown';
    try {
      const url = new URL(path);
      return url.pathname;
    } catch {
      return path.startsWith('/') ? path : `/${path}`;
    }
  };

  // Filtered and processed requests
  const filteredRequests = useMemo(() => {
    return requests
      .filter(req => {
        if (statusFilter === 'success') {
          return req.status && req.status >= 200 && req.status < 400;
        }
        if (statusFilter === 'error') {
          return req.status && req.status >= 400;
        }
        return true;
      })
      .sort((a, b) => b.t - a.t);
  }, [requests, statusFilter]);

  // Chart generation functions
  const generateChart = (type: string) => {
    if (!analytics) return;
    
    let title = '';
    let data: Array<{ label: string; value: number; color: string; bgColor: string }> = [];
    
    switch (type) {
      case 'requests':
        title = 'Request Status Distribution';
        data = [
          { label: 'Successful', value: Math.round(filteredRequests.filter(r => r.status && r.status < 400).length), color: 'rgb(34, 197, 94)', bgColor: 'rgba(34, 197, 94, 0.6)' },
          { label: 'Client Errors (4xx)', value: Math.round(filteredRequests.filter(r => r.status && r.status >= 400 && r.status < 500).length), color: 'rgb(251, 191, 36)', bgColor: 'rgba(251, 191, 36, 0.6)' },
          { label: 'Server Errors (5xx)', value: Math.round(filteredRequests.filter(r => r.status && r.status >= 500).length), color: 'rgb(239, 68, 68)', bgColor: 'rgba(239, 68, 68, 0.6)' },
        ];
        break;
      case 'success':
        title = 'Success Rate Breakdown';
        data = [
          { label: 'Success Rate', value: Math.round(100 - analytics.errorRate), color: 'rgb(34, 197, 94)', bgColor: 'rgba(34, 197, 94, 0.6)' },
          { label: 'Error Rate', value: Math.round(analytics.errorRate), color: 'rgb(239, 68, 68)', bgColor: 'rgba(239, 68, 68, 0.6)' },
        ];
        break;
      case 'latency':
        title = 'Latency Distribution';
        const latencies = filteredRequests.filter(r => r.duration_ms).map(r => r.duration_ms!);
        if (latencies.length > 0) {
          const fast = latencies.filter(l => l < 100).length;
          const medium = latencies.filter(l => l >= 100 && l < 500).length;
          const slow = latencies.filter(l => l >= 500).length;
          data = [
            { label: 'Fast (<100ms)', value: fast, color: 'rgb(34, 197, 94)', bgColor: 'rgba(34, 197, 94, 0.6)' },
            { label: 'Medium (100-500ms)', value: medium, color: 'rgb(251, 191, 36)', bgColor: 'rgba(251, 191, 36, 0.6)' },
            { label: 'Slow (>500ms)', value: slow, color: 'rgb(239, 68, 68)', bgColor: 'rgba(239, 68, 68, 0.6)' },
          ];
        }
        break;
      case 'errors':
        title = 'Error Analysis';
        const errors4xx = filteredRequests.filter(r => r.status && r.status >= 400 && r.status < 500).length;
        const errors5xx = filteredRequests.filter(r => r.status && r.status >= 500).length;
        const success = filteredRequests.filter(r => r.status && r.status < 400).length;
        data = [
          { label: 'Successful', value: success, color: 'rgb(34, 197, 94)', bgColor: 'rgba(34, 197, 94, 0.6)' },
          { label: '4xx Errors', value: errors4xx, color: 'rgb(251, 191, 36)', bgColor: 'rgba(251, 191, 36, 0.6)' },
          { label: '5xx Errors', value: errors5xx, color: 'rgb(239, 68, 68)', bgColor: 'rgba(239, 68, 68, 0.6)' },
        ];
        break;
    }
    
    setChartModal({ isOpen: true, title, data });
  };

  if (loading && requests.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading request data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white pt-16">
      {/* Header with Memory Indicator */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Request Monitoring</h1>
              <p className="text-gray-400 mt-1">
                {filteredRequests.length} requests • {statusFilter === 'all' ? 'All' : statusFilter} • Last updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
            <CompactMemoryIndicator />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">⚠️ {error}</p>
            <button 
              onClick={fetchData}
              className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Metrics Cards */}
        <MetricsCards 
          analytics={analytics}
          requestCount={filteredRequests.length}
          onChartClick={generateChart}
        />

        {/* Timeline and Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <QuickTimeline requests={filteredRequests} />
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <h3 className="text-lg font-semibold">Filters & Settings</h3>
            </div>
            
            <div className="space-y-6">
              {/* Time Range - Modern Segmented Control */}
              <div>
                <label className="block text-sm font-medium mb-3 text-gray-300">Time Range</label>
                <div className="grid grid-cols-4 gap-1 bg-white/5 p-1 rounded-lg">
                  {['1h', '6h', '24h', '7d'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range as '1h' | '6h' | '24h' | '7d')}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        timeRange === range
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {range === '1h' ? '1 Hour' : 
                       range === '6h' ? '6 Hours' :
                       range === '24h' ? '24 Hours' : '7 Days'}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Status Filter - Modern Pills */}
              <div>
                <label className="block text-sm font-medium mb-3 text-gray-300">Status Filter</label>
                <div className="flex space-x-2">
                  {[
                    { value: 'all', label: 'All', icon: '🌐', bgColor: 'bg-blue-500/20', textColor: 'text-blue-300', borderColor: 'border-blue-500/30' },
                    { value: 'success', label: 'Success', icon: '✅', bgColor: 'bg-green-500/20', textColor: 'text-green-300', borderColor: 'border-green-500/30' },
                    { value: 'error', label: 'Errors', icon: '❌', bgColor: 'bg-red-500/20', textColor: 'text-red-300', borderColor: 'border-red-500/30' }
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setStatusFilter(status.value as 'all' | 'success' | 'error')}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        statusFilter === status.value
                          ? `${status.bgColor} ${status.textColor} border ${status.borderColor}`
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <span className="text-xs">{status.icon}</span>
                      <span>{status.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Limit Slider */}
              <div>
                <label className="block text-sm font-medium mb-3 text-gray-300">
                  Request Limit <span className="text-blue-400 font-mono">({limit})</span>
                </label>
                <div className="space-y-3">
                  <input
                    type="range"
                    min="25"
                    max="500"
                    step="25"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className={`w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer ${styles.slider}`}
                    title={`Set request limit: ${limit} requests`}
                    aria-label="Request limit slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>25</span>
                    <span>250</span>
                    <span>500</span>
                  </div>
                </div>
              </div>

              {/* Auto-refresh Toggle */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
                  <div>
                    <div className="text-sm font-medium">Auto-refresh</div>
                    <div className="text-xs text-gray-400">Update every 30 seconds</div>
                  </div>
                </div>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  title={`${autoRefresh ? 'Disable' : 'Enable'} auto-refresh`}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                    autoRefresh ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      autoRefresh ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchData}
                disabled={loading || isClearing}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-blue-500/50 disabled:to-blue-600/50 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh Data</span>
                  </>
                )}
              </button>

              {/* Clear All Data Button */}
              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={loading || isClearing}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-red-500/50 disabled:to-red-600/50 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <span>🗑️</span>
                  <span>Clear All Data</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-orange-300 text-sm font-medium text-center">⚠️ This will delete ALL data!</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={clearAllData}
                      disabled={isClearing}
                      className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-red-600/50 disabled:to-red-700/50 disabled:cursor-not-allowed px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-1 text-sm"
                    >
                      {isClearing ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Clearing...</span>
                        </>
                      ) : (
                        <>
                          <span>✓</span>
                          <span>Confirm</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      disabled={isClearing}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600/50 disabled:cursor-not-allowed px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-1 text-sm"
                    >
                      <span>✕</span>
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Path Analytics */}
        <PathAnalytics analytics={analytics} />

        {/* Requests Table */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-lg font-semibold">Recent Requests</h3>
            <p className="text-gray-400 text-sm">Click any row to view full details</p>
          </div>
          
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-2">🔍</div>
              <p className="text-gray-400">No requests found</p>
              <p className="text-gray-500 text-sm mt-1">
                {requests.length === 0 ? 'Try generating some test data first' : 'Adjust your filters or refresh the data'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Path</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Latency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredRequests.slice(0, limit).map((request, index) => {
                    const status = request.status || 0;
                    const statusColor = status < 400 ? 'text-green-400' : status < 500 ? 'text-yellow-400' : 'text-red-400';
                    
                    return (
                      <tr
                        key={index}
                        className="hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsPanelOpen(true);
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {new Date(request.t).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                            {request.method || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">
                          {extractPath(request.path)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${statusColor}`}>
                            {status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {request.duration_ms ? `${request.duration_ms}ms` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {request.service || 'Unknown'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Request Details Panel */}
      <RequestDetailsPanel
        requestData={selectedRequest}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />

      {/* Chart Modal */}
      <MetricsChartModal
        isOpen={chartModal.isOpen}
        onClose={() => setChartModal(prev => ({ ...prev, isOpen: false }))}
        title={chartModal.title}
        data={chartModal.data}
      />
    </div>
  );
}
