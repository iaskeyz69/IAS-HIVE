import type { ViewId } from "../types";

const VIEWS: { id: ViewId; label: string; testid: string }[] = [
  { id: "map2d", label: "Map", testid: "view-map" },
  { id: "map3d", label: "Globe", testid: "view-globe" },
  { id: "table", label: "Table", testid: "view-table" },
  { id: "stats", label: "Stats", testid: "view-stats" },
  { id: "config", label: "Config", testid: "view-config" },
];

export function ViewToggle({ view, onChange }: { view: ViewId; onChange: (id: ViewId) => void }) {
  return (
    <div data-testid="view-toggle" className="hive-float flex overflow-hidden rounded-full">
      {VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid={item.testid}
          aria-pressed={view === item.id}
          onClick={() => onChange(item.id)}
          className={`px-3 py-1.5 font-mono text-xs tracking-wide ${
            view === item.id ? "bg-hive-cyan text-hive-bg" : "text-hive-quiet hover:text-hive-ink"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
