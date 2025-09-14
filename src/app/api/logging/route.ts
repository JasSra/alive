import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET() {
  // Get store connection information
  const { globalStore } = globalThis as { globalStore?: { __eventStore?: { sseClients: Set<unknown>; wsClients: Set<unknown> } } };
  const sseClients = globalStore?.__eventStore?.sseClients?.size || 0;
  const wsClients = globalStore?.__eventStore?.wsClients?.size || 0;
  
  // Get ingestion statistics
  const { ingestStore } = await import("@/lib/ingestStore");
  const counts = ingestStore.counts();
  
  logger.api('info', `🔍 Logging status requested`, {
    connections: { sseClients, wsClients },
    storage: counts
  });

  const loggingStatus = {
    server: {
      status: "running",
      pid: process.pid,
      uptime: process.uptime(),
      nodeVersion: process.version,
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      }
    },
    logging: {
      level: process.env.LOG_LEVEL || 'INFO',
      structuredLogs: process.env.STRUCTURED_LOGS === 'true',
      environment: process.env.NODE_ENV || 'development'
    },
    connections: {
      sseClients,
      wsClients,
      total: sseClients + wsClients
    },
    storage: counts,
    lastUpdate: new Date().toISOString()
  };

  return NextResponse.json(loggingStatus);
}

// POST endpoint to test logging
export async function POST() {
  logger.api('info', `🧪 Test log entry generated`);
  logger.api('debug', `🐛 Debug message test`);
  logger.api('warn', `⚠️ Warning message test`);
  logger.api('error', `❌ Error message test`);
  
  console.log('[LOGGING TEST] Direct console.log message');
  console.info('[LOGGING TEST] Direct console.info message');
  console.warn('[LOGGING TEST] Direct console.warn message');
  console.error('[LOGGING TEST] Direct console.error message');

  return NextResponse.json({ 
    success: true, 
    message: "Test log entries generated",
    timestamp: new Date().toISOString()
  });
}
