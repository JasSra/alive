import { NextRequest, NextResponse } from "next/server";
import { ingestStore } from "@/lib/ingestStore";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const from = search.get("from");
  const to = search.get("to");
  const limit = Math.max(1, Math.min(5000, parseInt(search.get("limit") ?? "1000", 10)));
  if (!from || !to) {
    return NextResponse.json({ success: false, message: "from and to are required" }, { status: 400 });
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(+fromDate) || Number.isNaN(+toDate) || toDate <= fromDate) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
  }
  const snap = ingestStore.snapshot();
  const f = fromDate.getTime();
  const t = toDate.getTime();
  // Map requests/logs/events into the unified event rows expected by UI
  type Row = { id: string; name: string; timestamp: string; userId?: string; serviceName?: string; correlationId?: string; statusCode?: number; responseTimeMs?: number; requestPath?: string; referrer?: string };
  const out: Row[] = [];
  // from logs: name=log
  for (const l of snap.logs) {
    if (l.t < f || l.t > t) continue;
    out.push({
      id: String(l.t) + "-log-" + Math.random().toString(36).slice(2, 8),
      name: "log",
      timestamp: new Date(l.t).toISOString(),
      serviceName: l.service,
      // keep message in referrer field for table hover (best-effort)
      referrer: l.message,
    });
    if (out.length >= limit) break;
  }
  // from requests: emit response rows
  if (out.length < limit) {
    for (const r of snap.requests) {
      if (r.t < f || r.t > t) continue;
      out.push({
        id: String(r.t) + "-resp-" + Math.random().toString(36).slice(2, 8),
        name: "response",
        timestamp: new Date(r.t).toISOString(),
        serviceName: r.service,
        correlationId: (r.attrs?.["correlationId"] as string | undefined) || (r.attrs?.["http.request_id"] as string | undefined) || (r.attrs?.["traceId"] as string | undefined),
        statusCode: r.status,
        responseTimeMs: r.duration_ms,
        requestPath: r.path,
      });
      if (out.length >= limit) break;
    }
  }
  // from events: generic event names
  if (out.length < limit) {
    for (const e of snap.events) {
      if (e.t < f || e.t > t) continue;
      out.push({
        id: String(e.t) + "-evt-" + Math.random().toString(36).slice(2, 8),
        name: e.name || "event",
        timestamp: new Date(e.t).toISOString(),
        serviceName: e.service,
      });
      if (out.length >= limit) break;
    }
  }
  out.sort((a, b) => (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
  return NextResponse.json(out.slice(0, limit));
}
