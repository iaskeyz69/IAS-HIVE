import type { BasemapId } from "../types";

const MODES: { id: BasemapId; label: string; testid: string }[] = [
  { id: "satellite", label: "Satellite", testid: "basemap-satellite" },
  { id: "normal", label: "Normal", testid: "basemap-normal" },
];

export function BasemapToggle({
  value,
  onChange,
}: {
  value: BasemapId;
  onChange: (id: BasemapId) => void;
}) {
  return (
    <div data-testid="basemap-toggle" className="hive-float flex overflow-hidden rounded-full">
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid={item.testid}
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
          className={`px-3 py-1.5 font-mono text-xs tracking-wide ${
            value === item.id
              ? item.id === "normal"
                ? "bg-[#00E676] text-black"
                : "bg-hive-cyan text-hive-bg"
              : "text-hive-quiet hover:text-hive-ink"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
