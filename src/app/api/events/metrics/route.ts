import { NextResponse } from "next/server";
import { getTotalCount } from "@/lib/store";

// Lightweight server metrics: memory usage and uptime
// Same-origin calls from the dashboard; permissive CORS for flexibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Vary": "Origin",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  try {
    const mem = process.memoryUsage();
    const toMB = (b: number) => Math.round((b / (1024 * 1024)) * 10) / 10;
    const from = new Date(Date.now() - 5 * 60 * 1000);
    const to = new Date();
    const eventsLast5m = getTotalCount(from, to);
    const body = {
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
    external: mem.external,
    // arrayBuffers is optional in older Node typings
    arrayBuffers: "arrayBuffers" in mem ? (mem as NodeJS.MemoryUsage & { arrayBuffers?: number }).arrayBuffers ?? 0 : 0,
        rssMB: toMB(mem.rss),
        heapUsedMB: toMB(mem.heapUsed),
        heapTotalMB: toMB(mem.heapTotal),
      },
      eventsLast5m,
      uptimeSec: Math.round(process.uptime()),
      pid: process.pid,
      timestamp: Date.now(),
    };
    return NextResponse.json(body, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { success: false, message: "Failed to read server metrics" },
      { status: 500, headers: corsHeaders },
    );
  }
}
