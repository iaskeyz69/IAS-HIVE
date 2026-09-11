import { useCallback, useEffect, useState } from "react";
import { DetailPanel } from "./components/DetailPanel";
import { EventFeed } from "./components/EventFeed";
import { HudFrame } from "./components/HudFrame";
import { Login } from "./components/Login";
import { SensorList } from "./components/SensorList";
import { TimelineScrubber } from "./components/TimelineScrubber";
import { TopBar } from "./components/TopBar";
import { ViewToggle } from "./components/ViewToggle";
import { useHiveData } from "./hooks/useHiveData";
import { clearAuth, loadAuth } from "./lib/auth";
import type { ViewId } from "./types";
import { MapboxView } from "./views/MapboxView";
import { StatsView } from "./views/StatsView";
import { TableView } from "./views/TableView";

function formatCoord(lat: number | null | undefined, lon: number | null | undefined): string | null {
  if (lat == null || lon == null) return null;
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}  ${Math.abs(lon).toFixed(4)}°${ew}`;
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => loadAuth());
  const [view, setView] = useState<ViewId>("map3d");

  const onAuthFail = useCallback(() => {
    clearAuth();
    setToken(null);
  }, []);

  const data = useHiveData(token, onAuthFail);

  useEffect(() => {
    if (view === "stats") void data.refreshStats();
  }, [view, data.refreshStats]);

  if (!token) {
    return <Login onAuthed={setToken} />;
  }

  const online = data.sensors.filter((s) => s.online).length;
  const sensorEvents = data.events.filter((e) => e.sensor_id === data.selectedSensor?.id);
  const showMap = view === "map2d" || view === "map3d";
  const coord =
    formatCoord(
      data.selectedEvent?.src_lat ?? data.selectedEvent?.sensor_lat ?? data.selectedSensor?.lat ?? data.sensors[0]?.lat,
      data.selectedEvent?.src_lon ?? data.selectedEvent?.sensor_lon ?? data.selectedSensor?.lon ?? data.sensors[0]?.lon,
    );

  return (
    <div className="relative flex h-full flex-col bg-hive-bg text-hive-ink">
      <HudFrame />
      <TopBar
        onlineSensors={online}
        totalSensors={data.sensors.length}
        events24h={data.events24h}
        streamUp={data.streamUp}
        coord={coord}
        onLogout={onAuthFail}
      />
      <main className="relative min-h-0 flex-1 overflow-hidden bg-[#05060a]">
        {showMap ? (
          <MapboxView
            mode={view === "map3d" ? "3d" : "2d"}
            sensors={data.sensors}
            arcs={data.arcs}
            events={data.events}
            focus={data.selectedEvent}
            onSensor={data.pickSensor}
            onEvent={data.pickEvent}
          />
        ) : null}
        {view === "table" ? (
          <TableView events={data.events} selectedId={data.selectedEvent?.id ?? null} onSelect={data.pickEvent} />
        ) : null}
        {view === "stats" ? <StatsView stats={data.stats} /> : null}

        <ViewToggle view={view} onChange={setView} />

        <aside
          data-testid="left-rail"
          className="absolute left-3 top-14 z-20 flex w-72 max-h-[60%] flex-col gap-3 overflow-auto"
        >
          <section data-testid="connection-card" className="hive-float rounded-card p-3">
            <p className="font-mono text-[11px] tracking-wide text-hive-quiet">Connection</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>Stream</span>
              <span className={data.streamUp ? "font-mono text-hive-rec" : "font-mono text-hive-sting"}>
                {data.streamUp ? "Live" : "Down"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span>Sensors</span>
              <span className="font-mono text-hive-quiet">
                {online}/{data.sensors.length} online
              </span>
            </div>
          </section>
          <section data-testid="sensor-rail" className="hive-float rounded-card p-3">
            <p className="font-mono text-[11px] tracking-wide text-hive-quiet">Sensors</p>
            <SensorList
              sensors={data.sensors}
              selectedId={data.sensorId}
              onSelect={(id) => {
                const match = data.sensors.find((s) => s.id === id) ?? null;
                if (match) data.pickSensor(match);
                else {
                  data.setSensorId(null);
                  data.clearDetail();
                }
              }}
            />
          </section>
        </aside>

        {showMap ? (
          <div
            data-testid="live-card"
            className="hive-float absolute right-3 top-14 z-20 flex max-h-[58%] w-80 flex-col overflow-hidden rounded-card"
          >
            <p className="border-b border-hive-line px-4 py-2.5 font-mono text-[11px] tracking-wide text-hive-quiet">
              Live
            </p>
            <div className="min-h-0 flex-1 overflow-auto">
              <EventFeed
                events={data.events.slice(0, 80)}
                selectedId={data.selectedEvent?.id ?? null}
                onSelect={data.pickEvent}
              />
            </div>
          </div>
        ) : null}

        <DetailPanel
          event={data.selectedEvent}
          sensor={data.selectedEvent ? null : data.selectedSensor}
          sensorEvents={sensorEvents}
          onClose={data.clearDetail}
          onEvent={data.pickEvent}
        />

        <div data-testid="timeline-dock" className="absolute inset-x-3 bottom-3 z-20">
          <TimelineScrubber buckets={data.timeline} window={data.timeWindow} onChange={data.setTimeWindow} />
        </div>
      </main>
    </div>
  );
}
