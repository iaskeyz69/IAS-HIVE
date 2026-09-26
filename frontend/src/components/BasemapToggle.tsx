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
    <div data-testid="basemap-toggle" className="hive-glass flex overflow-hidden rounded-full p-1">
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid={item.testid}
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
          className={`rounded-full px-3 py-1 text-sm ${
            value === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
