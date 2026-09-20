export const DEFAULT_TZ = "Asia/Kuala_Lumpur";

const PRESETS: { id: string; label: string; minutes: number | null }[] = [
  { id: "15m", label: "15m", minutes: 15 },
  { id: "1h", label: "1h", minutes: 60 },
  { id: "6h", label: "6h", minutes: 360 },
  { id: "24h", label: "24h", minutes: 1440 },
  { id: "7d", label: "7d", minutes: 10080 },
  { id: "all", label: "All", minutes: null },
];

export const TIME_PRESETS = PRESETS;

function zoneParts(date: Date, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out;
}

export function tzAbbrev(timeZone: string, at = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(at);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function formatHiveTime(iso: string, timeZone = DEFAULT_TZ): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .format(date)
      .replace(",", "");
  } catch {
    return iso;
  }
}

export function formatHiveClock(iso: string, timeZone = DEFAULT_TZ): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return iso.slice(11, 19);
  }
}

export function formatHiveDate(iso: string, timeZone = DEFAULT_TZ): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatHiveNow(timeZone = DEFAULT_TZ): string {
  return `${formatHiveTime(new Date().toISOString(), timeZone)} ${tzAbbrev(timeZone)}`;
}

export function toDatetimeLocal(iso: string, timeZone = DEFAULT_TZ): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = zoneParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function fromDatetimeLocal(value: string, timeZone = DEFAULT_TZ): string {
  if (!value) return "";
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = wanted;
  for (let i = 0; i < 3; i += 1) {
    const p = zoneParts(new Date(utc), timeZone);
    const asIf = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +(p.second || "0"));
    utc -= asIf - wanted;
  }
  return new Date(utc).toISOString();
}

export function presetWindow(minutes: number | null): { from: string; to: string } | null {
  if (minutes == null) return null;
  const to = new Date();
  const from = new Date(to.getTime() - minutes * 60_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function matchingPreset(window: { from: string; to: string } | null): string {
  if (!window) return "all";
  const from = new Date(window.from).getTime();
  const to = new Date(window.to).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return "custom";
  const spanMin = (to - from) / 60_000;
  const ageMin = (Date.now() - to) / 60_000;
  if (ageMin > 3) return "custom";
  for (const preset of PRESETS) {
    if (preset.minutes != null && Math.abs(spanMin - preset.minutes) < 2) return preset.id;
  }
  return "custom";
}
