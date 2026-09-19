export type Severity = "low" | "medium" | "high";
export type EventType = "scan" | "login_attempt" | "payload" | "command";
export type ViewId = "map2d" | "map3d" | "table" | "stats" | "config";
export type BasemapId = "satellite" | "normal";

export interface HiveEvent {
  id: string;
  timestamp: string;
  sensor_id: string;
  sensor_lat: number;
  sensor_lon: number;
  src_ip: string;
  src_lat: number | null;
  src_lon: number | null;
  src_country: string;
  src_asn: string;
  dst_port: number;
  protocol: string;
  event_type: EventType;
  severity: Severity;
  raw: string;
  session_id: string;
}

export interface SensorStatus {
  id: string;
  label: string;
  type: string;
  lat: number;
  lon: number;
  log_path: string;
  online: boolean;
  last_event: string | null;
}

export interface TimelineBucket {
  t: string;
  count: number;
}

export interface StatsPayload {
  events_24h: number;
  top_countries: { name: string; count: number }[];
  top_ports: { port: number; count: number }[];
  over_time: TimelineBucket[];
  protocols: { name: string; count: number }[];
}

export interface TimeWindow {
  from: string;
  to: string;
}

export interface LiveArc extends HiveEvent {
  bornAt: number;
}

export interface BaitService {
  id: string;
  label: string;
  port: number;
  sensor: string;
  enabled: boolean;
  running: boolean | null;
}

export interface BaitPayload {
  bind: string;
  services: BaitService[];
}

export interface BaitApplyResult {
  ok: boolean;
  error: string | null;
  actions: string[];
  services: BaitService[];
  bind: string;
}
