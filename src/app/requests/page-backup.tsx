"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getRequestAnalytics, getIngestRecent, type RequestAnalytics } from "@/lib/api";
import LatencyChart from "@/components/LatencyChart";
import RequestDetailsPanel from "@/components/RequestDetailsPanel";
import RequestTimeline from "@/components/RequestTimeline";
import MetricsChartModal from "@/components/MetricsChartModal";
import CompactMemoryIndicator from "@/components/CompactMemoryIndicator";

interface IngestRequest {
  t: number; // epoch ms
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

export default function RequestsPage() {
  const [hours, setHours] = useState(1);
  const [limit, setLimit] = useState(100);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPath, setFilterPath] = useState("all");
  const [analytics, setAnalytics] = useState<RequestAnalytics | null>(null);
  const [requests, setRequests] = useState<IngestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Panel state for request details
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

  // Handle request row click
  const handleRequestClick = (request: IngestRequest) => {
    setSelectedRequest(request);
    setIsPanelOpen(true);
  };

  const closePanelHandler = () => {
    setIsPanelOpen(false);
    setSelectedRequest(null);
  };

  // Chart modal handlers
  const showChart = (title: string, data: Array<{ label: string; value: number; color: string; bgColor: string }>) => {
    setChartModal({
      isOpen: true,
      title,
      data
    });
  };

  const closeChart = () => {
    setChartModal(prev => ({ ...prev, isOpen: false }));
  };

  // Generate chart data for different metrics
  const generateTotalRequestsChart = () => {
    if (!analytics) return;
    const data = [
      { 
        label: 'Successful Requests', 
        value: analytics.totalRequests - (analytics.totalRequests * analytics.errorRate / 100), 
        color: 'rgb(34, 197, 94)', 
        bgColor: 'rgba(34, 197, 94, 0.6)' 
      },
      { 
        label: 'Failed Requests', 
        value: analytics.totalRequests * analytics.errorRate / 100, 
        color: 'rgb(239, 68, 68)', 
        bgColor: 'rgba(239, 68, 68, 0.6)' 
      },
    ];
    showChart('Total Requests Breakdown', data);
  };

  const generateSuccessRateChart = () => {
    if (!analytics) return;
    const successRate = 100 - analytics.errorRate;
    const data = [
      { 
        label: 'Success Rate', 
        value: successRate, 
        color: 'rgb(34, 197, 94)', 
        bgColor: 'rgba(34, 197, 94, 0.6)' 
      },
      { 
        label: 'Error Rate', 
        value: analytics.errorRate, 
        color: 'rgb(239, 68, 68)', 
        bgColor: 'rgba(239, 68, 68, 0.6)' 
      },
    ];
    showChart('Success vs Error Rate', data);
  };

  const generateLatencyChart = () => {
    if (!analytics) return;
    const data = [
      { 
        label: 'Minimum Latency', 
        value: analytics.latencyStats.min || 0, 
        color: 'rgb(34, 197, 94)', 
        bgColor: 'rgba(34, 197, 94, 0.6)' 
      },
      { 
        label: 'Average Latency', 
        value: analytics.latencyStats.avg || 0, 
        color: 'rgb(59, 130, 246)', 
        bgColor: 'rgba(59, 130, 246, 0.6)' 
      },
      { 
        label: 'Maximum Latency', 
        value: analytics.latencyStats.max || 0, 
        color: 'rgb(239, 68, 68)', 
        bgColor: 'rgba(239, 68, 68, 0.6)' 
      },
    ];
    showChart('Latency Distribution', data);
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [analyticsData, requestsData] = await Promise.all([
        getRequestAnalytics({ hours, limit: 1000 }),
        getIngestRecent({ kind: "requests", limit })
      ]);
      
      setAnalytics(analyticsData);
      setRequests((requestsData as IngestResponse).data || []);
    } catch (err) {
      console.error("Failed to fetch request data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [hours, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const timer = setInterval(fetchData, 10000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // Filter and process requests
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (filterStatus !== "all") {
        if (filterStatus === "success" && (!req.status || req.status < 200 || req.status >= 300)) return false;
        if (filterStatus === "error" && (!req.status || req.status < 400)) return false;
      }
      if (filterPath !== "all" && req.path !== filterPath) return false;
      return true;
    }).sort((a, b) => b.t - a.t);
  }, [requests, filterStatus, filterPath]);

  // Get unique paths for filter
  const uniquePaths = useMemo(() => {
    const paths = new Set(requests.map(req => req.path).filter(Boolean));
    return Array.from(paths).sort();
  }, [requests]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return filteredRequests
      .filter(req => req.duration_ms && req.duration_ms > 0)
      .slice(0, 50) // Limit for performance
      .map(req => ({
        time: new Date(req.t).toISOString(),
        latency: req.duration_ms || 0,
        status: req.status
      }));
  }, [filteredRequests]);

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading request analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white pt-16">
      {/* Page Header */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Request Analytics</h1>
              <p className="text-gray-400 mt-1">Monitor HTTP requests, responses, and performance metrics</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${!error ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm text-gray-400">
                  {!error ? 'Active' : 'Error'}
                </span>
              </div>
              {analytics && (
                <div className="text-sm text-gray-400">
                  {analytics.totalRequests} requests analyzed
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-8">
            <p className="text-red-300">Error: {error}</p>
            <button
              onClick={fetchData}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-300">Time Range:</label>
              <select 
                value={hours}
                onChange={(e) => setHours(parseInt(e.target.value))}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500"
                title="Select time range"
              >
                <option value={1}>1 Hour</option>
                <option value={6}>6 Hours</option>
                <option value={24}>24 Hours</option>
                <option value={72}>3 Days</option>
                <option value={168}>1 Week</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-300">Status:</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500"
                title="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="success">Success (2xx)</option>
                <option value="error">Error (4xx-5xx)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-300">Path:</label>
              <select 
                value={filterPath}
                onChange={(e) => setFilterPath(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 max-w-xs"
                title="Filter by path"
              >
                <option value="all">All Paths</option>
                {uniquePaths.map(path => (
                  <option key={path} value={path}>{path}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-300">Limit:</label>
              <select 
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500"
                title="Select limit"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Header with Memory Indicator */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Request Analytics</h1>
          <div className="relative">
            <CompactMemoryIndicator />
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div 
            className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6 cursor-pointer hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-200 transform hover:scale-105"
            onClick={generateTotalRequestsChart}
            title="Click to view detailed chart"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm font-medium">Total Requests</p>
                <p className="text-3xl font-bold text-white">{analytics?.totalRequests || 0}</p>
                <p className="text-xs text-blue-200 mt-1">Click for breakdown</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
            </div>
          </div>

          <div 
            className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-xl border border-green-500/30 p-6 cursor-pointer hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-200 transform hover:scale-105"
            onClick={generateSuccessRateChart}
            title="Click to view detailed chart"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-300 text-sm font-medium">Success Rate</p>
                <p className="text-3xl font-bold text-white">{Math.round(analytics?.successRate || 0)}%</p>
                <p className="text-xs text-green-200 mt-1">Click for breakdown</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div 
            className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6 cursor-pointer hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-200 transform hover:scale-105"
            onClick={generateLatencyChart}
            title="Click to view detailed chart"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-300 text-sm font-medium">Avg Latency</p>
                <p className="text-3xl font-bold text-white">
                  {analytics?.latencyStats.avg ? 
                    (analytics.latencyStats.avg > 1000 ? 
                      `${(analytics.latencyStats.avg/1000).toFixed(1)}s` : 
                      `${Math.round(analytics.latencyStats.avg)}ms`
                    ) : '0ms'
                  }
                </p>
                <p className="text-xs text-purple-200 mt-1">Click for breakdown</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-xl border border-orange-500/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-300 text-sm font-medium">Error Rate</p>
                <p className="text-3xl font-bold text-white">{Math.round(analytics?.errorRate || 0)}%</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Latency Chart */}
        {chartData.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-8">
            <LatencyChart data={chartData} />
          </div>
        )}

        {/* Path Analytics Table */}
        {analytics?.pathAnalytics && analytics.pathAnalytics.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Path Analytics</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Path</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Method</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Requests</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Success Rate</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Avg Latency</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Error Codes</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.pathAnalytics.slice(0, 10).map((path, index) => (
                    <tr key={`${path.method}-${path.path}-${index}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-white font-mono text-sm max-w-xs truncate" title={path.path}>
                        {path.path}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
                          {path.method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{path.count}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          path.successRate >= 95 ? 'bg-green-500/20 text-green-300' :
                          path.successRate >= 80 ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {path.successRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-mono text-sm">
                        {path.avgLatency > 1000 ? 
                          `${(path.avgLatency/1000).toFixed(1)}s` : 
                          `${Math.round(path.avgLatency)}ms`
                        }
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(path.errorCodes).slice(0, 3).map(([code, count]) => (
                            <span key={code} className="px-1 py-0.5 bg-red-500/20 text-red-300 rounded text-xs">
                              {code}×{count}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* IP Address Analytics */}
        {analytics?.ipAddresses && analytics.ipAddresses.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Client IP Analytics</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">IP Address</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Requests</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Errors</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Error Rate</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.ipAddresses.slice(0, 10).map((ip, index) => (
                    <tr key={`${ip.ip}-${index}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-white font-mono text-sm">{ip.ip}</td>
                      <td className="py-3 px-4 text-gray-300">{ip.requestCount}</td>
                      <td className="py-3 px-4 text-gray-300">{ip.errorCount}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          ip.errorCount === 0 ? 'bg-green-500/20 text-green-300' :
                          (ip.errorCount / ip.requestCount) < 0.1 ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {((ip.errorCount / ip.requestCount) * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-mono text-xs">
                        {new Date(ip.lastSeen).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Request Timeline */}
        <RequestTimeline requests={filteredRequests} autoScroll={true} />

        {/* Recent Requests */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Requests</h3>
            <div className="text-sm text-gray-400">
              Click any row to view details
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Time</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Method</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Path</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Latency</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Service</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.slice(0, 20).map((req, index) => (
                  <tr key={`${req.t}-${index}`} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => handleRequestClick(req)}
                      title="Click to view full request details">
                    <td className="py-2 px-4 text-gray-300 font-mono text-xs">
                      {new Date(req.t).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-4">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
                        {req.method || 'GET'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-gray-300 font-mono text-xs max-w-xs truncate" title={req.path}>
                      {req.path || '—'}
                    </td>
                    <td className="py-2 px-4">
                      {req.status ? (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          req.status >= 200 && req.status < 300 ? 'bg-green-500/20 text-green-300' :
                          req.status >= 400 && req.status < 500 ? 'bg-yellow-500/20 text-yellow-300' :
                          req.status >= 500 ? 'bg-red-500/20 text-red-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                          {req.status}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded text-xs">
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-gray-300 font-mono text-xs">
                      {req.duration_ms ? `${req.duration_ms}ms` : '—'}
                    </td>
                    <td className="py-2 px-4 text-gray-300 text-xs">
                      {req.service || 'unknown'}
                    </td>
                    <td className="py-2 px-4 text-gray-300 font-mono text-xs">
                      {(req.attrs?.clientIp as string) || (req.attrs?.ip as string) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredRequests.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400">No requests found matching current filters</p>
            </div>
          )}
        </div>
      </main>

      {/* Request Details Panel */}
      <RequestDetailsPanel
        isOpen={isPanelOpen}
        onClose={closePanelHandler}
        requestData={selectedRequest}
      />

      {/* Metrics Chart Modal */}
      <MetricsChartModal
        isOpen={chartModal.isOpen}
        onClose={closeChart}
        title={chartModal.title}
        data={chartModal.data}
      />
    </div>
  );
}
