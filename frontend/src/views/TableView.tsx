import { useMemo, useState } from "react";
import { sanitizeDisplay } from "../lib/sanitize";
import { severityColor } from "../lib/colors";
import type { HiveEvent } from "../types";

type Col = "timestamp" | "sensor_id" | "src_ip" | "dst_port" | "protocol" | "session_id";

export function TableView({
  events,
  selectedId,
  onSelect,
}: {
  events: HiveEvent[];
  selectedId: string | null;
  onSelect: (event: HiveEvent) => void;
}) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "timestamp", dir: -1 });
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? events.filter((e) =>
          [e.timestamp, e.sensor_id, e.src_ip, String(e.dst_port), e.protocol, e.session_id]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : events;
    return [...filtered].sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
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
      <input
        data-testid="table-filter"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by time, sensor, IP, port, protocol, or session"
        className="mb-3 rounded-lg bg-hive-panel px-3 py-2 text-sm text-hive-ink outline-none ring-1 ring-hive-line focus:ring-hive-cyan"
      />
      <div className="min-h-0 flex-1 overflow-auto rounded-card bg-hive-panel">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-hive-panel">
            <tr>
              {header("timestamp", "Time")}
              {header("sensor_id", "Sensor")}
              {header("src_ip", "Source")}
              {header("dst_port", "Port")}
              {header("protocol", "Protocol")}
              {header("session_id", "Session")}
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => (
              <tr
                key={event.id}
                data-testid="table-row"
                onClick={() => onSelect(event)}
                className={`cursor-pointer border-t border-hive-line ${
                  selectedId === event.id ? "bg-hive-bg text-hive-cyan" : "hover:bg-hive-bg/70"
                }`}
              >
                <td className="px-3 py-2 text-hive-cyan">{sanitizeDisplay(event.timestamp)}</td>
                <td className="px-3 py-2">{sanitizeDisplay(event.sensor_id)}</td>
                <td className="px-3 py-2">{sanitizeDisplay(event.src_ip)}</td>
                <td className="px-3 py-2">{event.dst_port}</td>
                <td className="px-3 py-2" style={{ color: severityColor(event.severity) }}>
                  {sanitizeDisplay(event.protocol)}
                </td>
                <td className="px-3 py-2 text-hive-quiet">{sanitizeDisplay(event.session_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
