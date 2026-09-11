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
      <th className="px-2 py-2 text-left">
        <button
          type="button"
          className="label-hud hover:text-hive-gold"
          onClick={() =>
            setSort((prev) => (prev.col === col ? { col, dir: prev.dir === 1 ? -1 : 1 } : { col, dir: -1 }))
          }
        >
          {label}
          {sort.col === col ? (sort.dir === -1 ? " ▼" : " ▲") : ""}
        </button>
      </th>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col p-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="FILTER TIMESTAMP / SENSOR / IP / PORT / PROTO / SESSION"
        className="mb-2 border border-hive-line bg-hive-bg px-3 py-2 font-mono text-xs text-white outline-none focus:border-hive-gold"
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead className="sticky top-0 bg-hive-panel">
            <tr>
              {header("timestamp", "TIMESTAMP")}
              {header("sensor_id", "SENSOR")}
              {header("src_ip", "SRC IP")}
              {header("dst_port", "DST PORT")}
              {header("protocol", "PROTOCOL")}
              {header("session_id", "SESSION")}
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => (
              <tr
                key={event.id}
                onClick={() => onSelect(event)}
                className={`cursor-pointer border-t border-hive-line/50 ${
                  selectedId === event.id ? "bg-hive-gold/15" : "hover:bg-white/5"
                }`}
              >
                <td className="px-2 py-1.5 text-hive-gold">{sanitizeDisplay(event.timestamp)}</td>
                <td className="px-2 py-1.5">{sanitizeDisplay(event.sensor_id)}</td>
                <td className="px-2 py-1.5">{sanitizeDisplay(event.src_ip)}</td>
                <td className="px-2 py-1.5">{event.dst_port}</td>
                <td className="px-2 py-1.5" style={{ color: severityColor(event.severity) }}>
                  {sanitizeDisplay(event.protocol)}
                </td>
                <td className="px-2 py-1.5 text-hive-muted">{sanitizeDisplay(event.session_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
