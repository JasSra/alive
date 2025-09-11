"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getIngestRecent, type RequestAnalytics } from "@/lib/api";
import RequestDetailsPanel from "@/components/RequestDetailsPanel";
import MetricsChartModal from "@/components/MetricsChartModal";
import CompactMemoryIndicator from "@/components/CompactMemoryIndicator";
import InteractiveTimeline from "@/components/InteractiveTimeline";
import ToolbarMenu from "@/components/ToolbarMenu";
import styles from "./requests.module.css";

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
  
  // Timeline state
  const [selectedTimeRange, setSelectedTimeRange] = useState<{ start: number; end: number } | null>(null);
  
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
    let filtered = requests
      .filter(req => {
        if (statusFilter === 'success') {
          return req.status && req.status >= 200 && req.status < 400;
        }
        if (statusFilter === 'error') {
          return req.status && req.status >= 400;
        }
        return true;
      });

    // Apply timeline selection filter
    if (selectedTimeRange && selectedTimeRange.start > 0 && selectedTimeRange.end > 0) {
      filtered = filtered.filter(req => 
        req.t >= selectedTimeRange.start && req.t <= selectedTimeRange.end
      );
    }

    return filtered.sort((a, b) => b.t - a.t);
  }, [requests, statusFilter, selectedTimeRange]);

  // Timeline interaction handlers
  const handleTimeRangeSelect = useCallback((startTime: number, endTime: number) => {
    if (startTime === 0 && endTime === 0) {
      setSelectedTimeRange(null);
    } else {
      setSelectedTimeRange({ start: startTime, end: endTime });
    }
  }, []);

  const handleBucketClick = useCallback((bucket: {
    time: number;
    count: number;
    errors: number;
    avgLatency: number;
    methods: Record<string, number>;
    services: Record<string, number>;
    requests: IngestRequest[];
  }) => {
    // Show details for the clicked time bucket
    console.log('Bucket clicked:', bucket);
    // Could open a modal or panel with bucket details
  }, []);

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
                {filteredRequests.length} requests • {statusFilter === 'all' ? 'All' : statusFilter}
                {selectedTimeRange && (
                  <span className="text-blue-400"> • Time filtered ({new Date(selectedTimeRange.start).toLocaleTimeString()} - {new Date(selectedTimeRange.end).toLocaleTimeString()})</span>
                )}
                • Last updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
            <CompactMemoryIndicator />
          </div>
        </div>
      </div>

      {/* Filters & Settings Bar - Compact Dark Theme */}
      <div className="bg-slate-800/60 backdrop-blur-lg border-b border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-sm shadow-blue-500/50"></div>
              <h3 className="text-sm font-medium text-white">Filters</h3>
            </div>
            
            <div className="flex items-center space-x-4 flex-wrap">
              {/* Time Range - Compact */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium text-slate-300">Time:</label>
                <div className="flex space-x-0.5 bg-slate-700/50 backdrop-blur-sm rounded-md p-0.5 border border-slate-600/50">
                  {['1h', '6h', '24h', '7d'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range as '1h' | '6h' | '24h' | '7d')}
                      className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                        timeRange === range
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Status Filter - Compact */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium text-slate-300">Status:</label>
                <div className="flex space-x-0.5">
                  {[
                    { value: 'all', label: 'All', icon: '🌐' },
                    { value: 'success', label: 'OK', icon: '✅' },
                    { value: 'error', label: 'Err', icon: '❌' }
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setStatusFilter(status.value as 'all' | 'success' | 'error')}
                      className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 ${
                        statusFilter === status.value
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                          : 'bg-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-600/50 border border-slate-600/50'
                      }`}
                    >
                      <span className="text-[10px]">{status.icon}</span>
                      <span>{status.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Request Limit - Compact */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium text-slate-300">
                  Limit: <span className="text-blue-400 font-mono text-[10px]">({limit})</span>
                </label>
                <div className="relative">
                  <input
                    type="range"
                    min="25"
                    max="500"
                    step="25"
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className={`w-16 h-1.5 bg-slate-600 rounded-lg cursor-pointer ${styles.rangeSlider}`}
                    title={`Set request limit: ${limit} requests`}
                    aria-label="Request limit slider"
                  />
                </div>
              </div>

              {/* Auto-refresh Toggle - Compact */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium text-slate-300">Auto:</label>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  title={`${autoRefresh ? 'Disable' : 'Enable'} auto-refresh`}
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors duration-200 ${
                    autoRefresh ? 'bg-blue-600 shadow-sm shadow-blue-600/30' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                      autoRefresh ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Action Buttons - Replaced with Toolbar Menu */}
              <ToolbarMenu
                onRefresh={fetchData}
                onClearData={clearAllData}
                isLoading={loading}
                isClearing={isClearing}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-lg p-4 mb-6 shadow-lg">
            <div className="flex items-center space-x-3 mb-3">
              <div className="text-red-400 text-xl">⚠️</div>
              <p className="text-red-300 font-medium">{error}</p>
            </div>
            <button 
              onClick={fetchData}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 text-sm transition-colors duration-200 flex items-center space-x-2"
            >
              <span>🔄</span>
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Metrics Cards */}
        <MetricsCards 
          analytics={analytics}
          requestCount={filteredRequests.length}
          onChartClick={generateChart}
        />

        {/* Request Timeline - Separate Section */}
        <div className="mb-8 w-full">
          <div className="bg-slate-800/40 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6 shadow-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-sm shadow-green-500/50"></div>
                <h3 className="text-lg font-semibold text-white">Request Timeline</h3>
              </div>
              <div className="text-sm text-slate-400">
                Real-time visualization • {filteredRequests.length} requests
              </div>
            </div>
            <InteractiveTimeline 
              requests={filteredRequests} 
              onTimeRangeSelect={handleTimeRangeSelect}
              onBucketClick={handleBucketClick}
              className="w-full"
            />
          </div>
        </div>

        {/* Path Analytics */}
        <PathAnalytics analytics={analytics} />

        {/* Requests Table */}
        <div className="bg-slate-800/40 backdrop-blur-lg rounded-xl border border-slate-700/50 overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/60">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Recent Requests</h3>
                <p className="text-slate-400 text-sm">Click any row to view full details</p>
              </div>
              <div className="text-sm text-slate-400">
                Showing {Math.min(limit, filteredRequests.length)} of {filteredRequests.length} requests
              </div>
            </div>
          </div>
          
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400 text-6xl mb-4">🔍</div>
              <p className="text-slate-300 text-lg font-medium">No requests found</p>
              <p className="text-slate-500 text-sm mt-2">
                {requests.length === 0 ? 'Try generating some test data first' : 'Adjust your filters or refresh the data'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/60">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Path</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Latency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredRequests.slice(0, limit).map((request, index) => {
                    const status = request.status || 0;
                    const statusColor = status < 400 ? 'text-green-400' : status < 500 ? 'text-yellow-400' : 'text-red-400';
                    
                    return (
                      <tr
                        key={index}
                        className="hover:bg-slate-700/30 cursor-pointer transition-colors duration-150"
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsPanelOpen(true);
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {new Date(request.t).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {request.method || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300 max-w-xs truncate">
                          {extractPath(request.path)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${statusColor}`}>
                            {status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {request.duration_ms ? `${request.duration_ms}ms` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
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
