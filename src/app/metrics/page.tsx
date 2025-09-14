"use client";
import { useCallback, useEffect, useState } from "react";
import { getIngestRecent } from "@/lib/api";
import dynamic from "next/dynamic";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface MetricItem {
  t: number;
  service?: string;
  name: string;
  value?: number | string;
  unit?: string;
  kind?: string;
  attrs?: Record<string, unknown>;
  raw?: unknown;
}

interface MetricStats {
  name: string;
  count: number;
  min?: number;
  max?: number;
  avg?: number;
  latest?: number;
  unit?: string;
  kind?: string;
  service?: string;
}

export default function MetricsPage() {
  const [items, setItems] = useState<MetricItem[]>([]);
  const [limit, setLimit] = useState(500);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'stats' | 'charts' | 'raw'>('table');
  const [selectedMetric, setSelectedMetric] = useState<MetricItem | null>(null);
  const [stats, setStats] = useState<MetricStats[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getIngestRecent({ kind: "metrics", limit });
      setItems(res.items as MetricItem[]);
      calculateStats(res.items as MetricItem[]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const calculateStats = (metrics: MetricItem[]) => {
    const grouped = new Map<string, MetricItem[]>();
    
    metrics.forEach(m => {
      const key = `${m.name || 'unknown'}_${m.service || 'unknown'}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(m);
    });

    const statsArray: MetricStats[] = [];
    grouped.forEach((items, key) => {
      const numericValues = items
        .map(item => typeof item.value === 'number' ? item.value : parseFloat(String(item.value || 0)))
        .filter(v => !isNaN(v));

      const latest = items[0]; // Assuming items are sorted newest first
      
      statsArray.push({
        name: latest.name || 'unknown',
        service: latest.service,
        count: items.length,
        min: numericValues.length > 0 ? Math.min(...numericValues) : undefined,
        max: numericValues.length > 0 ? Math.max(...numericValues) : undefined,
        avg: numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : undefined,
        latest: numericValues.length > 0 ? numericValues[0] : undefined,
        unit: latest.unit,
        kind: latest.kind,
      });
    });

    setStats(statsArray.sort((a, b) => b.count - a.count));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10000); // Refresh every 10 seconds
    return () => clearInterval(id);
  }, [limit, load]);

  const renderStatsView = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gray-900/60 rounded-lg border border-white/10 p-4">
          <h3 className="font-semibold text-lg mb-2">📊 Total Metrics</h3>
          <div className="text-2xl font-bold text-blue-400">{items.length}</div>
          <div className="text-xs text-gray-400 mt-1">Datapoints ingested</div>
        </div>
        <div className="bg-gray-900/60 rounded-lg border border-white/10 p-4">
          <h3 className="font-semibold text-lg mb-2">📈 Unique Metrics</h3>
          <div className="text-2xl font-bold text-green-400">{stats.length}</div>
          <div className="text-xs text-gray-400 mt-1">Different metric names</div>
        </div>
        <div className="bg-gray-900/60 rounded-lg border border-white/10 p-4">
          <h3 className="font-semibold text-lg mb-2">🔄 Services</h3>
          <div className="text-2xl font-bold text-purple-400">
            {new Set(items.map(i => i.service).filter(Boolean)).size}
          </div>
          <div className="text-xs text-gray-400 mt-1">Active services</div>
        </div>
      </div>

      <div className="bg-gray-900/60 rounded-lg border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="font-semibold">📊 Metric Statistics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Metric Name</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3">Latest</th>
                <th className="px-4 py-3">Min</th>
                <th className="px-4 py-3">Max</th>
                <th className="px-4 py-3">Avg</th>
                <th className="px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stats.map((stat, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-sm">{stat.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{stat.service || '-'}</td>
                  <td className="px-4 py-3 text-sm">{stat.count}</td>
                  <td className="px-4 py-3 text-sm">
                    {stat.latest !== undefined ? `${stat.latest.toFixed(2)} ${stat.unit || ''}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {stat.min !== undefined ? stat.min.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {stat.max !== undefined ? stat.max.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {stat.avg !== undefined ? stat.avg.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                      {stat.kind || 'unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderChartsView = () => {
    if (typeof window === 'undefined') return <div>Loading charts...</div>;

    // Group metrics by name for time series
    const metricGroups = new Map<string, MetricItem[]>();
    items.forEach(item => {
      const key = item.name || 'unknown';
      if (!metricGroups.has(key)) {
        metricGroups.set(key, []);
      }
      metricGroups.get(key)!.push(item);
    });

    const charts = Array.from(metricGroups.entries())
      .slice(0, 6) // Limit to first 6 metrics to avoid performance issues
      .map(([name, data]) => {
        const numericData = data
          .filter(d => typeof d.value === 'number' || !isNaN(parseFloat(String(d.value))))
          .map(d => ({
            x: new Date(d.t),
            y: typeof d.value === 'number' ? d.value : parseFloat(String(d.value)),
            service: d.service
          }))
          .sort((a, b) => a.x.getTime() - b.x.getTime());

        if (numericData.length === 0) return null;

        return (
          <div key={name} className="bg-gray-900/60 rounded-lg border border-white/10 p-4">
            <h4 className="font-semibold mb-4">{name}</h4>
            <Plot
              data={[{
                x: numericData.map(d => d.x),
                y: numericData.map(d => d.y),
                type: 'scatter',
                mode: 'lines+markers',
                marker: { color: '#60A5FA' },
                line: { color: '#60A5FA' },
                name: name
              }]}
              layout={{
                width: 400,
                height: 250,
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#E5E7EB', size: 12 },
                xaxis: { 
                  gridcolor: '#374151',
                  title: 'Time'
                },
                yaxis: { 
                  gridcolor: '#374151',
                  title: data[0]?.unit || 'Value'
                },
                margin: { t: 30, b: 50, l: 60, r: 30 }
              }}
              config={{ displayModeBar: false }}
            />
          </div>
        );
      }).filter(Boolean);

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-400">
          Showing time-series charts for the most active metrics. 
          Data is refreshed automatically every 10 seconds.
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts}
        </div>
        {charts.length === 0 && (
          <div className="bg-gray-900/60 rounded-lg border border-white/10 p-8 text-center text-gray-400">
            No numeric metrics available for charting.
          </div>
        )}
      </div>
    );
  };

  const renderRawView = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-400">
        Raw metric data with full timestamps and JSON inspection. Click any row to view the complete raw payload.
      </div>
      <div className="bg-gray-900/60 rounded-lg border border-white/10 overflow-hidden">
        <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <div className="p-4 text-gray-400">No raw metrics data available.</div>
          )}
          {items.map((m, i) => (
            <div 
              key={i} 
              className="px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors"
              onClick={() => setSelectedMetric(m)}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="font-mono text-sm">{m.name}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(m.t).toISOString()} • {m.service || 'unknown service'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{String(m.value || '')} {m.unit || ''}</div>
                  <div className="text-xs text-gray-400">{m.kind || 'unknown'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Raw Data Modal */}
      {selectedMetric && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-white/10 max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-semibold">Raw Metric Data: {selectedMetric.name}</h3>
              <button 
                onClick={() => setSelectedMetric(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <pre className="text-xs bg-gray-800 p-4 rounded overflow-x-auto">
                {JSON.stringify(selectedMetric, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">📈 Metrics Dashboard</h1>
          <div className="flex items-center space-x-3 text-sm text-gray-300">
            <label className="opacity-80">Limit</label>
            <select 
              aria-label="Select result limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-gray-800/60 border border-white/10 rounded px-2 py-1"
            >
              {[50, 100, 200, 500, 1000].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button onClick={load} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20">
              Refresh
            </button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="mb-6 flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
          {[
            { key: 'table', label: '📋 Table', desc: 'Recent datapoints' },
            { key: 'stats', label: '📊 Statistics', desc: 'Aggregated stats' },
            { key: 'charts', label: '📈 Charts', desc: 'Time-series plots' },
            { key: 'raw', label: '🔍 Raw Data', desc: 'JSON inspection' }
          ].map(({ key, label, desc }) => (
            <button
              key={key}
              onClick={() => setViewMode(key as any)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                viewMode === key 
                  ? 'bg-white/10 text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div>{label}</div>
              <div className="text-xs opacity-75">{desc}</div>
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <div className="mt-2 text-gray-400">Loading metrics...</div>
          </div>
        )}

        {!loading && (
          <>
            {viewMode === 'table' && (
              <div className="bg-gray-900/60 rounded-lg border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <div className="font-semibold">Recent Metric Datapoints</div>
                  <div className="text-xs text-gray-400">Showing {items.length} metrics</div>
                </div>
                <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                  {items.length === 0 && (
                    <div className="p-4 text-gray-400">No metrics yet. Send OTLP metrics to /api/ingest/otlp/v1/metrics.</div>
                  )}
                  {items.map((m, i) => (
                    <div key={i} className="px-4 py-3 grid grid-cols-12 gap-3 text-sm hover:bg-white/5">
                      <div className="col-span-3 truncate" title={new Date(m.t).toISOString()}>
                        {new Date(m.t).toLocaleTimeString()}
                      </div>
                      <div className="col-span-3 truncate font-mono" title={m.name}>{m.name}</div>
                      <div className="col-span-2 truncate">{m.kind ?? "-"}</div>
                      <div className="col-span-2 truncate font-mono">{String(m.value ?? "")} {m.unit ?? ""}</div>
                      <div className="col-span-2 truncate text-gray-400" title={String(m.service ?? "")}>{m.service ?? ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'stats' && renderStatsView()}
            {viewMode === 'charts' && renderChartsView()}
            {viewMode === 'raw' && renderRawView()}
          </>
        )}
      </div>
    </div>
  );
}
