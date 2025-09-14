"use client";
import { useCallback, useEffect, useState } from "react";
import { getIngestRecent } from "@/lib/api";

interface MetricItem {
  t: number;
  service?: string;
  name: string;
  value?: number | string;
  unit?: string;
  kind?: string;
  attrs?: Record<string, unknown>;
}

export default function MetricsPage() {
  const [items, setItems] = useState<MetricItem[]>([]);
  const [limit, setLimit] = useState(200);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getIngestRecent({ kind: "metrics", limit });
      setItems(res.items as MetricItem[]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [limit, load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Metrics</h1>
          <div className="flex items-center space-x-3 text-sm text-gray-300">
            <label className="opacity-80">Limit</label>
            <select aria-label="Select result limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-gray-800/60 border border-white/10 rounded px-2 py-1"
            >
              {[50, 100, 200, 500, 1000].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button onClick={load} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20">Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900/60 rounded-lg border border-white/10 p-4">
            <h2 className="font-semibold mb-2">Totals</h2>
            <div className="text-sm text-gray-300">Recent metrics: {items.length}</div>
          </div>
          <div className="bg-gray-900/60 rounded-lg border border-white/10 p-4">
            <h2 className="font-semibold mb-2">Legend</h2>
            <div className="text-sm text-gray-300">Shows most recent metric datapoints, newest first.</div>
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-lg border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="font-semibold">Recent Metric Datapoints</div>
            {loading && <div className="text-xs text-gray-400">Loading…</div>}
          </div>
          <div className="divide-y divide-white/5">
            {items.length === 0 && (
              <div className="p-4 text-gray-400">No metrics yet. Send OTLP metrics to /api/ingest/otlp/v1/metrics.</div>
            )}
            {items.map((m, i) => (
              <div key={i} className="px-4 py-3 grid grid-cols-12 gap-3 text-sm">
                <div className="col-span-3 truncate" title={new Date(m.t).toISOString()}>
                  {new Date(m.t).toLocaleTimeString()}
                </div>
                <div className="col-span-3 truncate" title={m.name}>{m.name}</div>
                <div className="col-span-2 truncate">{m.kind ?? "-"}</div>
                <div className="col-span-2 truncate">{String(m.value ?? "")} {m.unit ?? ""}</div>
                <div className="col-span-2 truncate text-gray-400" title={String(m.service ?? "")}>{m.service ?? ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
