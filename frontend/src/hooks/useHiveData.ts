import { useCallback, useEffect, useMemo, useState } from "react";
import { api, AuthError } from "../lib/api";
import { EVENT_TYPES } from "../lib/eventSummary";
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

export function useHiveData(token: string | null, onAuthFail: () => void) {
  const [sensors, setSensors] = useState<SensorStatus[]>([]);
  const [events, setEvents] = useState<HiveEvent[]>([]);
  const [arcs, setArcs] = useState<LiveArc[]>([]);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [events24h, setEvents24h] = useState(0);
  const [streamUp, setStreamUp] = useState(false);
  const [sensorId, setSensorId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventType | null>(null);
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
      const [sensorRows, eventPage, buckets, summary] = await Promise.all([
        api.sensors(token),
        api.events(token, { sensorId, window: timeWindow, limit: 400 }),
        api.timeline(token, 1, sensorId),
        api.summary(token),
      ]);
      setSensors(sensorRows);
      setEvents(eventPage.events);
      setTimeline(buckets);
      setEvents24h(summary.events_24h);
    } catch (err) {
      handleFail(err);
    }
  }, [token, sensorId, timeWindow, handleFail]);

  const refreshStats = useCallback(async () => {
    if (!token) return;
    try {
      setStats(await api.stats(token, sensorId, timeWindow, eventType));
    } catch (err) {
      handleFail(err);
    }
  }, [token, sensorId, timeWindow, eventType, handleFail]);

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
    () => events.filter((e) => (!sensorId || e.sensor_id === sensorId) && inWindow(e, timeWindow)),
    [events, sensorId, timeWindow],
  );

  const filteredEvents = useMemo(
    () => scoped.filter((e) => !eventType || e.event_type === eventType),
    [scoped, eventType],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(EVENT_TYPES.map((id) => [id, 0]));
    for (const event of scoped) counts[event.event_type] = (counts[event.event_type] ?? 0) + 1;
    return counts;
  }, [scoped]);

  const filteredArcs = useMemo(
    () =>
      arcs.filter(
        (e) =>
          (!sensorId || e.sensor_id === sensorId) &&
          inWindow(e, timeWindow) &&
          (!eventType || e.event_type === eventType),
      ),
    [arcs, sensorId, timeWindow, eventType],
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
    sensorId,
    setSensorId,
    eventType,
    setEventType,
    typeCounts,
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
