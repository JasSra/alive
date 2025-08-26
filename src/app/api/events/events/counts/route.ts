import { NextRequest, NextResponse } from "next/server";
import { getEventCounts } from "@/lib/store";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const from = search.get("from");
  const to = search.get("to");
  const userScope = (search.get("userScope") ?? "current").toLowerCase();
  const orderBy = (search.get("orderBy") ?? "most").toLowerCase();
  const limit = Math.max(1, Math.min(1000, parseInt(search.get("limit") ?? "50", 10)));
  if (!from || !to) {
    return NextResponse.json(
      { success: false, message: "from and to are required" },
      { status: 400 },
    );
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(+fromDate) || Number.isNaN(+toDate) || toDate <= fromDate) {
    return NextResponse.json(
      { success: false, message: "Invalid date range" },
      { status: 400 },
    );
  }
  const userId = userScope === "current" ? req.headers.get("x-user-id") ?? undefined : undefined;
  const counts = getEventCounts(fromDate, toDate, userId);
  const total = counts.reduce((acc, c) => acc + c.count, 0);
  const withPct = counts.map((c) => ({ ...c, percentage: total ? (c.count / total) * 100 : 0 }));
  const ordered = (orderBy === "least" ? withPct.sort((a, b) => a.count - b.count) : withPct.sort((a, b) => b.count - a.count)).slice(0, limit);
  return NextResponse.json(ordered);
}
