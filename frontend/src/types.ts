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

export interface TypeTimeBucket {
  t: string;
  scan: number;
  login_attempt: number;
  command: number;
  payload: number;
}

export interface HitSnippet {
  timestamp: string;
  src_ip: string;
  text: string;
}

export interface StatsPayload {
  events_24h: number;
  unique_ips: number;
  by_type: { name: string; count: number }[];
  login_success: number;
  login_fail: number;
  lan_count: number;
  internet_count: number;
  top_countries: { name: string; count: number }[];
  top_ports: { port: number; count: number }[];
  over_time: TimelineBucket[];
  over_time_by_type: TypeTimeBucket[];
  protocols: { name: string; count: number }[];
  top_ips: { name: string; count: number }[];
  recent_commands: HitSnippet[];
  recent_payloads: HitSnippet[];
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
