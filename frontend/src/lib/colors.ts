import type { Severity } from "../types";

export function severityColor(severity: Severity): string {
  if (severity === "high") return "#FF4D4D";
  if (severity === "medium") return "#00D4FF";
  return "rgba(232, 234, 237, 0.45)";
}

export function severityLabel(severity: Severity): string {
  if (severity === "high") return "payload";
  if (severity === "medium") return "login";
  return "scan";
}
