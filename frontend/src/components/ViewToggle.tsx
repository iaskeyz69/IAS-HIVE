import type { ViewId } from "../types";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "map2d", label: "2D" },
  { id: "map3d", label: "3D" },
  { id: "table", label: "TABLE" },
  { id: "stats", label: "STATS" },
];

export function ViewToggle({ view, onChange }: { view: ViewId; onChange: (id: ViewId) => void }) {
  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 border border-hive-line bg-hive-bg/80">
      {VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`px-4 py-1 font-sans text-[10px] tracking-hud ${
            view === item.id ? "bg-hive-gold/20 text-hive-gold" : "text-hive-muted hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
