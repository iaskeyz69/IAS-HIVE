import type { EventType, Severity } from "../types";
import { EVENT_TYPE_LABEL } from "./eventSummary";

export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  scan: "rgba(232, 234, 237, 0.55)",
  login_attempt: "#00D4FF",
  command: "#FFB800",
  payload: "#FF4D4D",
};

export function eventTypeColor(eventType: EventType): string {
  return EVENT_TYPE_COLOR[eventType] ?? EVENT_TYPE_COLOR.scan;
}

export function eventTypeLabel(eventType: EventType): string {
  return EVENT_TYPE_LABEL[eventType] ?? eventType;
}

export function severityColor(severity: Severity): string {
  if (severity === "high") return EVENT_TYPE_COLOR.payload;
  if (severity === "medium") return EVENT_TYPE_COLOR.login_attempt;
  return EVENT_TYPE_COLOR.scan;
}

export function severityLabel(severity: Severity): string {
  if (severity === "high") return "payload";
  if (severity === "medium") return "login";
  return "scan";
}
