import { NextRequest, NextResponse } from "next/server";
import { unifiedIngest } from "@/lib/unifiedIngest";

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();
  
  console.log(`[SYSLOG:${requestId}] 📡 Syslog ingestion request received`);
  
  try {
    const text = await req.text();
    const payloadSize = text.length;
    const lineCount = text.split(/\r?\n/).filter(line => line.trim()).length;
    console.log(`[SYSLOG:${requestId}] 📄 Syslog payload: ${payloadSize} bytes, ${lineCount} lines`);
    
    const result = await unifiedIngest(text);
    const duration = Date.now() - startTime;
    
    console.log(`[SYSLOG:${requestId}] ✅ Syslog ingestion completed in ${duration}ms:`, {
      success: result.success,
      written: result.success ? result.written : 0,
      byKind: result.success ? result.byKind : undefined,
      message: !result.success ? result.message : undefined
    });
    
    const res = NextResponse.json(result, { status: result.success ? 200 : 400 });
    res.headers.set("Deprecation", "true");
    res.headers.set("Sunset", new Date(Date.now() + 30 * 24 * 3600 * 1000).toUTCString());
    res.headers.set("Link", "</api/ingest>; rel=successor-version");
    return res;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[SYSLOG:${requestId}] ❌ Syslog ingestion failed after ${duration}ms:`, error);
    return NextResponse.json({ success: false, message: "bad syslog payload" }, { status: 400 });
  }
}
