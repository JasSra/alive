import { NextResponse } from "next/server";
import { ingestStore } from "@/lib/ingestStore";

export async function GET() {
  try {
    const counts = ingestStore.counts();
    const memUsage = process.memoryUsage();

    // Convert bytes to MB
    const memoryStats = {
      rss: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
      heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
      external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
      arrayBuffers: Math.round((memUsage.arrayBuffers / 1024 / 1024) * 100) / 100,
    };

    return NextResponse.json({
      success: true,
      memory: memoryStats,
      storage: {
        counts,
        capacity: counts.cap,
        utilizationPercent: Math.round(((counts.requests + counts.logs + counts.events + counts.raw) / (counts.cap * 4)) * 100),
      },
      limits: {
        maxItemsPerBuffer: counts.cap,
        totalBuffers: 4,
        maxTotalItems: counts.cap * 4,
      }
    });
  } catch (error) {
    console.error("Memory API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get memory stats" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { action, newLimit } = await req.json();

    if (action === "cleanup") {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      return NextResponse.json({
        success: true,
        message: "Garbage collection triggered",
        memory: {
          rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
          heapUsed: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        }
      });
    }

    if (action === "setLimit" && typeof newLimit === "number" && newLimit > 0) {
      // Note: This is a runtime change, actual env var change would require restart
      // For now, we'll return the current limit and suggest restart for permanent changes
      return NextResponse.json({
        success: true,
        message: `Memory limit change requires server restart. Current limit: ${ingestStore.counts().cap}`,
        currentLimit: ingestStore.counts().cap,
        requestedLimit: newLimit,
        note: "Set UNIFIED_INGEST_CAP environment variable and restart server for permanent change"
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action or parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Memory POST API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process memory action" },
      { status: 500 }
    );
  }
}
