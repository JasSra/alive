import { NextRequest, NextResponse } from "next/server";
import { getEventStore, addEvents, clearEventStore, type ProcessedEvent, type BrowserEvent } from "../eventStore";

// Type for SSE clients
interface SSEClient {
  write: (data: string) => void;
}

declare global {
  var sseClients: SSEClient[] | undefined;
}

// Enhanced CORS headers for cross-origin event ingestion
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Monitor-Request, X-User-Id, X-Session-Id, X-Correlation-Id, Accept, Origin, User-Agent, Referer",
  "Access-Control-Allow-Credentials": "false",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

// Handle preflight OPTIONS requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events)) {
      return NextResponse.json(
        { error: "Events must be an array" },
        { 
          status: 400,
          headers: corsHeaders 
        }
      );
    }

    // Add timestamp and ID if missing
    const processedEvents: ProcessedEvent[] = events.map((event: BrowserEvent) => ({
      ...event,
      id: event.id || Math.random().toString(36).substr(2, 9),
      receivedAt: new Date().toISOString(),
      serverTimestamp: Date.now()
    }));

    // Store events
    addEvents(processedEvents);

    console.log(`[API] Received ${events.length} events from browser monitor`);

    // Send events to SSE stream if available
    if (global.sseClients && global.sseClients.length > 0) {
      processedEvents.forEach(event => {
        const sseData = JSON.stringify({
          type: 'browser-event',
          data: {
            name: `${event.type}:${event.name}`,
            timestamp: event.timestamp,
            payload: {
              correlationId: event.correlationId,
              statusCode: event.statusCode,
              responseTimeMs: event.responseTimeMs,
              serviceName: event.serviceName,
              ...event
            }
          }
        });

        global.sseClients!.forEach((client: SSEClient) => {
          try {
            client.write(`data: ${sseData}\n\n`);
          } catch (error) {
            console.error('Error sending to SSE client:', error);
          }
        });
      });
    }

    return NextResponse.json(
      { 
        success: true, 
        received: events.length,
        total: getEventStore().length 
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error("Error processing events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { 
        status: 500,
        headers: corsHeaders 
      }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const type = url.searchParams.get('type');
    const serviceName = url.searchParams.get('service');

    let filteredEvents = [...getEventStore()];

    // Filter by time range
    if (from) {
      const fromTime = new Date(from).getTime();
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.timestamp).getTime() >= fromTime
      );
    }

    if (to) {
      const toTime = new Date(to).getTime();
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.timestamp).getTime() <= toTime
      );
    }

    // Filter by event type
    if (type) {
      filteredEvents = filteredEvents.filter(event => 
        event.type.includes(type) || event.name.includes(type)
      );
    }

    // Filter by service name
    if (serviceName) {
      filteredEvents = filteredEvents.filter(event => 
        event.serviceName === serviceName
      );
    }

    // Sort by timestamp (newest first) and limit
    const result = filteredEvents
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return NextResponse.json(
      {
        events: result,
        total: filteredEvents.length,
        filtered: result.length
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { 
        status: 500,
        headers: corsHeaders 
      }
    );
  }
}

export async function DELETE() {
  try {
    const count = clearEventStore();
    
    return NextResponse.json(
      { 
        success: true, 
        cleared: count 
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error("Error clearing events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { 
        status: 500,
        headers: corsHeaders 
      }
    );
  }
}
