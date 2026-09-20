import { useCallback, useEffect, useMemo, useState } from "react";
import { api, AuthError } from "../lib/api";
import { EVENT_TYPES } from "../lib/eventSummary";
import { DEFAULT_TZ } from "../lib/time";
import { openEventSocket } from "../lib/ws";
import type { EventType, HiveEvent, LiveArc, SensorStatus, StatsPayload, TimelineBucket, TimeWindow } from "../types";

const ARC_CAP = 200;
const EVENT_CAP = 2000;
const ARC_TTL_MS = 8000;

function isEvent(value: unknown): value is HiveEvent {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return typeof rec.id === "string" && typeof rec.timestamp === "string" && typeof rec.sensor_id === "string";
}

function inWindow(event: HiveEvent, range: TimeWindow | null): boolean {
  if (!range) return true;
  return event.timestamp >= range.from && event.timestamp <= range.to;
}

function countBy(events: HiveEvent[], key: (event: HiveEvent) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const name = key(event);
    if (!name) continue;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

export function useHiveData(token: string | null, onAuthFail: () => void) {
  const [sensors, setSensors] = useState<SensorStatus[]>([]);
  const [catalog, setCatalog] = useState<HiveEvent[]>([]);
  const [events, setEvents] = useState<HiveEvent[]>([]);
  const [arcs, setArcs] = useState<LiveArc[]>([]);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [events24h, setEvents24h] = useState(0);
  const [streamUp, setStreamUp] = useState(false);
  const [timezone, setTimezone] = useState(DEFAULT_TZ);
  const [sensorId, setSensorId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [srcIp, setSrcIp] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [dstPort, setDstPort] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HiveEvent | null>(null);
  const [selectedSensor, setSelectedSensor] = useState<SensorStatus | null>(null);

  const handleFail = useCallback(
    (err: unknown) => {
      if (err instanceof AuthError) onAuthFail();
    },
    [onAuthFail],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [sensorRows, eventPage, focusedPage, buckets, summary, health] = await Promise.all([
        api.sensors(token),
        api.events(token, { sensorId, window: timeWindow, limit: 400 }),
        srcIp
          ? api.events(token, { sensorId, window: timeWindow, srcIp, limit: 400 })
          : Promise.resolve(null),
        api.timeline(token, 1, sensorId),
        api.summary(token),
        api.health(token),
      ]);
      setSensors(sensorRows);
      setCatalog(eventPage.events);
      setEvents(focusedPage ? focusedPage.events : eventPage.events);
      setTimeline(buckets);
      setEvents24h(summary.events_24h);
      if (health.timezone) setTimezone(health.timezone);
    } catch (err) {
      handleFail(err);
    }
  }, [token, sensorId, timeWindow, srcIp, handleFail]);

  const refreshStats = useCallback(async () => {
    if (!token) return;
    try {
      setStats(await api.stats(token, sensorId, timeWindow, eventType, srcIp));
    } catch (err) {
      handleFail(err);
    }
  }, [token, sensorId, timeWindow, eventType, srcIp, handleFail]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (!token) return;
    const close = openEventSocket(
      token,
      (data) => {
        if (!isEvent(data)) return;
        setEvents24h((n) => n + 1);
        setCatalog((prev) => [data, ...prev.filter((e) => e.id !== data.id)].slice(0, EVENT_CAP));
        setEvents((prev) => [data, ...prev.filter((e) => e.id !== data.id)].slice(0, EVENT_CAP));
        setArcs((prev) => [{ ...data, bornAt: Date.now() }, ...prev].slice(0, ARC_CAP));
      },
      () => setStreamUp(false),
      () => setStreamUp(true),
    );
    return close;
  }, [token]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const cutoff = Date.now() - ARC_TTL_MS;
      setArcs((prev) => prev.filter((a) => a.bornAt >= cutoff));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const scoped = useMemo(
    () => catalog.filter((e) => (!sensorId || e.sensor_id === sensorId) && inWindow(e, timeWindow)),
    [catalog, sensorId, timeWindow],
  );

  const working = useMemo(
    () => (srcIp ? events : catalog).filter((e) => (!sensorId || e.sensor_id === sensorId) && inWindow(e, timeWindow)),
    [srcIp, events, catalog, sensorId, timeWindow],
  );

  const filteredEvents = useMemo(
    () =>
      working.filter(
        (e) =>
          (!eventType || e.event_type === eventType) &&
          (!srcIp || e.src_ip === srcIp) &&
          (!country || e.src_country === country) &&
          (dstPort == null || e.dst_port === dstPort) &&
          (!sessionId || e.session_id === sessionId),
      ),
    [working, eventType, srcIp, country, dstPort, sessionId],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(EVENT_TYPES.map((id) => [id, 0]));
    for (const event of scoped) counts[event.event_type] = (counts[event.event_type] ?? 0) + 1;
    return counts;
  }, [scoped]);

  const ipCounts = useMemo(() => countBy(scoped, (e) => e.src_ip), [scoped]);
  const countryCounts = useMemo(() => countBy(scoped, (e) => e.src_country || "UNK"), [scoped]);
  const portCounts = useMemo(() => countBy(scoped, (e) => String(e.dst_port)), [scoped]);
  const sessions = useMemo(
    () => [...new Set(scoped.map((e) => e.session_id).filter(Boolean))].slice(0, 80),
    [scoped],
  );

  const filteredArcs = useMemo(
    () =>
      arcs.filter(
        (e) =>
          (!sensorId || e.sensor_id === sensorId) &&
          inWindow(e, timeWindow) &&
          (!eventType || e.event_type === eventType) &&
          (!srcIp || e.src_ip === srcIp) &&
          (!country || e.src_country === country) &&
          (dstPort == null || e.dst_port === dstPort) &&
          (!sessionId || e.session_id === sessionId),
      ),
    [arcs, sensorId, timeWindow, eventType, srcIp, country, dstPort, sessionId],
  );

  const pickSensor = (sensor: SensorStatus | null) => {
    setSelectedSensor(sensor);
    setSelectedEvent(null);
    setSensorId(sensor?.id ?? null);
  };

  const pickEvent = (event: HiveEvent) => {
    setSelectedEvent(event);
    setSelectedSensor(sensors.find((s) => s.id === event.sensor_id) ?? null);
  };

  return {
    sensors,
    events: filteredEvents,
    arcs: filteredArcs,
    timeline,
    stats,
    events24h,
    streamUp,
    timezone,
    sensorId,
    setSensorId,
    eventType,
    setEventType,
    typeCounts,
    srcIp,
    setSrcIp,
    country,
    setCountry,
    dstPort,
    setDstPort,
    sessionId,
    setSessionId,
    ipCounts,
    countryCounts,
    portCounts,
    sessions,
    timeWindow,
    setTimeWindow,
    selectedEvent,
    selectedSensor,
    pickSensor,
    pickEvent,
    clearDetail: () => {
      setSelectedEvent(null);
      setSelectedSensor(null);
    },
    refreshStats,
  };
}
