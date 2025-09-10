import { NextRequest, NextResponse } from "next/server";
import { getTimeBuckets } from "@/lib/store";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const from = search.get("from");
  const to = search.get("to");
  const step = parseInt(search.get("stepMinutes") ?? "5", 10);
  const topN = parseInt(search.get("topNPaths") ?? "10", 10);
  if (!from || !to) {
    return NextResponse.json({ success: false, message: "from and to are required" }, { status: 400 });
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(+fromDate) || Number.isNaN(+toDate) || toDate <= fromDate) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
  }
  const data = getTimeBuckets(fromDate, toDate, step, topN);
  return NextResponse.json({ success: true, result: data });
}
