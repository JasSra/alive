import { NextRequest, NextResponse } from "next/server";

// Serves a lightweight browser monitoring script that batches logs/errors/fetch metrics
// into an OTLP ExportLogsServiceRequest and posts to our OTLP ingest endpoint.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;
  const ingestUrl = `${base}/api/ingest`;

  const js = `(() => {
    const endpoint = ${JSON.stringify(ingestUrl)};
    const svc = window.__monitorServiceName || document.currentScript?.dataset?.service || 'web-app';
    const flushIntervalMs = Number(document.currentScript?.dataset?.flushMs || 3000);
    const maxBatch = Number(document.currentScript?.dataset?.maxBatch || 50);
    let queue = [];

    function nowNanos() {
      try {
        const base = BigInt(Date.now()) * 1000000n;
        const extra = BigInt(Math.floor((performance.now() % 1) * 1e6));
        return (base + extra).toString();
      } catch {
        return String(Date.now() * 1e6);
      }
    }
    function strVal(v) { return { stringValue: String(v) }; }
    function numVal(n) { return Number.isInteger(n) ? { intValue: n } : { doubleValue: Number(n) }; }
    function boolVal(b) { return { boolValue: !!b }; }

    function toAttr(obj) {
      const out = [];
      for (const k in obj) {
        const v = obj[k];
        let value;
        if (typeof v === 'string') value = strVal(v);
        else if (typeof v === 'number') value = numVal(v);
        else if (typeof v === 'boolean') value = boolVal(v);
        else value = strVal(JSON.stringify(v));
        out.push({ key: k, value });
      }
      return out;
    }

    function enqueue(record) {
      queue.push(record);
      if (queue.length >= maxBatch) void flush();
    }

    async function flush() {
      if (!queue.length) return;
      const batch = queue.splice(0, queue.length);
      const payload = {
        resourceLogs: [{
          resource: { attributes: [ { key: 'service.name', value: strVal(svc) } ] },
          scopeLogs: [{ logRecords: batch }]
        }]
      };
      try {
        await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      } catch {}
    }

    setInterval(flush, flushIntervalMs);
    window.addEventListener('beforeunload', () => {
      try {
        const payload = JSON.stringify({
          resourceLogs: [{ resource: { attributes: [ { key: 'service.name', value: strVal(svc) } ] }, scopeLogs: [{ logRecords: queue.splice(0) }] }]
        });
        navigator.sendBeacon(endpoint, payload);
      } catch {}
    });

    // Error events
    window.addEventListener('error', (e) => {
      const attrs = toAttr({ filename: e.filename, lineno: e.lineno, colno: e.colno, message: e.message });
      enqueue({ timeUnixNano: nowNanos(), severityNumber: 17, body: strVal(e.message || 'Error'), attributes: attrs });
    });
    window.addEventListener('unhandledrejection', (e) => {
      const msg = (e.reason && (e.reason.message || e.reason.toString())) || 'unhandledrejection';
      enqueue({ timeUnixNano: nowNanos(), severityNumber: 17, body: strVal(msg), attributes: toAttr({ type: 'promise' }) });
    });

    // Console logs
    for (const [level, sev] of [['log', 9], ['info', 9], ['warn', 13], ['error', 17]]) {
      const orig = console[level];
      console[level] = function(...args) {
        try { enqueue({ timeUnixNano: nowNanos(), severityNumber: sev, body: strVal(args.map(String).join(' ')) }); } catch {}
        return orig.apply(this, args);
      };
    }

    // Fetch instrumentation
    const origFetch = window.fetch;
    window.fetch = async function(input, init) {
      const start = performance.now();
      let url = typeof input === 'string' ? input : (input && input.url) || '';
      try {
        const res = await origFetch(input, init);
        const dur = Math.round(performance.now() - start);
        enqueue({ timeUnixNano: nowNanos(), severityNumber: 9, body: strVal('fetch'), attributes: toAttr({ url, status: res.status, duration_ms: dur }) });
        return res;
      } catch (err) {
        const dur = Math.round(performance.now() - start);
        enqueue({ timeUnixNano: nowNanos(), severityNumber: 13, body: strVal('fetch_error'), attributes: toAttr({ url, error: String(err), duration_ms: dur }) });
        throw err;
      }
    };
  })();`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
