#!/usr/bin/env node
/**
 * Simple demo seeder: posts random events to the local Next.js server.
 * Usage:
 *   node scripts/seed.js                 # defaults to http://localhost:3000
 *   SERVER=http://localhost:3001 node scripts/seed.js
 *   node scripts/seed.js 100            # number of events
 */

const base = process.env.SERVER || 'http://localhost:3001';
const total = Number(process.argv[2] || 50);

const names = [
  'user-login', 'user-logout', 'page-view', 'click-cta', 'purchase', 'cart-add', 'cart-remove', 'search', 'filter-apply', 'error'
];

function uuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function main() {
  console.log(`[seed] sending ${total} random events to ${base} ...`);
  for (let i = 0; i < total; i += 1) {
    const name = pick(names);
    const userId = `u${rand(1, 5)}`;
    const correlationId = uuid();
    const start = Date.now();
    const basePayload = {
      userAgent: 'seed-script',
      metadata: {
        ip: `127.0.0.${rand(1, 254)}`,
        session: `s${rand(1000, 9999)}`,
        price: Math.random() < 0.2 ? rand(10, 200) : undefined,
      },
    };
    const url = `${base}/api/events/track/${encodeURIComponent(name)}`;
    try {
      // Emit request event (statusCode: 0 means request started)
      const reqPayload = { ...basePayload, correlationId, statusCode: 0 };
      const res1 = await postJson(url, reqPayload, { 'x-user-id': userId });
      if (res1.status >= 400) {
        console.error(`[seed] ${i + 1}/${total} -> ${name} [request] :: HTTP ${res1.status}`);
      }
      
      // Simulate processing time
      const latency = rand(250, 1200); // Increased range for more realistic latencies
      await new Promise((r) => setTimeout(r, latency));
      
      // Determine if this will be an error response
      const isError = Math.random() < 0.15; // ~15% errors
      const statusCode = isError ? pick([400, 401, 403, 404, 500, 502, 503]) : pick([200, 201, 202]); // More status codes
      const responseTimeMs = Date.now() - start;
      
      // Emit response event (statusCode shows the actual response)
      const respPayload = { ...basePayload, correlationId, statusCode, responseTimeMs };
      const res2 = await postJson(url, respPayload, { 'x-user-id': userId });
      if (res2.status >= 400) {
        console.error(`[seed] ${i + 1}/${total} -> ${name} [response] :: HTTP ${res2.status}`);
      } else {
        const statusIcon = statusCode >= 400 ? '❌' : statusCode >= 300 ? '⚠️' : '✅';
        console.log(`[seed] ${i + 1}/${total} -> ${name} :: ${statusIcon} ${statusCode} in ${responseTimeMs}ms`);
      }
    } catch (e) {
      console.error(`[seed] ${i + 1}/${total} -> ${name} :: error`, e?.message || e);
    }
    
    // Random pause between requests to simulate real traffic
    await new Promise((r) => setTimeout(r, rand(100, 500)));
  }
  console.log('[seed] done');
}

main().catch((e) => {
  console.error('[seed] error', e);
  process.exit(1);
});
