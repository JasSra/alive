import { NextRequest, NextResponse } from "next/server";
import { unifiedIngest } from "@/lib/unifiedIngest";

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  const ct = req.headers.get("content-type") || "";
  
  console.log(`[OTLP-METRICS:${requestId}] 📥 Received metrics request with content-type: ${ct}`);
  
  try {
    let body: unknown;
    
    if (ct.includes("application/json")) {
      // Handle JSON payload
      body = await req.json();
      console.log(`[OTLP-METRICS:${requestId}] 📄 Parsed JSON payload`);
    } else if (ct.includes("application/x-protobuf") || ct.includes("application/protobuf")) {
      // Handle Protobuf payload
      const buffer = await req.arrayBuffer();
      console.log(`[OTLP-METRICS:${requestId}] 🔧 Received protobuf payload (${buffer.byteLength} bytes)`);
      
      // Convert protobuf to JSON using otlp-transformer
      const { ProtobufMetricsSerializer } = await import("@opentelemetry/otlp-transformer");
      body = ProtobufMetricsSerializer.deserialize(new Uint8Array(buffer));
      console.log(`[OTLP-METRICS:${requestId}] ✅ Converted protobuf to JSON`);
    } else {
      console.log(`[OTLP-METRICS:${requestId}] ❌ Unsupported content-type: ${ct}`);
      return NextResponse.json(
        {
          success: false,
          message: "Unsupported Content-Type. Use application/json or application/x-protobuf.",
          hint: "Set OTLP exporter protocol to HttpJson or HttpProtobuf",
          receivedContentType: ct,
        },
        { status: 415 }
      );
    }
    
    const result = await unifiedIngest(body);
    console.log(`[OTLP-METRICS:${requestId}] ${result.success ? '✅' : '❌'} Ingestion ${result.success ? 'completed' : 'failed'}:`, result);
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error(`[OTLP-METRICS:${requestId}] 💥 Error processing metrics:`, error);
    return NextResponse.json({ success: false, message: "bad metrics payload" }, { status: 400 });
  }
}
