import { useEffect, useState } from "react";
import { formatHiveNow } from "../lib/time";
import type { ViewId } from "../types";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "./ViewToggle";

export function TopBar({
  onlineSensors,
  totalSensors,
  events24h,
  streamUp,
  coord,
  timezone,
  view,
  onView,
  onLogout,
}: {
  onlineSensors: number;
  totalSensors: number;
  events24h: number;
  streamUp: boolean;
  coord?: string | null;
  timezone: string;
  view: ViewId;
  onView: (id: ViewId) => void;
  onLogout: () => void;
}) {
  const [clock, setClock] = useState(() => formatHiveNow(timezone));

  useEffect(() => {
    const tick = () => setClock(formatHiveNow(timezone));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timezone]);

  return (
    <header
      data-testid="topbar"
      className="relative z-50 flex h-[6.75rem] shrink-0 flex-col gap-2 border-b border-white/10 bg-background px-3 pt-2.5 lg:h-14 lg:flex-row lg:items-center lg:gap-4 lg:px-4 lg:pt-0"
    >
      <div className="flex min-w-0 items-center gap-3 max-lg:pr-44">
        <img src="/onex-logo.png" alt="Onex" className="h-5 w-auto" />
        <p className="text-sm font-medium">IAS-HIVE</p>
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${streamUp ? "bg-hive-rec pulse-live" : "bg-hive-sting"}`} />
          <span data-testid="stream-status" className={streamUp ? "text-foreground" : "text-hive-sting"}>
            {streamUp ? "Live" : "Degraded"}
          </span>
        </div>
        {coord ? <span className="hidden font-mono text-xs text-muted-foreground lg:inline">{coord}</span> : null}
      </div>
      <div className="min-w-0 overflow-x-auto lg:flex lg:flex-1 lg:justify-center">
        <ViewToggle view={view} onChange={onView} />
      </div>
      <div className="absolute right-3 top-2.5 flex items-center gap-3 text-sm text-muted-foreground lg:static lg:gap-4">
        <span data-testid="clock" className="hidden font-mono text-xs sm:inline">
          {clock}
        </span>
        <span data-testid="sensor-count">
          {onlineSensors}/{totalSensors}
          <span className="hidden lg:inline"> sensors</span>
        </span>
        <span data-testid="event-count">
          {events24h}
          <span className="hidden lg:inline"> events</span>
        </span>
        <Button type="button" variant="ghost" size="sm" data-testid="sign-out" onClick={onLogout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
