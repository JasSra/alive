import { NextRequest, NextResponse } from "next/server";
import { ingestStore } from "@/lib/ingestStore";

// Enhanced CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Monitor-Request, Accept, Origin, User-Agent, Referer",
  "Access-Control-Allow-Credentials": "false",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

// Handle preflight OPTIONS requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const f = from ? new Date(from).getTime() : -Infinity;
    const t = to ? new Date(to).getTime() : Infinity;

    // Build a normalized view over unified rings for the requested range
    type Row = {
      timestamp: number;
      serviceName: string;
      name: string;
      statusCode?: number;
      responseTimeMs?: number;
    };
    const snap = ingestStore.snapshot();
    const rows: Row[] = [];
    for (const r of snap.requests) {
      if (r.t < f || r.t > t) continue;
      rows.push({
        timestamp: r.t,
        serviceName: r.service ?? 'unknown',
        // Use path as the event name for more informative service top events
        name: (r.path && r.path.length > 0 ? r.path : 'response'),
        statusCode: r.status,
        responseTimeMs: r.duration_ms,
      });
    }
    for (const l of snap.logs) {
      if (l.t < f || l.t > t) continue;
      rows.push({
        timestamp: l.t,
        serviceName: l.service ?? 'unknown',
        name: 'log',
      });
    }
    for (const e of snap.events) {
      if (e.t < f || e.t > t) continue;
      rows.push({
        timestamp: e.t,
        serviceName: e.service ?? 'unknown',
        name: e.name || 'event',
      });
    }

    // Group rows by service
    const serviceGroups = new Map<string, Row[]>();
    const unknownServiceEvents: Row[] = [];
    for (const row of rows) {
      const svc = row.serviceName || 'unknown';
      if (svc === 'unknown') unknownServiceEvents.push(row);
      if (!serviceGroups.has(svc)) serviceGroups.set(svc, []);
      serviceGroups.get(svc)!.push(row);
    }

    // Calculate statistics for each service
    const serviceStats = Array.from(serviceGroups.entries()).map(([serviceName, events]) => {
      // Calculate unique events
      const uniqueEvents = new Set(events.map(e => e.name)).size;
      
      // Calculate average response time
      const responseTimes = events
        .filter(e => e.responseTimeMs !== undefined)
        .map(e => e.responseTimeMs as number);
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : undefined;

      // Calculate error rate
      const errorEvents = events.filter(e => e.statusCode && e.statusCode >= 400);
      const errorRate = events.length > 0 ? (errorEvents.length / events.length) * 100 : 0;

      // Get last seen timestamp
      const lastSeen = new Date(Math.max(...events.map(e => e.timestamp))).toISOString();

      // Calculate top events for this service
      const eventCounts = new Map<string, number>();
      events.forEach(event => {
        const count = eventCounts.get(event.name) || 0;
        eventCounts.set(event.name, count + 1);
      });

      const topEvents = Array.from(eventCounts.entries())
        .map(([eventName, count]) => ({
          eventName,
          count,
          percentage: (count / events.length) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 events per service

      return {
        serviceName,
        eventCount: events.length,
        uniqueEvents,
        avgResponseTime: avgResponseTime ? Math.round(avgResponseTime * 100) / 100 : undefined,
        errorRate: Math.round(errorRate * 100) / 100,
        lastSeen,
        topEvents
      };
    });

    // Sort services by event count (descending)
    serviceStats.sort((a, b) => b.eventCount - a.eventCount);

    // Add unknown service if there are events without service names
    if (unknownServiceEvents.length > 0) {
      const uniqueEvents = new Set(unknownServiceEvents.map(e => e.name)).size;
      const responseTimes = unknownServiceEvents
        .filter(e => e.responseTimeMs !== undefined)
        .map(e => e.responseTimeMs as number);
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : undefined;
      
      const errorEvents = unknownServiceEvents.filter(e => e.statusCode && e.statusCode >= 400);
      const errorRate = (errorEvents.length / unknownServiceEvents.length) * 100;
      const lastSeen = new Date(Math.max(...unknownServiceEvents.map(e => e.timestamp))).toISOString();

      const eventCounts = new Map<string, number>();
      unknownServiceEvents.forEach(event => {
        const count = eventCounts.get(event.name) || 0;
        eventCounts.set(event.name, count + 1);
      });

      const topEvents = Array.from(eventCounts.entries())
        .map(([eventName, count]) => ({
          eventName,
          count,
          percentage: (count / unknownServiceEvents.length) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      serviceStats.push({
        serviceName: 'unknown',
        eventCount: unknownServiceEvents.length,
        uniqueEvents,
        avgResponseTime: avgResponseTime ? Math.round(avgResponseTime * 100) / 100 : undefined,
        errorRate: Math.round(errorRate * 100) / 100,
        lastSeen,
        topEvents
      });
    }

    return NextResponse.json(
      {
        services: serviceStats,
        totalServices: serviceStats.length,
  totalEvents: rows.length,
        timeRange: {
          from: from || 'all time',
          to: to || 'now'
        }
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error("Error fetching service statistics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { 
        status: 500,
        headers: corsHeaders 
      }
    );
  }
}
