import { useMemo, useState } from "react";
import { TypeFilter } from "../components/TypeFilter";
import { eventTypeColor, eventTypeLabel } from "../lib/colors";
import { eventSummary, portLabel } from "../lib/eventSummary";
import { sanitizeDisplay } from "../lib/sanitize";
import type { EventType, HiveEvent } from "../types";

type Col = "timestamp" | "event_type" | "src_ip" | "summary" | "dst_port" | "session_id";

export function TableView({
  events,
  typeCounts,
  eventType,
  onEventType,
  selectedId,
  onSelect,
}: {
  events: HiveEvent[];
  typeCounts: Record<string, number>;
  eventType: EventType | null;
  onEventType: (next: EventType | null) => void;
  selectedId: string | null;
  onSelect: (event: HiveEvent) => void;
}) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "timestamp", dir: -1 });
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? events.filter((e) =>
          [
            e.timestamp,
            e.sensor_id,
            e.src_ip,
            e.src_country,
            String(e.dst_port),
            e.protocol,
            e.session_id,
            e.event_type,
            eventSummary(e),
            e.raw,
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : events;
    return [...filtered].sort((a, b) => {
      const av = sort.col === "summary" ? eventSummary(a) : a[sort.col];
      const bv = sort.col === "summary" ? eventSummary(b) : b[sort.col];
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [events, q, sort]);

  function header(col: Col, label: string) {
    return (
      <th className="px-3 py-2 text-left">
        <button
          type="button"
          data-testid={`table-sort-${col}`}
          className="text-sm text-hive-quiet hover:text-hive-cyan"
          onClick={() =>
            setSort((prev) => (prev.col === col ? { col, dir: prev.dir === 1 ? -1 : 1 } : { col, dir: -1 }))
          }
        >
          {label}
          {sort.col === col ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
        </button>
      </th>
    );
  }

  return (
    <div data-testid="table-view" className="absolute inset-0 flex flex-col bg-hive-bg p-4 pb-20 pl-[19.5rem] pr-4 pt-14">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TypeFilter value={eventType} counts={typeCounts} onChange={onEventType} />
        <input
          data-testid="table-filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search IP, command, credential, session, country…"
          className="min-w-[16rem] flex-1 rounded-lg bg-hive-panel px-3 py-2 text-sm text-hive-ink outline-none ring-1 ring-hive-line focus:ring-hive-cyan"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-card bg-hive-panel">
        {rows.length === 0 ? (
          <p data-testid="table-empty" className="px-4 py-10 text-center text-sm text-hive-quiet">
            No hits in this kill-chain filter.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-hive-panel">
              <tr>
                {header("event_type", "Type")}
                {header("timestamp", "Time")}
                {header("src_ip", "Source")}
                {header("summary", "What happened")}
                {header("dst_port", "Port")}
                {header("session_id", "Session")}
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => {
                const selected = selectedId === event.id;
                const accent = eventTypeColor(event.event_type);
                return (
                  <tr
                    key={event.id}
                    data-testid="table-row"
                    onClick={() => onSelect(event)}
                    className={`cursor-pointer border-t border-hive-line ${
                      selected ? "bg-hive-bg" : "hover:bg-hive-bg/70"
                    }`}
                    style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
                  >
                    <td className="px-3 py-2">
                      <span
                        data-testid="table-type"
                        className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
                        style={{ color: accent, boxShadow: `inset 0 0 0 1px ${accent}` }}
                      >
                        {eventTypeLabel(event.event_type)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-hive-cyan">{sanitizeDisplay(event.timestamp)}</td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-hive-ink">{sanitizeDisplay(event.src_ip)}</div>
                      <div className="text-[11px] text-hive-quiet">{sanitizeDisplay(event.src_country) || "UNK"}</div>
                    </td>
                    <td data-testid="table-summary" className="max-w-[28rem] truncate px-3 py-2 text-hive-ink">
                      {eventSummary(event)}
                    </td>
                    <td className="px-3 py-2 font-mono text-hive-quiet">
                      {portLabel(event.dst_port, event.protocol)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-hive-quiet">
                      {sanitizeDisplay(event.session_id) || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
