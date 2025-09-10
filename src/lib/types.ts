// Shared operation result type
export type OperationResult<T> =
  | { success: true; result: T; message?: string }
  | { success: false; message: string; errorCode?: string };

// AI event payloads and responses
export interface AIEventPayload {
  userAgent?: string;
  referrer?: string;
  sessionId?: string;
  userRole?: string;
  correlationId?: string;
  statusCode?: number;
  responseTimeMs?: number;
  serviceName?: string; // Service identifier for grouping
  metadata?: Record<string, unknown>;
}

export interface TrackEventResponse {
  success: boolean;
  message?: string;
  suggestions: AISuggestion[];
  eventId: string;
  timestamp: string; // ISO
}

export interface AISuggestion {
  id: string;
  title: string;
  description?: string;
  score?: number; // 0..1
  action?: {
    label: string;
    href?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
  };
  tags?: string[];
}

export interface PredictionContext {
  pageName?: string;
  userRole?: string;
  sessionMetadata?: Record<string, unknown>;
}

export interface EventAnalytics {
  eventName: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export interface EventCount {
  eventName: string;
  count: number;
  percentage?: number;
}

export interface ServiceStats {
  serviceName: string;
  eventCount: number;
  uniqueEvents: number;
  avgResponseTime?: number;
  errorRate?: number; // percentage
  lastSeen: string;
  topEvents: EventCount[];
}

export interface EventStatistics {
  totalEventCount: number;
  totalUniqueEvents: number;
  totalServices: number;
  perDay: { date: string; count: number }[];
  topEvents: EventCount[];
  serviceBreakdown: ServiceStats[];
}

export interface BatchTrackEventItem {
  eventName: string;
  payload?: AIEventPayload;
}

export interface BatchTrackEventRequest {
  batchId?: string;
  events: BatchTrackEventItem[];
}

// Internal store types
export interface StoredEvent {
  id: string;
  name: string;
  userId?: string | null;
  serviceName?: string; // Service identifier
  payload: AIEventPayload;
  timestamp: number; // epoch ms
}

export interface StreamEvent {
  type: "event" | "stats" | "ping";
  data: unknown;
}

export interface EventItemDTO {
  id: string;
  name: string;
  timestamp: string; // ISO
  userId?: string;
  serviceName?: string; // Service identifier
  correlationId?: string;
  statusCode?: number;
  responseTimeMs?: number;
  // Optional request context for filtering/display
  requestPath?: string; // server route path that handled event
  referrer?: string; // original page URL if provided
}

// JSON-driven chart config
export type ChartType = "bar" | "line";
export interface ChartSeries {
  label: string;
  color?: string; // Tailwind color or hex
  // path into API response item, e.g., 'count' or 'perDay[].count'
  valueKey: string;
}
export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  api: {
    kind: "statistics" | "counts" | "range";
    // optional filters
    eventPattern?: string;
    userScope?: "current" | "all";
  };
  xKey: string; // e.g., 'date' or 'eventName'
  series: ChartSeries[];
  height?: number; // px
  // Optional derived dataset instructions when api.kind === 'range'
  // latency-histogram: compute latency bins from responseTimeMs
  // error-rate: compute % errors (status>=400) over time buckets
  derived?: "latency-histogram" | "error-rate";
  // Optional bin thresholds in milliseconds for latency histogram (exclusive upper bounds),
  // e.g., [100, 300, 700, 1500] will create bins: 0-100,100-300,300-700,700-1500,1500+
  bins?: number[];
}

