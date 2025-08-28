// Shared event store for the application
interface BrowserEvent {
  id?: string;
  type: string;
  name: string;
  timestamp: string;
  timestampMs: number;
  userId: string;
  url: string;
  serviceName?: string;
  correlationId?: string;
  statusCode?: number;
  responseTimeMs?: number;
  userAgent?: string;
  [key: string]: unknown;
}

interface ProcessedEvent extends BrowserEvent {
  receivedAt: string;
  serverTimestamp: number;
}

// Store events in memory (in production, you'd use a database)
let eventStore: ProcessedEvent[] = [];

export function getEventStore(): ProcessedEvent[] {
  return eventStore;
}

export function addEvents(events: ProcessedEvent[]): void {
  eventStore.push(...events);
  
  // Keep only last 10000 events to prevent memory issues
  if (eventStore.length > 10000) {
    eventStore = eventStore.slice(-10000);
  }
}

export function clearEventStore(): number {
  const count = eventStore.length;
  eventStore = [];
  return count;
}

export { type ProcessedEvent, type BrowserEvent };
