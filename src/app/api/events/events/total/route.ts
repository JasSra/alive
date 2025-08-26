import { NextRequest, NextResponse } from "next/server";
import { getEventCounts, getTotalCount } from "@/lib/store";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const from = search.get("from");
  const to = search.get("to");
  const userScope = (search.get("userScope") ?? "current").toLowerCase();
  const eventPattern = search.get("eventPattern");
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
  let total: number;
  if (eventPattern && eventPattern.trim()) {
    total = getEventCounts(fromDate, toDate, userId)
      .filter((ec) => ec.eventName.toLowerCase().includes(eventPattern.toLowerCase()))
      .reduce((acc, c) => acc + c.count, 0);
  } else {
    total = getTotalCount(fromDate, toDate, userId);
  }
  return NextResponse.json(total);
}
