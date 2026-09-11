import { sanitizeDisplay } from "../lib/sanitize";
import type { SensorStatus } from "../types";

export function SensorList({
  sensors,
  selectedId,
  onSelect,
}: {
  sensors: SensorStatus[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <ul className="space-y-1 p-2">
      <li>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex w-full items-center justify-between px-2 py-1.5 text-left font-mono text-xs ${
            selectedId === null ? "bg-hive-gold/15 text-hive-gold" : "text-hive-muted hover:text-white"
          }`}
        >
          <span>ALL SENSORS</span>
          <span>{sensors.length}</span>
        </button>
      </li>
      {sensors.map((sensor) => (
        <li key={sensor.id}>
          <button
            type="button"
            onClick={() => onSelect(sensor.id === selectedId ? null : sensor.id)}
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-xs ${
              selectedId === sensor.id ? "bg-hive-gold/15 text-hive-gold" : "hover:bg-white/5"
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${sensor.online ? "bg-hive-live" : "bg-hive-threat"}`}
            />
            <span className="flex-1 truncate">{sanitizeDisplay(sensor.label)}</span>
            <span className="text-hive-muted">{sanitizeDisplay(sensor.type)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
