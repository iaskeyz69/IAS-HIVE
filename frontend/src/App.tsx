import { useCallback, useEffect, useState } from "react";
import { DetailPanel } from "./components/DetailPanel";
import { EventFeed } from "./components/EventFeed";
import { HudPanel } from "./components/HudPanel";
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

  return (
    <div className="flex h-full flex-col bg-hive-bg">
      <TopBar
        onlineSensors={online}
        totalSensors={data.sensors.length}
        events24h={data.events24h}
        streamUp={data.streamUp}
        onLogout={onAuthFail}
      />
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <HudPanel title="SENSORS" className="w-56 shrink-0">
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
        </HudPanel>

        <HudPanel
          className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden"
          bodyClassName="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ViewToggle view={view} onChange={setView} />
          {view === "map2d" || view === "map3d" ? (
            <MapboxView
              mode={view === "map3d" ? "3d" : "2d"}
              sensors={data.sensors}
              arcs={data.arcs}
              focus={data.selectedEvent}
              onSensor={data.pickSensor}
              onEvent={data.pickEvent}
            />
          ) : null}
          {view === "table" ? (
            <TableView events={data.events} selectedId={data.selectedEvent?.id ?? null} onSelect={data.pickEvent} />
          ) : null}
          {view === "stats" ? <StatsView stats={data.stats} /> : null}
          <DetailPanel
            event={data.selectedEvent}
            sensor={data.selectedEvent ? null : data.selectedSensor}
            sensorEvents={sensorEvents}
            onClose={data.clearDetail}
            onEvent={data.pickEvent}
          />
        </HudPanel>

        <HudPanel title="LIVE FEED" className="w-72 shrink-0" bodyClassName="overflow-auto">
          <EventFeed
            events={data.events.slice(0, 80)}
            selectedId={data.selectedEvent?.id ?? null}
            onSelect={data.pickEvent}
          />
        </HudPanel>
      </div>
      <TimelineScrubber buckets={data.timeline} window={data.timeWindow} onChange={data.setTimeWindow} />
    </div>
  );
}
