import { NextRequest, NextResponse } from "next/server";
import { unifiedIngest } from "@/lib/unifiedIngest";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  // Enhanced logging for better visibility
  logger.ingest('info', `🔄 Starting ingestion request`, { requestId, timestamp: startTime });
  console.log(`[INGEST:${requestId}] 🔄 Starting ingestion request`);
  
  // Try JSON first, then text, then raw
  try {
    const contentType = req.headers.get("content-type") || "";
    
    logger.ingest('debug', `📋 Processing request`, { 
      requestId, 
      contentType, 
      userAgent: req.headers.get("user-agent"),
      origin: req.headers.get("origin")
    });
    console.log(`[INGEST:${requestId}] 📋 Content-Type: ${contentType}`);
    
    if (contentType.includes("application/json")) {
      logger.ingest('debug', `📦 Processing JSON payload`, { requestId });
      console.log(`[INGEST:${requestId}] 📦 Processing JSON payload`);
      const body = await req.json().catch(() => ({}));
      const payloadSize = JSON.stringify(body).length;
      
      logger.ingest('debug', `📏 Payload details`, { 
        requestId, 
        payloadSize, 
        type: 'JSON' 
      });
      console.log(`[INGEST:${requestId}] 📏 JSON payload size: ${payloadSize} bytes`);
      
      const result = await unifiedIngest(body);
      const duration = Date.now() - startTime;
      
      logger.ingest('info', `✅ JSON ingestion completed`, {
        requestId,
        duration,
        success: result.success,
        written: result.success ? result.written : 0,
        byKind: result.success ? result.byKind : undefined,
        error: !result.success ? result.message : undefined
      });
      
      console.log(`[INGEST:${requestId}] ✅ JSON ingestion completed in ${duration}ms:`, {
        success: result.success,
        written: result.success ? result.written : 0,
        byKind: result.success ? result.byKind : undefined,
        message: !result.success ? result.message : undefined
      });
      
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    
    if (contentType.includes("text/plain")) {
      console.log(`[INGEST:${requestId}] 📝 Processing text payload`);
      const text = await req.text();
      const payloadSize = text.length;
      console.log(`[INGEST:${requestId}] 📏 Text payload size: ${payloadSize} bytes`);
      
      const result = await unifiedIngest(text);
      const duration = Date.now() - startTime;
      
      console.log(`[INGEST:${requestId}] ✅ Text ingestion completed in ${duration}ms:`, {
        success: result.success,
        written: result.success ? result.written : 0,
        byKind: result.success ? result.byKind : undefined,
        message: !result.success ? result.message : undefined
      });
      
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    
    // Fallback: try json then text
    console.log(`[INGEST:${requestId}] 🔄 Attempting fallback parsing (JSON first)`);
    try {
      const body = await req.json();
      const payloadSize = JSON.stringify(body).length;
      console.log(`[INGEST:${requestId}] 📏 Fallback JSON payload size: ${payloadSize} bytes`);
      
      const result = await unifiedIngest(body);
      const duration = Date.now() - startTime;
      
      console.log(`[INGEST:${requestId}] ✅ Fallback JSON ingestion completed in ${duration}ms:`, {
        success: result.success,
        written: result.success ? result.written : 0,
        byKind: result.success ? result.byKind : undefined,
        message: !result.success ? result.message : undefined
      });
      
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch {
      console.log(`[INGEST:${requestId}] 🔄 Fallback to text parsing`);
      const text = await req.text();
      const payloadSize = text.length;
      console.log(`[INGEST:${requestId}] 📏 Fallback text payload size: ${payloadSize} bytes`);
      
      const result = await unifiedIngest(text);
      const duration = Date.now() - startTime;
      
      console.log(`[INGEST:${requestId}] ✅ Fallback text ingestion completed in ${duration}ms:`, {
        success: result.success,
        written: result.success ? result.written : 0,
        byKind: result.success ? result.byKind : undefined,
        message: !result.success ? result.message : undefined
      });
      
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.ingest('error', `❌ Ingestion failed`, {
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error(`[INGEST:${requestId}] ❌ Ingestion failed after ${duration}ms:`, error);
    
    return NextResponse.json({ success: false, message: "bad ingest payload" }, { status: 400 });
  }
}

export async function GET() {
  logger.ingest('info', `📊 Health check requested`);
  console.log(`[INGEST] 📊 Health check requested`);
  
  // Expose current counts as a simple health for unified ingest
  const { ingestStore } = await import("@/lib/ingestStore");
  const counts = ingestStore.counts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  
  logger.ingest('info', `📈 Current storage statistics`, { counts, total });
  console.log(`[INGEST] 📈 Current storage counts:`, { ...counts, total });
  
  return NextResponse.json({ ok: true, counts, t: new Date().toISOString() });
}
