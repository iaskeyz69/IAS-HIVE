import { severityColor, severityLabel } from "../lib/colors";
import { sanitizeDisplay } from "../lib/sanitize";
import type { HiveEvent } from "../types";

export function EventFeed({
  events,
  selectedId,
  onSelect,
}: {
  events: HiveEvent[];
  selectedId: string | null;
  onSelect: (event: HiveEvent) => void;
}) {
  return (
    <ul className="divide-y divide-hive-line/60">
      {events.length === 0 ? (
        <li className="px-3 py-6 font-mono text-xs text-hive-muted">NO EVENTS IN WINDOW</li>
      ) : (
        events.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => onSelect(event)}
              className={`flex w-full gap-2 px-3 py-2 text-left font-mono text-[11px] ${
                selectedId === event.id ? "bg-hive-gold/15" : "hover:bg-white/5"
              }`}
            >
              <span
                className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: severityColor(event.severity) }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex justify-between text-hive-muted">
                  <span>{event.timestamp.slice(11, 19)}</span>
                  <span style={{ color: severityColor(event.severity) }}>
                    {severityLabel(event.severity)}
                  </span>
                </span>
                <span className="block truncate text-white">
                  {sanitizeDisplay(event.src_ip)} → {sanitizeDisplay(event.sensor_id)}
                </span>
                <span className="block text-hive-muted">
                  {sanitizeDisplay(event.protocol)}:{event.dst_port} {sanitizeDisplay(event.src_country)}
                </span>
              </span>
            </button>
          </li>
        ))
      )}
    </ul>
  );
}
