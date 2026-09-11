import type { Severity } from "../types";

export function severityColor(severity: Severity): string {
  if (severity === "high") return "#FF3B3B";
  if (severity === "medium") return "#38BDF8";
  return "#6B6B78";
}

export function severityLabel(severity: Severity): string {
  if (severity === "high") return "PAYLOAD";
  if (severity === "medium") return "AUTH";
  return "RECON";
}
