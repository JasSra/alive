import { NextRequest, NextResponse } from "next/server";
import { unifiedIngest } from "@/lib/unifiedIngest";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await unifiedIngest(body);
    const res = NextResponse.json(result, { status: result.success ? 200 : 400 });
    res.headers.set("Deprecation", "true");
    res.headers.set("Sunset", new Date(Date.now() + 30 * 24 * 3600 * 1000).toUTCString());
    res.headers.set("Link", "</api/ingest>; rel=successor-version");
    return res;
  } catch {
    return NextResponse.json({ success: false, message: "bad otlp payload" }, { status: 400 });
  }
}
