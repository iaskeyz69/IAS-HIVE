import { authHeader } from "./auth";
import type {
  BaitApplyResult,
  BaitPayload,
  BriefPayload,
  EventType,
  HiveEvent,
  SensorStatus,
  SessionCase,
  StatsPayload,
  TimelineBucket,
  TimeWindow,
} from "../types";

export class AuthError extends Error {
  constructor() {
    super("unauthorized");
  }
}

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(authHeader(token) as Record<string, string>) };
  if (init.body) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* keep status text */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function queryString(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") q.set(key, String(value));
  }
  const text = q.toString();
  return text ? `?${text}` : "";
}

export const api = {
  health: (token: string) =>
    request<{ status: string; demo: boolean; sensors: number; geoip: boolean; timezone?: string }>(token, "/api/health"),
  sensors: (token: string) => request<SensorStatus[]>(token, "/api/sensors"),
  events: (
    token: string,
    opts: {
      sensorId?: string | null;
      window?: TimeWindow | null;
      q?: string;
      protocol?: string;
      severity?: string;
      eventType?: EventType | null;
      srcIp?: string | null;
      country?: string | null;
      dstPort?: number | null;
      sessionId?: string | null;
      limit?: number;
      offset?: number;
    } = {},
  ) =>
    request<{ events: HiveEvent[]; total: number }>(
      token,
      `/api/events${queryString({
        sensor_id: opts.sensorId,
        from: opts.window?.from,
        to: opts.window?.to,
        q: opts.q,
        protocol: opts.protocol,
        severity: opts.severity,
        event_type: opts.eventType,
        src_ip: opts.srcIp,
        src_country: opts.country,
        dst_port: opts.dstPort,
        session_id: opts.sessionId,
        limit: opts.limit ?? 200,
        offset: opts.offset ?? 0,
      })}`,
    ),
  stats: (
    token: string,
    sensorId?: string | null,
    window?: TimeWindow | null,
    eventType?: EventType | null,
    srcIp?: string | null,
    country?: string | null,
    dstPort?: number | null,
    sessionId?: string | null,
  ) =>
    request<StatsPayload>(
      token,
      `/api/stats${queryString({
        sensor_id: sensorId,
        from: window?.from,
        to: window?.to,
        event_type: eventType,
        src_ip: srcIp,
        src_country: country,
        dst_port: dstPort,
        session_id: sessionId,
      })}`,
    ),
  timeline: (token: string, hours = 1, sensorId?: string | null) =>
    request<TimelineBucket[]>(token, `/api/timeline${queryString({ hours, sensor_id: sensorId })}`),
  summary: (token: string) => request<{ events_24h: number; sensors: number }>(token, "/api/summary"),
  cases: (token: string) => request<{ cases: SessionCase[] }>(token, "/api/cases"),
  brief: (token: string) => request<BriefPayload>(token, "/api/brief"),
  bait: (token: string) => request<BaitPayload>(token, "/api/bait"),
  saveBait: (token: string, services: Record<string, boolean>) =>
    request<BaitPayload>(token, "/api/bait", { method: "PUT", body: JSON.stringify({ services }) }),
  applyBait: (token: string) => request<BaitApplyResult>(token, "/api/bait/apply", { method: "POST" }),
};
