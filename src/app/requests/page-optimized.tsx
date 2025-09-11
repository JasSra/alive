"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getRequestAnalytics, getIngestRecent, type RequestAnalytics } from "@/lib/api";
import RequestDetailsPanel from "@/components/RequestDetailsPanel";
import MetricsChartModal from "@/components/MetricsChartModal";
import CompactMemoryIndicator from "@/components/CompactMemoryIndicator";

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
          const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
          const errorRate = bucket.count > 0 ? (bucket.errors / bucket.count) * 100 : 0;
          const barColor = errorRate > 50 ? 'bg-red-500' : errorRate > 20 ? 'bg-yellow-500' : 'bg-blue-500';
          
          return (
            <div
              key={i}
              className="group relative flex-shrink-0 w-2 cursor-pointer hover:w-3 transition-all h-full"
              title={`${new Date(bucket.time).toLocaleTimeString()}: ${bucket.count} requests${bucket.errors > 0 ? `, ${bucket.errors} errors` : ''}`}
            >
              <div 
                className={`w-full ${barColor} rounded-sm transition-all`}
                style={{ 
                  height: `${height}%`, 
                  transform: `translateY(${100 - height}%)` 
                }}
              />
              
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

// Lightweight metrics cards
function MetricsCards({ 
  analytics, 
  requestCount, 
  onChartClick 
}: { 
  analytics: RequestAnalytics | null;
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
  const [analytics, setAnalytics] = useState<RequestAnalytics | null>(null);
  const [requests, setRequests] = useState<IngestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Simplified filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [limit, setLimit] = useState(50);
  
  // Panel state
  const [selectedRequest, setSelectedRequest] = useState<IngestRequest | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
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

  // Optimized data fetching
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [analyticsData, requestsData] = await Promise.all([
        getRequestAnalytics({ hours: 24, limit: 1000 }).catch(() => null),
        getIngestRecent({ kind: "requests", limit })
      ]);
      
      if (analyticsData) setAnalytics(analyticsData);
      
      const responseData = requestsData as IngestResponse;
      if (responseData?.data) {
        setRequests(responseData.data);
      }
    } catch (err) {
      console.error("Failed to fetch request data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

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
          
          <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6">
            <h3 className="text-lg font-semibold mb-4">Filters</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status Filter</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'success' | 'error')}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  title="Filter requests by status"
                >
                  <option value="all">All Requests</option>
                  <option value="success">Success (2xx-3xx)</option>
                  <option value="error">Errors (4xx-5xx)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Limit</label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                  title="Set request limit"
                >
                  <option value="25">25 requests</option>
                  <option value="50">50 requests</option>
                  <option value="100">100 requests</option>
                  <option value="200">200 requests</option>
                </select>
              </div>

              <button
                onClick={fetchData}
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed px-4 py-2 rounded font-medium transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </div>
        </div>

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
