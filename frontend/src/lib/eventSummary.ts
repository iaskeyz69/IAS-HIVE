import type { EventType, HiveEvent } from "../types";
import { sanitizeDisplay } from "./sanitize";

export const EVENT_TYPES: EventType[] = ["scan", "login_attempt", "command", "payload"];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  scan: "Scan",
  login_attempt: "Login",
  command: "Command",
  payload: "Payload",
};

function parseRaw(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function str(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export function eventMeta(event: HiveEvent): Record<string, unknown> {
  return parseRaw(event.raw);
}

export function eventKind(event: HiveEvent): string {
  return str(parseRaw(event.raw), "eventid", "event", "logtype");
}

export function eventSummary(event: HiveEvent): string {
  const obj = parseRaw(event.raw);
  const eventid = str(obj, "eventid", "event");
  const username = sanitizeDisplay(str(obj, "username"));
  const password = sanitizeDisplay(str(obj, "password"));
  const cred = username && password ? `${username}/${password}` : username || password;
  const input = sanitizeDisplay(str(obj, "input"));
  const dest = sanitizeDisplay(str(obj, "destfile", "outfile"));
  const shasum = sanitizeDisplay(str(obj, "shasum"));
  const version = sanitizeDisplay(str(obj, "version", "message"));
  const logdata = obj.logdata;
  let canaryMsg = "";
  if (logdata && typeof logdata === "object" && !Array.isArray(logdata)) {
    const nested = logdata as Record<string, unknown>;
    const msg = nested.msg;
    if (typeof msg === "string") canaryMsg = sanitizeDisplay(msg);
    else if (msg && typeof msg === "object" && "logdata" in (msg as object)) {
      canaryMsg = sanitizeDisplay(String((msg as { logdata?: unknown }).logdata ?? ""));
    }
  }

  if (eventid.includes("login.success")) return cred ? `login ${cred} ok` : "login ok";
  if (eventid.includes("login.failed") || eventid.includes("login.fail")) {
    return cred ? `login ${cred} fail` : "login fail";
  }
  if (event.event_type === "login_attempt") return cred ? `login ${cred}` : "login attempt";
  if (input) return `CMD: ${input.length > 80 ? `${input.slice(0, 80)}…` : input}`;
  if (event.event_type === "payload" || eventid.includes("file")) {
    if (dest) return `file ${dest}`;
    if (shasum) return `file ${shasum.slice(0, 12)}…`;
    return "file transfer";
  }
  if (eventid.includes("client.version") && version) {
    return `banner ${version.replace(/^Remote SSH version:\s*/i, "")}`;
  }
  if (eventid.includes("session.connect") || eventid.endsWith(".connect")) return "connect";
  if (eventid.includes("session.closed")) return "closed";
  if (eventid.includes("client.kex")) return "kex";
  if (canaryMsg) return canaryMsg;
  if (eventid) return eventid.replace(/^cowrie\./, "").replace(/^opencanary\./, "");
  return EVENT_TYPE_LABEL[event.event_type] || event.event_type;
}

export function loginOutcome(event: HiveEvent): "success" | "fail" | null {
  if (event.event_type !== "login_attempt") return null;
  const eventid = eventKind(event);
  if (eventid.includes("success")) return "success";
  if (eventid.includes("fail")) return "fail";
  return null;
}

export function portLabel(port: number, _protocol = ""): string {
  if (port === 2222) return "2222 Cowrie SSH";
  if (port === 22) return "22 SSH";
  if (port === 21) return "21 FTP";
  if (port === 23) return "23 Telnet";
  if (port === 3306) return "3306 MySQL";
  if (port === 6379) return "6379 Redis";
  if (port === 8080 || port === 80) return `${port} HTTP`;
  if (port === 443) return "443 TLS";
  return String(port);
}
