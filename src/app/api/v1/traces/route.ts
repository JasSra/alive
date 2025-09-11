import { NextRequest, NextResponse } from "next/server";
import { unifiedIngest } from "@/lib/unifiedIngest";

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();
  
  console.log(`[OTLP-V1-TRACES:${requestId}] 🔗 OTLP v1 traces endpoint called`);
  
  try {
    const body = await req.json().catch(() => ({}));
    const payloadSize = JSON.stringify(body).length;
    console.log(`[OTLP-V1-TRACES:${requestId}] 📊 OTLP v1 traces payload size: ${payloadSize} bytes`);
    
    const result = await unifiedIngest(body);
    const duration = Date.now() - startTime;
    
    console.log(`[OTLP-V1-TRACES:${requestId}] ✅ OTLP v1 traces ingestion completed in ${duration}ms:`, {
      success: result.success,
      written: result.success ? result.written : 0,
      byKind: result.success ? result.byKind : undefined,
      message: !result.success ? result.message : undefined
    });
    
    const res = NextResponse.json(result, { status: result.success ? 200 : 400 });
    
    // OTLP standard headers
    res.headers.set("Content-Type", "application/json");
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    return res;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[OTLP-V1-TRACES:${requestId}] ❌ OTLP v1 traces ingestion failed after ${duration}ms:`, error);
    return NextResponse.json({ success: false, message: "bad traces payload" }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
