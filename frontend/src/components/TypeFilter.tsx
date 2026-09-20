import type { EventType } from "../types";
import { EVENT_TYPE_COLOR, eventTypeLabel } from "../lib/colors";
import { EVENT_TYPES } from "../lib/eventSummary";

const CHIPS: { id: EventType | null; key: string; label: string }[] = [
  { id: null, key: "all", label: "All" },
  ...EVENT_TYPES.map((id) => ({
    id,
    key: id === "login_attempt" ? "login" : id,
    label: eventTypeLabel(id),
  })),
];

export function TypeFilter({
  value,
  counts,
  onChange,
}: {
  value: EventType | null;
  counts: Record<string, number>;
  onChange: (next: EventType | null) => void;
}) {
  const total = EVENT_TYPES.reduce((sum, id) => sum + (counts[id] ?? 0), 0);

  return (
    <div data-testid="type-filter" className="flex flex-wrap items-center gap-1.5">
      {CHIPS.map((chip) => {
        const active = value === chip.id;
        const count = chip.id ? (counts[chip.id] ?? 0) : total;
        const accent = chip.id ? EVENT_TYPE_COLOR[chip.id] : "#00D4FF";
        return (
          <button
            key={chip.key}
            type="button"
            data-testid={`type-filter-${chip.key}`}
            aria-pressed={active}
            onClick={() => onChange(chip.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] tracking-wide ${
              active ? "text-hive-bg" : "text-hive-quiet ring-1 ring-hive-line hover:text-hive-ink"
            }`}
            style={active ? { background: accent } : { color: chip.id ? accent : undefined }}
          >
            <span>{chip.label}</span>
            <span className={active ? "opacity-80" : "text-hive-quiet"}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
