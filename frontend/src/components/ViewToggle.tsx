import type { ViewId } from "../types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VIEWS: { id: ViewId; label: string; testid: string }[] = [
  { id: "map2d", label: "Map", testid: "view-map" },
  { id: "map3d", label: "Globe", testid: "view-globe" },
  { id: "table", label: "Table", testid: "view-table" },
  { id: "stats", label: "Stats", testid: "view-stats" },
  { id: "config", label: "Config", testid: "view-config" },
];

export function ViewToggle({ view, onChange }: { view: ViewId; onChange: (id: ViewId) => void }) {
  return (
    <Tabs value={view} onValueChange={(next) => onChange(next as ViewId)}>
      <TabsList data-testid="view-toggle">
        {VIEWS.map((item) => (
          <TabsTrigger key={item.id} value={item.id} data-testid={item.testid} aria-pressed={view === item.id}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
