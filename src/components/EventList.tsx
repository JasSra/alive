"use client";
import { memo } from "react";

type BasicItem = { id: string; name?: string; timestamp?: string; userId?: string; data?: unknown; t?: number };
interface EventListProps { items: BasicItem[] }

const EventList = memo(function EventList({ items }: EventListProps) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <ul role="list" className="divide-y divide-neutral-200 dark:divide-neutral-800">
  {items.map((e) => (
          <li key={(e.id ?? String(e.t))} className="p-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-mono text-sm truncate">
                {e.name ?? (typeof e.data === "object" && e.data && "name" in (e.data as Record<string, unknown>) ? String((e.data as Record<string, unknown>).name) : undefined) ??
                  (typeof e.data === "object" && e.data && "type" in (e.data as Record<string, unknown>) ? String((e.data as Record<string, unknown>).type) : "")}
              </div>
              <div className="text-xs text-neutral-500 truncate">{new Date(e.timestamp ?? e.t ?? Date.now()).toLocaleString()} {e.userId ? `• ${e.userId}` : ""}</div>
            </div>
            <div className="text-xs text-neutral-400 truncate max-w-[40%] text-right" aria-hidden>
              {typeof e.data === "object" ? JSON.stringify(e.data).slice(0, 80) : String(e.data ?? "")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default EventList;
