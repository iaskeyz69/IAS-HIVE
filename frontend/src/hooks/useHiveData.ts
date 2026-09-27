import { useCallback, useEffect, useMemo, useState } from "react";
import { api, AuthError } from "../lib/api";
import { EVENT_TYPES } from "../lib/eventSummary";
import { DEFAULT_TZ } from "../lib/time";
import { openEventSocket } from "../lib/ws";
import type { EventType, HiveEvent, LiveArc, SensorStatus, StatsPayload, TimelineBucket, TimeWindow } from "../types";

const ARC_CAP = 200;
const LIVE_CAP = 200;
const PAGE_SIZE = 100;
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

function matchesLive(
  event: HiveEvent,
  opts: {
    sensorId: string | null;
    eventType: EventType | null;
    srcIp: string | null;
    country: string | null;
    dstPort: number | null;
    sessionId: string | null;
    timeWindow: TimeWindow | null;
  },
): boolean {
  return (
    (!opts.sensorId || event.sensor_id === opts.sensorId) &&
    inWindow(event, opts.timeWindow) &&
    (!opts.eventType || event.event_type === opts.eventType) &&
    (!opts.srcIp || event.src_ip === opts.srcIp) &&
    (!opts.country || event.src_country === opts.country) &&
    (opts.dstPort == null || event.dst_port === opts.dstPort) &&
    (!opts.sessionId || event.session_id === opts.sessionId)
  );
}

export function useHiveData(token: string | null, onAuthFail: () => void) {
  const [sensors, setSensors] = useState<SensorStatus[]>([]);
  const [liveEvents, setLiveEvents] = useState<HiveEvent[]>([]);
  const [tableEvents, setTableEvents] = useState<HiveEvent[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [tableQuery, setTableQuery] = useState("");
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

  const eventQuery = useMemo(
    () => ({
      sensorId,
      window: timeWindow,
      srcIp,
      country,
      dstPort,
      sessionId,
      eventType,
    }),
    [sensorId, timeWindow, srcIp, country, dstPort, sessionId, eventType],
  );

  useEffect(() => {
    setPage(0);
  }, [sensorId, eventType, srcIp, country, dstPort, sessionId, timeWindow, tableQuery]);

  const refreshMeta = useCallback(async () => {
    if (!token) return;
    try {
      const [sensorRows, livePage, buckets, summary, health, statsRow] = await Promise.all([
        api.sensors(token),
        api.events(token, { ...eventQuery, limit: LIVE_CAP, offset: 0 }),
        api.timeline(token, 1, sensorId),
        api.summary(token),
        api.health(token),
        api.stats(token, sensorId, timeWindow, eventType, srcIp, country, dstPort, sessionId),
      ]);
      setSensors(sensorRows);
      setLiveEvents(livePage.events);
      setTimeline(buckets);
      setEvents24h(summary.events_24h);
      setStats(statsRow);
      if (health.timezone) setTimezone(health.timezone);
    } catch (err) {
      handleFail(err);
    }
  }, [token, eventQuery, sensorId, timeWindow, eventType, srcIp, country, dstPort, sessionId, handleFail]);

  const refreshTable = useCallback(async () => {
    if (!token) return;
    try {
      const tablePage = await api.events(token, {
        ...eventQuery,
        q: tableQuery.trim() || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setTableEvents(tablePage.events);
      setTableTotal(tablePage.total);
    } catch (err) {
      handleFail(err);
    }
  }, [token, eventQuery, tableQuery, page, handleFail]);

  const refreshStats = useCallback(async () => {
    if (!token) return;
    try {
      setStats(await api.stats(token, sensorId, timeWindow, eventType, srcIp, country, dstPort, sessionId));
    } catch (err) {
      handleFail(err);
    }
  }, [token, sensorId, timeWindow, eventType, srcIp, country, dstPort, sessionId, handleFail]);

  useEffect(() => {
    void refreshMeta();
    const id = window.setInterval(() => void refreshMeta(), 30000);
    return () => window.clearInterval(id);
  }, [refreshMeta]);

  useEffect(() => {
    void refreshTable();
    const id = window.setInterval(() => void refreshTable(), 30000);
    return () => window.clearInterval(id);
  }, [refreshTable]);

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
        const keep = matchesLive(data, {
          sensorId,
          eventType,
          srcIp,
          country,
          dstPort,
          sessionId,
          timeWindow,
        });
        if (keep) {
          setLiveEvents((prev) => [data, ...prev.filter((e) => e.id !== data.id)].slice(0, LIVE_CAP));
          if (page === 0 && !tableQuery.trim()) {
            setTableEvents((prev) => [data, ...prev.filter((e) => e.id !== data.id)].slice(0, PAGE_SIZE));
            setTableTotal((n) => n + 1);
          }
        }
        setArcs((prev) => [{ ...data, bornAt: Date.now() }, ...prev].slice(0, ARC_CAP));
      },
      () => setStreamUp(false),
      () => setStreamUp(true),
    );
    return close;
  }, [token, sensorId, eventType, srcIp, country, dstPort, sessionId, timeWindow, page, tableQuery]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const cutoff = Date.now() - ARC_TTL_MS;
      setArcs((prev) => prev.filter((a) => a.bornAt >= cutoff));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const scoped = useMemo(
    () => liveEvents.filter((e) => (!sensorId || e.sensor_id === sensorId) && inWindow(e, timeWindow)),
    [liveEvents, sensorId, timeWindow],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(EVENT_TYPES.map((id) => [id, 0]));
    const rows = stats?.type_totals?.length ? stats.type_totals : (stats?.by_type ?? []);
    for (const row of rows) counts[row.name] = row.count;
    return counts;
  }, [stats]);

  const ipCounts = useMemo(() => {
    if (stats?.facet_ips?.length) return Object.fromEntries(stats.facet_ips.map((row) => [row.name, row.count]));
    return countBy(scoped, (e) => e.src_ip);
  }, [stats, scoped]);
  const countryCounts = useMemo(() => {
    if (stats?.facet_countries?.length) {
      return Object.fromEntries(stats.facet_countries.map((row) => [row.name, row.count]));
    }
    return countBy(scoped, (e) => e.src_country || "UNK");
  }, [stats, scoped]);
  const portCounts = useMemo(() => {
    if (stats?.facet_ports?.length) {
      return Object.fromEntries(stats.facet_ports.map((row) => [String(row.port), row.count]));
    }
    return countBy(scoped, (e) => String(e.dst_port));
  }, [stats, scoped]);
  const sessions = useMemo(() => {
    if (stats?.facet_sessions?.length) return stats.facet_sessions;
    return [...new Set(scoped.map((e) => e.session_id).filter(Boolean))].slice(0, 80);
  }, [stats, scoped]);

  const filteredArcs = useMemo(
    () =>
      arcs.filter((e) =>
        matchesLive(e, { sensorId, eventType, srcIp, country, dstPort, sessionId, timeWindow }),
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

  const pageCount = tableTotal === 0 ? 1 : Math.ceil(tableTotal / PAGE_SIZE);

  return {
    sensors,
    events: liveEvents,
    tableEvents,
    tableTotal,
    page,
    pageSize: PAGE_SIZE,
    pageCount,
    setPage,
    tableQuery,
    setTableQuery,
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
