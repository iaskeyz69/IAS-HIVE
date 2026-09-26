import { eventTypeColor, eventTypeLabel } from "../lib/colors";
import { eventSummary } from "../lib/eventSummary";
import { formatHiveClock } from "../lib/time";
import { sanitizeDisplay } from "../lib/sanitize";
import type { HiveEvent } from "../types";

export function EventFeed({
  events,
  selectedId,
  onSelect,
  timezone,
}: {
  events: HiveEvent[];
  selectedId: string | null;
  onSelect: (event: HiveEvent) => void;
  timezone: string;
}) {
  return (
    <ul data-testid="event-feed">
      {events.length === 0 ? (
        <li data-testid="event-empty" className="px-4 py-6 text-sm text-muted-foreground">
          No events in this window
        </li>
      ) : (
        events.map((event) => {
          const selected = selectedId === event.id;
          const accent = eventTypeColor(event.event_type);
          return (
            <li key={event.id}>
              <button
                type="button"
                data-testid="event-row"
                onClick={() => onSelect(event)}
                className={`flex w-full gap-2.5 border-b border-white/10 px-4 py-2.5 text-left ${
                  selected ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[13px] tabular-nums text-foreground">
                      {formatHiveClock(event.timestamp, timezone)}
                    </span>
                    <span className="shrink-0 text-xs font-medium" style={{ color: accent }}>
                      {eventTypeLabel(event.event_type)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[13px] text-foreground">
                    {sanitizeDisplay(event.src_ip)} → {sanitizeDisplay(event.sensor_id)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{eventSummary(event)}</span>
                </span>
              </button>
            </li>
          );
        })
      )}
    </ul>
  );
}
