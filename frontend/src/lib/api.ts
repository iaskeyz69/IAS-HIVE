import { authHeader } from "./auth";
import type { HiveEvent, SensorStatus, StatsPayload, TimelineBucket, TimeWindow } from "../types";

export class AuthError extends Error {
  constructor() {
    super("unauthorized");
  }
}

async function request<T>(token: string, path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeader(token) });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
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
    request<{ status: string; demo: boolean; sensors: number; geoip: boolean }>(token, "/api/health"),
  sensors: (token: string) => request<SensorStatus[]>(token, "/api/sensors"),
  events: (
    token: string,
    opts: {
      sensorId?: string | null;
      window?: TimeWindow | null;
      q?: string;
      protocol?: string;
      severity?: string;
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
        limit: opts.limit ?? 200,
        offset: opts.offset ?? 0,
      })}`,
    ),
  stats: (token: string, sensorId?: string | null, window?: TimeWindow | null) =>
    request<StatsPayload>(
      token,
      `/api/stats${queryString({
        sensor_id: sensorId,
        from: window?.from,
        to: window?.to,
      })}`,
    ),
  timeline: (token: string, hours = 1, sensorId?: string | null) =>
    request<TimelineBucket[]>(
      token,
      `/api/timeline${queryString({ hours, sensor_id: sensorId })}`,
    ),
  summary: (token: string) =>
    request<{ events_24h: number; sensors: number }>(token, "/api/summary"),
};
