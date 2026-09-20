import { useMemo, useState } from "react";
import { HitFilters } from "../components/HitFilters";
import { TypeFilter } from "../components/TypeFilter";
import { eventTypeColor, eventTypeLabel } from "../lib/colors";
import { eventSummary, portLabel } from "../lib/eventSummary";
import { formatHiveClock, formatHiveDate, tzAbbrev } from "../lib/time";
import { sanitizeDisplay } from "../lib/sanitize";
import type { EventType, HiveEvent, TimeWindow } from "../types";

type Col = "timestamp" | "event_type" | "src_ip" | "summary" | "dst_port" | "session_id";

export function TableView({
  events,
  typeCounts,
  eventType,
  onEventType,
  timezone,
  timeWindow,
  onTimeWindow,
  srcIp,
  onSrcIp,
  country,
  onCountry,
  dstPort,
  onDstPort,
  sessionId,
  onSessionId,
  ipCounts,
  countryCounts,
  portCounts,
  sessions,
  selectedId,
  onSelect,
}: {
  events: HiveEvent[];
  typeCounts: Record<string, number>;
  eventType: EventType | null;
  onEventType: (next: EventType | null) => void;
  timezone: string;
  timeWindow: TimeWindow | null;
  onTimeWindow: (next: TimeWindow | null) => void;
  srcIp: string | null;
  onSrcIp: (next: string | null) => void;
  country: string | null;
  onCountry: (next: string | null) => void;
  dstPort: number | null;
  onDstPort: (next: number | null) => void;
  sessionId: string | null;
  onSessionId: (next: string | null) => void;
  ipCounts: Record<string, number>;
  countryCounts: Record<string, number>;
  portCounts: Record<string, number>;
  sessions: string[];
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

  function facetButton(label: string, onPick: () => void, testid: string) {
    return (
      <button
        type="button"
        data-testid={testid}
        className="text-left hover:text-hive-cyan"
        onClick={(ev) => {
          ev.stopPropagation();
          onPick();
        }}
        title="Filter to this value"
      >
        {label}
      </button>
    );
  }

  return (
    <div data-testid="table-view" className="absolute inset-0 flex flex-col bg-hive-bg p-4 pb-20 pl-[19.5rem] pr-4 pt-14">
      <div className="mb-3 flex flex-col gap-2">
        <TypeFilter value={eventType} counts={typeCounts} onChange={onEventType} />
        <HitFilters
          timezone={timezone}
          timeWindow={timeWindow}
          onTimeWindow={onTimeWindow}
          srcIp={srcIp}
          onSrcIp={onSrcIp}
          country={country}
          onCountry={onCountry}
          dstPort={dstPort}
          onDstPort={onDstPort}
          sessionId={sessionId}
          onSessionId={onSessionId}
          ipCounts={ipCounts}
          countryCounts={countryCounts}
          portCounts={portCounts}
          sessions={sessions}
          search={q}
          onSearch={setQ}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-card bg-hive-panel">
        {rows.length === 0 ? (
          <p data-testid="table-empty" className="px-4 py-10 text-center text-sm text-hive-quiet">
            No hits match these filters.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-hive-panel">
              <tr>
                {header("event_type", "Type")}
                {header("timestamp", `Time (${tzAbbrev(timezone)})`)}
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
                    <td data-testid="table-time" className="px-3 py-2 font-mono text-hive-cyan">
                      <div>{formatHiveClock(event.timestamp, timezone)}</div>
                      <div className="text-[11px] text-hive-quiet">{formatHiveDate(event.timestamp, timezone)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-hive-ink">
                        {facetButton(sanitizeDisplay(event.src_ip), () => onSrcIp(event.src_ip), "table-ip")}
                      </div>
                      <div className="text-[11px] text-hive-quiet">
                        {facetButton(sanitizeDisplay(event.src_country) || "UNK", () => onCountry(event.src_country), "table-country")}
                      </div>
                    </td>
                    <td data-testid="table-summary" className="max-w-[28rem] truncate px-3 py-2 text-hive-ink">
                      {eventSummary(event)}
                    </td>
                    <td className="px-3 py-2 font-mono text-hive-quiet">
                      {facetButton(portLabel(event.dst_port, event.protocol), () => onDstPort(event.dst_port), "table-port")}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-hive-quiet">
                      {event.session_id
                        ? facetButton(sanitizeDisplay(event.session_id), () => onSessionId(event.session_id), "table-session")
                        : "—"}
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
