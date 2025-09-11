import { NextRequest, NextResponse } from "next/server";
import { unifiedIngest } from "@/lib/unifiedIngest";

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();
  
  console.log(`[OTLP-LEGACY:${requestId}] ⚠️ Legacy OTLP endpoint called (deprecated)`);
  
  try {
    const body = await req.json().catch(() => ({}));
    const payloadSize = JSON.stringify(body).length;
    console.log(`[OTLP-LEGACY:${requestId}] 📊 Legacy OTLP payload size: ${payloadSize} bytes`);
    
    // Detect the type of OTLP payload for deprecation guidance
    let detectedType = "unknown";
    if (body.resourceLogs) detectedType = "logs";
    else if (body.resourceSpans) detectedType = "traces";
    else if (body.resourceMetrics) detectedType = "metrics";
    
    console.log(`[OTLP-LEGACY:${requestId}] 🔍 Detected payload type: ${detectedType}`);
    if (detectedType !== "unknown") {
      console.log(`[OTLP-LEGACY:${requestId}] 💡 Consider using /api/ingest/otlp/${detectedType} instead`);
    }
    
    const result = await unifiedIngest(body);
    const duration = Date.now() - startTime;
    
    console.log(`[OTLP-LEGACY:${requestId}] ✅ Legacy OTLP ingestion completed in ${duration}ms:`, {
      success: result.success,
      written: result.success ? result.written : 0,
      byKind: result.success ? result.byKind : undefined,
      message: !result.success ? result.message : undefined,
      detectedType
    });
    
    const res = NextResponse.json(result, { status: result.success ? 200 : 400 });
    res.headers.set("Deprecation", "true");
    res.headers.set("Sunset", new Date(Date.now() + 30 * 24 * 3600 * 1000).toUTCString());
    res.headers.set("Link", `</api/ingest/otlp/${detectedType}>; rel=successor-version`);
    res.headers.set("Warning", `199 - "Use /api/ingest/otlp/${detectedType} for better performance"`);
    return res;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[OTLP-LEGACY:${requestId}] ❌ Legacy OTLP ingestion failed after ${duration}ms:`, error);
    return NextResponse.json({ success: false, message: "bad otlp payload" }, { status: 400 });
  }
}
