import { NextRequest, NextResponse } from "next/server";
import { unifiedIngest } from "@/lib/unifiedIngest";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") || "").trim();
  if (!name || /[^a-zA-Z0-9._-]/.test(name)) {
    return NextResponse.json({ success: false, message: "invalid name" }, { status: 400 });
  }
  // Only allow files under /public/fixtures
  const path = `/fixtures/${name}`;
  try {
    const res = await fetch(new URL(path, req.nextUrl.origin).toString(), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ success: false, message: `fixture not found: ${name}` }, { status: 404 });
    }
    const json = await res.json();
    const result = await unifiedIngest(json);
    return NextResponse.json({ success: true, loaded: name, result });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
