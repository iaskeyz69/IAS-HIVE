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
    <ul data-testid="sensor-list" className="mt-2">
      <li>
        <button
          type="button"
          data-testid="sensor-all"
          onClick={() => onSelect(null)}
          className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm ${
            selectedId === null ? "bg-hive-bg text-hive-cyan" : "text-hive-quiet hover:text-hive-ink"
          }`}
        >
          <span>All sensors</span>
          <span>{sensors.length}</span>
        </button>
      </li>
      {sensors.map((sensor) => (
        <li key={sensor.id}>
          <button
            type="button"
            data-testid="sensor-row"
            data-sensor-id={sensor.id}
            onClick={() => onSelect(sensor.id === selectedId ? null : sensor.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
              selectedId === sensor.id ? "bg-hive-bg text-hive-cyan" : "hover:bg-hive-bg"
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${sensor.online ? "bg-hive-blue" : "bg-hive-sting"}`} />
            <span className="flex-1 truncate">{sanitizeDisplay(sensor.label)}</span>
            <span className="text-hive-quiet">{sanitizeDisplay(sensor.type)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
