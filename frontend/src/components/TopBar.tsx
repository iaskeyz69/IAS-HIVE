import { useEffect, useState } from "react";

function utcStamp(): string {
  return new Date().toISOString().replace(".000Z", "Z").slice(0, 19) + "Z";
}

export function TopBar({
  onlineSensors,
  totalSensors,
  events24h,
  streamUp,
  coord,
  onLogout,
}: {
  onlineSensors: number;
  totalSensors: number;
  events24h: number;
  streamUp: boolean;
  coord?: string | null;
  onLogout: () => void;
}) {
  const [clock, setClock] = useState(utcStamp);

  useEffect(() => {
    const id = window.setInterval(() => setClock(utcStamp()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header
      data-testid="topbar"
      className="relative z-50 flex h-12 shrink-0 items-center justify-between border-b border-hive-line bg-hive-bg/95 px-5"
    >
      <div className="flex items-center gap-4">
        <p className="font-mono text-sm font-semibold tracking-[0.28em] text-hive-cyan">HIVE</p>
        <span
          className={`font-mono text-[11px] tracking-[0.22em] ${streamUp ? "text-hive-rec pulse-live" : "text-hive-sting"}`}
        >
          {streamUp ? "REC" : "OFF"}
        </span>
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${streamUp ? "bg-hive-rec pulse-live" : "bg-hive-sting"}`} />
          <span data-testid="stream-status" className={streamUp ? "text-hive-ink" : "text-hive-sting"}>
            {streamUp ? "Live" : "Degraded"}
          </span>
        </div>
        {coord ? <span className="hidden font-mono text-xs text-hive-quiet md:inline">{coord}</span> : null}
      </div>
      <div className="flex items-center gap-5 font-mono text-xs text-hive-quiet">
        <span data-testid="clock">{clock}</span>
        <span data-testid="sensor-count">
          {onlineSensors}/{totalSensors} sensors
        </span>
        <span data-testid="event-count">{events24h} events</span>
        <button
          type="button"
          data-testid="sign-out"
          onClick={onLogout}
          className="text-hive-ink hover:text-hive-cyan"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
