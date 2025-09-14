import { NextRequest, NextResponse } from "next/server";
import { ingestStore } from "@/lib/ingestStore";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const from = search.get("from");
  const to = search.get("to");
  const eventPattern = search.get("eventPattern");
  const userScope = (search.get("userScope") ?? "current").toLowerCase();
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
  const analytics = ingestStore.getAnalytics(fromDate, toDate, eventPattern, userId);
  return NextResponse.json(analytics);
}
