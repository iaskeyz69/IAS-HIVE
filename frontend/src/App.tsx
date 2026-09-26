import { useCallback, useEffect, useState } from "react";
import { DetailPanel } from "./components/DetailPanel";
import { EventFeed } from "./components/EventFeed";
import { Login } from "./components/Login";
import { SensorList } from "./components/SensorList";
import { TimelineScrubber } from "./components/TimelineScrubber";
import { TopBar } from "./components/TopBar";
import { BasemapToggle } from "./components/BasemapToggle";
import { TypeFilter } from "./components/TypeFilter";
import { useHiveData } from "./hooks/useHiveData";
import { clearAuth, loadAuth } from "./lib/auth";
import type { BasemapId, ViewId } from "./types";
import { MapboxView } from "./views/MapboxView";
import { StatsView } from "./views/StatsView";
import { ConfigView } from "./views/ConfigView";
import { CasesView } from "./views/CasesView";
import { TableView } from "./views/TableView";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatCoord(lat: number | null | undefined, lon: number | null | undefined): string | null {
  if (lat == null || lon == null) return null;
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}  ${Math.abs(lon).toFixed(4)}°${ew}`;
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => loadAuth());
  const [view, setView] = useState<ViewId>("map3d");
  const [basemap, setBasemap] = useState<BasemapId>("satellite");
  const [mapPanel, setMapPanel] = useState<"sensors" | "live" | null>(null);

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
  const coord = formatCoord(
    data.selectedEvent?.src_lat ?? data.selectedEvent?.sensor_lat ?? data.selectedSensor?.lat ?? data.sensors[0]?.lat,
    data.selectedEvent?.src_lon ?? data.selectedEvent?.sensor_lon ?? data.selectedSensor?.lon ?? data.sensors[0]?.lon,
  );

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <TopBar
        onlineSensors={online}
        totalSensors={data.sensors.length}
        events24h={data.events24h}
        streamUp={data.streamUp}
        coord={coord}
        timezone={data.timezone}
        view={view}
        onView={setView}
        onLogout={onAuthFail}
      />
      <main className="relative min-h-0 flex-1 overflow-hidden bg-[#0b0b0b]">
        {showMap ? (
          <MapboxView
            mode={view === "map3d" ? "3d" : "2d"}
            basemap={basemap}
            sensors={data.sensors}
            arcs={data.arcs}
            events={data.events}
            focus={data.selectedEvent}
            onSensor={data.pickSensor}
            onEvent={data.pickEvent}
          />
        ) : null}
        {view === "table" ? (
          <TableView
            events={data.tableEvents}
            typeCounts={data.typeCounts}
            eventType={data.eventType}
            onEventType={data.setEventType}
            timezone={data.timezone}
            timeWindow={data.timeWindow}
            onTimeWindow={data.setTimeWindow}
            srcIp={data.srcIp}
            onSrcIp={data.setSrcIp}
            country={data.country}
            onCountry={data.setCountry}
            dstPort={data.dstPort}
            onDstPort={data.setDstPort}
            sessionId={data.sessionId}
            onSessionId={data.setSessionId}
            ipCounts={data.ipCounts}
            countryCounts={data.countryCounts}
            portCounts={data.portCounts}
            sessions={data.sessions}
            search={data.tableQuery}
            onSearch={data.setTableQuery}
            selectedId={data.selectedEvent?.id ?? null}
            onSelect={data.pickEvent}
            page={data.page}
            pageCount={data.pageCount}
            pageSize={data.pageSize}
            total={data.tableTotal}
            onPage={data.setPage}
            detailOpen={Boolean(data.selectedEvent || data.selectedSensor)}
          />
        ) : null}
        {view === "cases" ? (
          <CasesView
            token={token}
            timezone={data.timezone}
            detailOpen={Boolean(data.selectedEvent || data.selectedSensor)}
          />
        ) : null}
        {view === "stats" ? (
          <StatsView
            stats={data.stats}
            typeCounts={data.typeCounts}
            eventType={data.eventType}
            onEventType={data.setEventType}
            timezone={data.timezone}
            timeWindow={data.timeWindow}
            onTimeWindow={data.setTimeWindow}
            srcIp={data.srcIp}
            onSrcIp={data.setSrcIp}
            country={data.country}
            onCountry={data.setCountry}
            dstPort={data.dstPort}
            onDstPort={data.setDstPort}
            sessionId={data.sessionId}
            onSessionId={data.setSessionId}
            ipCounts={data.ipCounts}
            countryCounts={data.countryCounts}
            portCounts={data.portCounts}
            sessions={data.sessions}
            detailOpen={Boolean(data.selectedEvent || data.selectedSensor)}
          />
        ) : null}
        {view === "config" ? (
          <ConfigView token={token} detailOpen={Boolean(data.selectedEvent || data.selectedSensor)} />
        ) : null}

        {showMap ? (
          <>
            <div className={`absolute right-3 top-3 z-30 ${mapPanel ? "max-md:hidden" : ""}`}>
              <BasemapToggle value={basemap} onChange={setBasemap} />
            </div>
            <div className="absolute inset-x-3 bottom-[4.75rem] z-30 flex justify-center lg:hidden">
              <div className="flex rounded-full bg-[#161616] p-1">
                <button
                  type="button"
                  data-testid="map-panel-sensors"
                  aria-pressed={mapPanel === "sensors"}
                  onClick={() => setMapPanel((current) => (current === "sensors" ? null : "sensors"))}
                  className={`rounded-full px-3 py-1 text-sm ${mapPanel === "sensors" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Sensors
                </button>
                <button
                  type="button"
                  data-testid="map-panel-live"
                  aria-pressed={mapPanel === "live"}
                  onClick={() => setMapPanel((current) => (current === "live" ? null : "live"))}
                  className={`rounded-full px-3 py-1 text-sm ${mapPanel === "live" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Live
                </button>
              </div>
            </div>
            <aside
              data-testid="left-rail"
              className={`absolute bottom-[7.25rem] left-3 top-3 z-20 w-72 max-md:right-3 max-md:w-auto max-md:rounded-xl max-md:bg-[#111111] max-md:p-2 flex-col gap-3 overflow-auto lg:bottom-[4.75rem] lg:right-auto lg:w-72 lg:bg-transparent lg:p-0 ${
                mapPanel === "live" ? "hidden lg:flex" : mapPanel === "sensors" ? "flex" : "hidden md:flex"
              }`}
            >
              <section data-testid="connection-card" className="hive-glass rounded-xl p-3">
                <p className="text-sm text-muted-foreground">Connection</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>Stream</span>
                  <span className={data.streamUp ? "text-hive-rec" : "text-hive-sting"}>{data.streamUp ? "Live" : "Down"}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span>Sensors</span>
                  <span className="text-muted-foreground">
                    {online}/{data.sensors.length} online
                  </span>
                </div>
              </section>
              <section className="hive-glass rounded-xl p-3">
                <p className="mb-2 text-sm text-muted-foreground">Kill chain</p>
                <TypeFilter value={data.eventType} counts={data.typeCounts} onChange={data.setEventType} />
              </section>
              <section data-testid="sensor-rail" className="hive-glass rounded-xl p-3">
                <p className="text-sm text-muted-foreground">Sensors</p>
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
            <div
              data-testid="live-card"
              className={`hive-glass absolute inset-x-3 bottom-[7.25rem] top-14 z-20 w-auto max-w-full flex-col overflow-hidden rounded-xl md:inset-x-auto md:right-3 md:w-80 lg:bottom-[4.75rem] ${
                mapPanel === "live" ? "flex" : "hidden lg:flex"
              }`}
            >
              <p className="border-b border-white/10 px-4 py-2.5 text-sm text-muted-foreground">Live</p>
              <ScrollArea className="min-h-0 flex-1">
                <EventFeed
                  events={data.events.slice(0, 80)}
                  selectedId={data.selectedEvent?.id ?? null}
                  onSelect={data.pickEvent}
                  timezone={data.timezone}
                />
              </ScrollArea>
            </div>
            <div data-testid="timeline-dock" className="absolute inset-x-3 bottom-3 z-20">
              <TimelineScrubber
                buckets={data.timeline}
                window={data.timeWindow}
                onChange={data.setTimeWindow}
                timezone={data.timezone}
              />
            </div>
          </>
        ) : null}

        <DetailPanel
          event={data.selectedEvent}
          sensor={data.selectedEvent ? null : data.selectedSensor}
          sensorEvents={sensorEvents}
          onClose={data.clearDetail}
          onEvent={data.pickEvent}
          timezone={data.timezone}
        />
      </main>
    </div>
  );
}
