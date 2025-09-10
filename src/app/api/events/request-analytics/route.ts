import { NextRequest, NextResponse } from 'next/server';
import { ingestStore } from '@/lib/ingestStore';

// Pattern to identify request events
const REQUEST_PATTERN = /^(request|http|api|endpoint|span)/i;

// Quick type for request analytics
interface RequestEvent {
  timestamp: string;
  eventType?: string;
  type?: string;
  name?: string;
  statusCode?: number;
  status?: number;
  responseTimeMs?: number;
  duration?: number;
  latency?: number;
  url?: string;
  path?: string;
  endpoint?: string;
  method?: string;
  clientIp?: string;
  ip?: string;
  remoteAddr?: string;
  [key: string]: any;
}

interface RequestAnalytics {
  successRate: number;
  errorRate: number;
  totalRequests: number;
  totalErrors: number;
  latencyStats: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  pathAnalytics: Array<{
    path: string;
    method: string;
    count: number;
    errorCount: number;
    successRate: number;
    errorRate: number;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    errorCodes: Record<string, number>;
  }>;
  errorCodeDistribution: Record<string, number>;
  ipAddresses: Array<{
    ip: string;
    requestCount: number;
    errorCount: number;
    lastSeen: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get('hours') || '24');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    const timeRange = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Get request data from unified ingest store
    const snapshot = ingestStore.snapshot();
    const requestEvents = snapshot.requests.filter(req => {
      const timestamp = new Date(req.t);
      return timestamp >= timeRange;
    }).slice(-limit);

    if (requestEvents.length === 0) {
      return NextResponse.json({
        successRate: 0,
        errorRate: 0,
        totalRequests: 0,
        totalErrors: 0,
        latencyStats: { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
        pathAnalytics: [],
        errorCodeDistribution: {},
        ipAddresses: []
      });
    }

    // Calculate basic metrics
    const totalRequests = requestEvents.length;
    const errorRequests = requestEvents.filter(e => {
      const status = e.status;
      return status && status >= 400;
    });
    const totalErrors = errorRequests.length;
    const successRequests = totalRequests - totalErrors;
    
    const successRate = totalRequests > 0 ? (successRequests / totalRequests) * 100 : 0;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Calculate latency statistics
    const latencies = requestEvents
      .map(e => e.duration_ms || 0)
      .filter(l => l > 0)
      .sort((a, b) => a - b);
    
    const latencyStats = {
      min: latencies.length > 0 ? Math.min(...latencies) : 0,
      max: latencies.length > 0 ? Math.max(...latencies) : 0,
      avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p50: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0,
      p95: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0,
      p99: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0
    };

    // Group by path and method
    const pathMap = new Map<string, {
      path: string;
      method: string;
      requests: any[];
      errors: any[];
      latencies: number[];
      errorCodes: Record<string, number>;
    }>();

    requestEvents.forEach(event => {
      const path = event.path || 'unknown';
      const method = event.method || 'GET';
      const key = `${method} ${path}`;
      
      if (!pathMap.has(key)) {
        pathMap.set(key, {
          path,
          method,
          requests: [],
          errors: [],
          latencies: [],
          errorCodes: {}
        });
      }
      
      const pathData = pathMap.get(key)!;
      pathData.requests.push(event);
      
      const status = event.status;
      if (status && status >= 400) {
        pathData.errors.push(event);
        const statusStr = status.toString();
        pathData.errorCodes[statusStr] = (pathData.errorCodes[statusStr] || 0) + 1;
      }
      
      const latency = event.duration_ms;
      if (latency && latency > 0) {
        pathData.latencies.push(latency);
      }
    });

    // Build path analytics
    const pathAnalytics = Array.from(pathMap.entries()).map(([key, data]) => {
      const count = data.requests.length;
      const errorCount = data.errors.length;
      const successCount = count - errorCount;
      
      return {
        path: data.path,
        method: data.method,
        count,
        errorCount,
        successRate: count > 0 ? (successCount / count) * 100 : 0,
        errorRate: count > 0 ? (errorCount / count) * 100 : 0,
        avgLatency: data.latencies.length > 0 ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length : 0,
        minLatency: data.latencies.length > 0 ? Math.min(...data.latencies) : 0,
        maxLatency: data.latencies.length > 0 ? Math.max(...data.latencies) : 0,
        errorCodes: data.errorCodes
      };
    }).sort((a, b) => b.count - a.count);

    // Error code distribution
    const errorCodeDistribution: Record<string, number> = {};
    errorRequests.forEach(event => {
      const status = (event.status || 500).toString();
      errorCodeDistribution[status] = (errorCodeDistribution[status] || 0) + 1;
    });

    // IP address analytics
    const ipMap = new Map<string, {
      requestCount: number;
      errorCount: number;
      lastSeen: string;
    }>();

    requestEvents.forEach(event => {
      // Extract IP from attrs if available
      const attrs = event.attrs || {};
      const ip = (attrs.clientIp as string) || (attrs.ip as string) || (attrs.client_ip as string) || 'unknown';
      const timestamp = new Date(event.t).toISOString();
      
      if (!ipMap.has(ip)) {
        ipMap.set(ip, {
          requestCount: 0,
          errorCount: 0,
          lastSeen: timestamp
        });
      }

      const ipData = ipMap.get(ip)!;
      ipData.requestCount++;

      const status = event.status;
      if (status && status >= 400) {
        ipData.errorCount++;
      }

      if (new Date(timestamp) > new Date(ipData.lastSeen)) {
        ipData.lastSeen = timestamp;
      }
    });

    const ipAddresses = Array.from(ipMap.entries()).map(([ip, data]) => ({
      ip,
      ...data
    })).sort((a, b) => b.requestCount - a.requestCount);

    const analytics: RequestAnalytics = {
      successRate: Math.round(successRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests,
      totalErrors,
      latencyStats: {
        min: Math.round(latencyStats.min * 100) / 100,
        max: Math.round(latencyStats.max * 100) / 100,
        avg: Math.round(latencyStats.avg * 100) / 100,
        p50: Math.round(latencyStats.p50 * 100) / 100,
        p95: Math.round(latencyStats.p95 * 100) / 100,
        p99: Math.round(latencyStats.p99 * 100) / 100
      },
      pathAnalytics,
      errorCodeDistribution,
      ipAddresses
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Request analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to get request analytics' },
      { status: 500 }
    );
  }
}
