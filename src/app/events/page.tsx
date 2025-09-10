"use client";
import { useState, useEffect, useMemo } from "react";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import { rangeToFromTo } from "@/lib/time";
import { getRangeEvents, getIngestMetrics } from "@/lib/api";

type LiveSSEData = { 
  type?: string; 
  data?: { 
    name?: string; 
    timestamp?: string; 
    payload?: { 
      correlationId?: string; 
      statusCode?: number; 
      responseTimeMs?: number;
      metadata?: Record<string, unknown> 
    } 
  } | Record<string, unknown> 
};
type LiveEvt = { id?: string; t?: number; data?: LiveSSEData };
type EventEntry = { 
  id: string; 
  name: string; 
  timestamp: string; 
  correlationId?: string; 
  statusCode?: number; 
  responseTimeMs?: number;
  service?: string;
};

interface IngestMetrics {
  requests: number;
  logs: number;
  events: number;
}

export default function EventsPage() {
  const [range, setRange] = useState("5m");
  const [live, setLive] = useState(true);
  const [transport] = useState<"sse" | "ws">("sse");
  const [filterService, setFilterService] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [ingestMetrics, setIngestMetrics] = useState<IngestMetrics | null>(null);
  
  const { events: liveEvents, status } = useLiveFeed<LiveSSEData>(live, transport, 100);
  const [manualEvents, setManualEvents] = useState<EventEntry[]>([]);

  // Fetch range data
  const fetchRange = async () => {
    const { from, to } = rangeToFromTo(range);
    try {
      const data = (await getRangeEvents({ from, to, userScope: "all", limit: 100 })) as EventEntry[];
      setManualEvents(data);
      setLive(false);
    } catch (error) {
      console.error("Failed to fetch range data:", error);
      setManualEvents([]);
    }
  };

  // Fetch metrics periodically
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const metrics = await getIngestMetrics();
        setIngestMetrics(metrics);
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh range data
  useEffect(() => {
    if (!live || transport === "ws") return;
    const timer = setInterval(() => {
      const { from, to } = rangeToFromTo(range);
      getRangeEvents({ from, to, userScope: "all", limit: 100 })
        .then((data) => setManualEvents(data as EventEntry[]))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [range, live, transport]);

  // Convert live events to event entries
  const liveEventEntries = useMemo(() => {
    return (liveEvents as LiveEvt[]).map((evt): EventEntry => {
      const eventData = evt.data?.data && typeof evt.data.data === 'object' ? evt.data.data as Record<string, unknown> : {};
      const payload = eventData.payload && typeof eventData.payload === 'object' ? eventData.payload as Record<string, unknown> : {};
      const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata as Record<string, unknown> : {};
      
      return {
        id: evt.id || Math.random().toString(),
        name: typeof eventData.name === 'string' ? eventData.name : 'event',
        timestamp: typeof eventData.timestamp === 'string' ? eventData.timestamp : new Date(evt.t || Date.now()).toISOString(),
        correlationId: typeof payload.correlationId === 'string' ? payload.correlationId : undefined,
        statusCode: typeof payload.statusCode === 'number' ? payload.statusCode : undefined,
        responseTimeMs: typeof payload.responseTimeMs === 'number' ? payload.responseTimeMs : undefined,
        service: typeof metadata.service === 'string' ? metadata.service : 'unknown'
      };
    });
  }, [liveEvents]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let events = live ? liveEventEntries : manualEvents;
    
    if (filterService !== "all") {
      events = events.filter(event => event.service === filterService);
    }
    
    if (filterStatus !== "all") {
      if (filterStatus === "success") {
        events = events.filter(event => !event.statusCode || (event.statusCode >= 200 && event.statusCode < 300));
      } else if (filterStatus === "error") {
        events = events.filter(event => event.statusCode && event.statusCode >= 400);
      }
    }
    
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [live, liveEventEntries, manualEvents, filterService, filterStatus]);

  // Get unique services for filters
  const services = useMemo(() => {
    const allServices = filteredEvents.map(event => event.service).filter(Boolean);
    return ['all', ...Array.from(new Set(allServices))];
  }, [filteredEvents]);

  const getStatusColor = (statusCode?: number) => {
    if (!statusCode) return 'text-gray-400';
    if (statusCode >= 200 && statusCode < 300) return 'text-green-400';
    if (statusCode >= 300 && statusCode < 400) return 'text-blue-400';
    if (statusCode >= 400 && statusCode < 500) return 'text-yellow-400';
    if (statusCode >= 500) return 'text-red-400';
    return 'text-gray-400';
  };

  const getStatusBg = (statusCode?: number) => {
    if (!statusCode) return 'bg-gray-500/20 border-gray-500/30';
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-500/20 border-green-500/30';
    if (statusCode >= 300 && statusCode < 400) return 'bg-blue-500/20 border-blue-500/30';
    if (statusCode >= 400 && statusCode < 500) return 'bg-yellow-500/20 border-yellow-500/30';
    if (statusCode >= 500) return 'bg-red-500/20 border-red-500/30';
    return 'bg-gray-500/20 border-gray-500/30';
  };

  return (
    <div className="pt-16 min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white">
      <div className="mx-auto p-6 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            ⚡ Events Dashboard
          </h1>
          <p className="text-sm text-neutral-400">Real-time application events and performance monitoring</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <span className="text-lg">🎯</span>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Total Events</p>
                <p className="text-xl font-semibold text-white">{ingestMetrics?.events || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <span className="text-lg">🔄</span>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Live Feed</p>
                <p className="text-xl font-semibold text-white">{live ? "Active" : "Paused"}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <span className="text-lg">⏱️</span>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Time Range</p>
                <p className="text-xl font-semibold text-white">{range}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <span className="text-lg">📊</span>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Filtered Events</p>
                <p className="text-xl font-semibold text-white">{filteredEvents.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <button
                onClick={() => setLive(!live)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  live
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-600 hover:bg-gray-700 text-white"
                }`}
              >
                {live ? "🔴 Live" : "⏸️ Paused"}
              </button>

              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                aria-label="Select time range"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="1m">Last 1 minute</option>
                <option value="5m">Last 5 minutes</option>
                <option value="15m">Last 15 minutes</option>
                <option value="1h">Last hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="24h">Last 24 hours</option>
              </select>

              <button
                onClick={fetchRange}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                📈 Fetch Range
              </button>
            </div>

            <div className="flex gap-4 items-center">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter by status"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Status</option>
                <option value="success">Success (2xx)</option>
                <option value="error">Error (4xx/5xx)</option>
              </select>

              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                aria-label="Filter by service"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                {services.map(service => (
                  <option key={service || 'unknown'} value={service || 'all'}>
                    {service === 'all' ? 'All Services' : service || 'unknown'}
                  </option>
                ))}
              </select>

              <button
                onClick={async () => {
                  try {
                    await fetch('/api/events/clear', { method: 'POST' });
                    setManualEvents([]);
                  } catch (error) {
                    console.error('Failed to clear events:', error);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                🗑️ Clear
              </button>
            </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Live Event Stream</h2>
            <p className="text-sm text-neutral-400 mt-1">
              Status: <span className={live ? "text-green-400" : "text-orange-400"}>
                {live ? "🟢 Live Feed" : "⏸️ Historical Data"}
              </span>
              <span className="ml-4">Transport: {transport.toUpperCase()}</span>
              <span className="ml-4">Connection: {status}</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-neutral-300">Time</th>
                  <th className="text-left p-4 text-sm font-medium text-neutral-300">Event</th>
                  <th className="text-left p-4 text-sm font-medium text-neutral-300">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-neutral-300">Response Time</th>
                  <th className="text-left p-4 text-sm font-medium text-neutral-300">Service</th>
                  <th className="text-left p-4 text-sm font-medium text-neutral-300">Correlation ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-neutral-400">
                      No events available. {live ? "Waiting for events..." : "Try fetching a different time range."}
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event, index) => (
                    <tr key={event.id || index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-sm text-neutral-300">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-4 text-sm text-white font-medium">
                        {event.name}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBg(event.statusCode)}`}>
                          <span className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(event.statusCode)}`}></span>
                          {event.statusCode || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-neutral-300">
                        {event.responseTimeMs ? (
                          <span className={`${event.responseTimeMs > 1000 ? 'text-red-400' : event.responseTimeMs > 500 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {event.responseTimeMs}ms
                          </span>
                        ) : (
                          <span className="text-neutral-600">-</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-neutral-300">
                        <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
                          {event.service || 'unknown'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-neutral-400 font-mono">
                        {event.correlationId ? (
                          <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs">
                            {event.correlationId.slice(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-neutral-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
