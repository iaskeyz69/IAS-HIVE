import { useEffect, useState } from "react";

function utcStamp(): string {
  const now = new Date();
  return now.toISOString().replace(".000Z", "Z").slice(0, 19) + "Z";
}

export function TopBar({
  onlineSensors,
  totalSensors,
  events24h,
  streamUp,
  onLogout,
}: {
  onlineSensors: number;
  totalSensors: number;
  events24h: number;
  streamUp: boolean;
  onLogout: () => void;
}) {
  const [clock, setClock] = useState(utcStamp);

  useEffect(() => {
    const id = window.setInterval(() => setClock(utcStamp()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-hive-line bg-hive-panel px-4">
      <div className="flex items-center gap-6">
        <div>
          <p className="label-hud text-hive-gold">IAS HIVE</p>
          <p className="font-sans text-sm tracking-wide text-white">COMMAND CENTER</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${streamUp ? "bg-hive-live pulse-live" : "bg-hive-threat"}`} />
          <span className="label-hud text-white">{streamUp ? "ONLINE" : "DEGRADED"}</span>
        </div>
      </div>
      <div className="flex items-center gap-8 font-mono text-xs">
        <Stat label="UTC" value={clock} />
        <Stat label="SENSORS" value={`${onlineSensors}/${totalSensors}`} />
        <Stat label="24H EVENTS" value={String(events24h)} />
        <button
          type="button"
          onClick={onLogout}
          className="label-hud text-hive-muted hover:text-hive-gold"
        >
          LOCK
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-hud">{label}</p>
      <p className="text-hive-gold">{value}</p>
    </div>
  );
}
