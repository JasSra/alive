import { NextRequest, NextResponse } from "next/server";
import { unifiedIngest } from "@/lib/unifiedIngest";

export async function POST(req: NextRequest) {
  // Try JSON first, then text, then raw
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const result = await unifiedIngest(body);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    if (contentType.includes("text/plain")) {
      const text = await req.text();
      const result = await unifiedIngest(text);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    // Fallback: try json then text
    try {
      const body = await req.json();
      const result = await unifiedIngest(body);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch {
      const text = await req.text();
      const result = await unifiedIngest(text);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
  } catch {
    return NextResponse.json({ success: false, message: "bad ingest payload" }, { status: 400 });
  }
}

export async function GET() {
  // Expose current counts as a simple health for unified ingest
  const { ingestStore } = await import("@/lib/ingestStore");
  return NextResponse.json({ ok: true, counts: ingestStore.counts(), t: new Date().toISOString() });
}
