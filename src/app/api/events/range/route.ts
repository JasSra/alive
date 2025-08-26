import { NextRequest, NextResponse } from "next/server";
import { getEventsRange, getHistory } from "@/lib/store";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const from = search.get("from");
  const to = search.get("to");
  const limit = Math.max(1, Math.min(5000, parseInt(search.get("limit") ?? "1000", 10)));
  const userScope = (search.get("userScope") ?? "all").toLowerCase();
  if (!from || !to) {
    return NextResponse.json({ success: false, message: "from and to are required" }, { status: 400 });
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(+fromDate) || Number.isNaN(+toDate) || toDate <= fromDate) {
    return NextResponse.json({ success: false, message: "Invalid date range" }, { status: 400 });
  }
  const userId = userScope === "current" ? req.headers.get("x-user-id") ?? undefined : undefined;
  // If userId is provided we can reuse history function; otherwise gather across users.
  if (userId) {
    const items = getHistory(userId, fromDate, toDate, limit);
    return NextResponse.json(items);
  }
  const items = getEventsRange(fromDate, toDate, undefined, limit);
  return NextResponse.json(items);
}
