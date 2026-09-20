import { TIME_PRESETS, formatHiveTime, matchingPreset, presetWindow, toDatetimeLocal, fromDatetimeLocal, tzAbbrev } from "../lib/time";
import type { TimeWindow } from "../types";

const selectClass =
  "rounded-lg bg-hive-panel px-2 py-1.5 font-mono text-xs text-hive-ink outline-none ring-1 ring-hive-line focus:ring-hive-cyan";

export function HitFilters({
  timezone,
  timeWindow,
  onTimeWindow,
  srcIp,
  onSrcIp,
  country,
  onCountry,
  dstPort,
  onDstPort,
  sessionId,
  onSessionId,
  ipCounts,
  countryCounts,
  portCounts,
  sessions,
  search = "",
  onSearch,
  showSearch = true,
}: {
  timezone: string;
  timeWindow: TimeWindow | null;
  onTimeWindow: (next: TimeWindow | null) => void;
  srcIp: string | null;
  onSrcIp: (next: string | null) => void;
  country: string | null;
  onCountry: (next: string | null) => void;
  dstPort: number | null;
  onDstPort: (next: number | null) => void;
  sessionId: string | null;
  onSessionId: (next: string | null) => void;
  ipCounts: Record<string, number>;
  countryCounts: Record<string, number>;
  portCounts: Record<string, number>;
  sessions: string[];
  search?: string;
  onSearch?: (next: string) => void;
  showSearch?: boolean;
}) {
  const active = matchingPreset(timeWindow);
  const abbrev = tzAbbrev(timezone);
  const fromLocal = timeWindow ? toDatetimeLocal(timeWindow.from, timezone) : "";
  const toLocal = timeWindow ? toDatetimeLocal(timeWindow.to, timezone) : "";
  const ips = Object.entries(ipCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const countries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const ports = Object.entries(portCounts).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]));

  const pills: { key: string; label: string; clear: () => void }[] = [];
  if (timeWindow) {
    pills.push({
      key: "time",
      label: `Time: ${formatHiveTime(timeWindow.from, timezone)} → ${formatHiveTime(timeWindow.to, timezone)}`,
      clear: () => onTimeWindow(null),
    });
  }
  if (srcIp) pills.push({ key: "ip", label: `IP: ${srcIp}`, clear: () => onSrcIp(null) });
  if (country) pills.push({ key: "country", label: `Country: ${country}`, clear: () => onCountry(null) });
  if (dstPort != null) pills.push({ key: "port", label: `Port: ${dstPort}`, clear: () => onDstPort(null) });
  if (sessionId) pills.push({ key: "session", label: `Session: ${sessionId}`, clear: () => onSessionId(null) });
  if (search.trim()) pills.push({ key: "q", label: `Contains: ${search.trim()}`, clear: () => onSearch?.("") });

  return (
    <div data-testid="hit-filters" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-wide text-hive-quiet">Time {abbrev}</span>
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            data-testid={`filter-time-${preset.id}`}
            aria-pressed={active === preset.id}
            onClick={() => onTimeWindow(presetWindow(preset.minutes))}
            className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${
              active === preset.id ? "bg-hive-cyan text-hive-bg" : "text-hive-quiet ring-1 ring-hive-line hover:text-hive-ink"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1 text-[11px] text-hive-quiet">
          From
          <input
            data-testid="filter-time-from"
            type="datetime-local"
            value={fromLocal}
            onChange={(e) => {
              const from = e.target.value ? fromDatetimeLocal(e.target.value, timezone) : timeWindow?.from;
              if (!from) return;
              onTimeWindow({ from, to: timeWindow?.to ?? new Date().toISOString() });
            }}
            className={selectClass}
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-hive-quiet">
          To
          <input
            data-testid="filter-time-to"
            type="datetime-local"
            value={toLocal}
            onChange={(e) => {
              const to = e.target.value ? fromDatetimeLocal(e.target.value, timezone) : timeWindow?.to;
              if (!to) return;
              onTimeWindow({ from: timeWindow?.from ?? to, to });
            }}
            className={selectClass}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          data-testid="filter-ip"
          value={srcIp ?? ""}
          onChange={(e) => onSrcIp(e.target.value || null)}
          className={`${selectClass} min-w-[11rem]`}
        >
          <option value="">All IPs ({ips.length})</option>
          {ips.map(([ip, n]) => (
            <option key={ip} value={ip}>
              {ip} ({n})
            </option>
          ))}
        </select>
        <select
          data-testid="filter-country"
          value={country ?? ""}
          onChange={(e) => onCountry(e.target.value || null)}
          className={`${selectClass} min-w-[8rem]`}
        >
          <option value="">All countries</option>
          {countries.map(([name, n]) => (
            <option key={name} value={name}>
              {name} ({n})
            </option>
          ))}
        </select>
        <select
          data-testid="filter-port"
          value={dstPort == null ? "" : String(dstPort)}
          onChange={(e) => onDstPort(e.target.value ? Number(e.target.value) : null)}
          className={`${selectClass} min-w-[8rem]`}
        >
          <option value="">All ports</option>
          {ports.map(([port, n]) => (
            <option key={port} value={port}>
              {port} ({n})
            </option>
          ))}
        </select>
        <input
          data-testid="filter-session"
          list="hive-sessions"
          value={sessionId ?? ""}
          onChange={(e) => onSessionId(e.target.value.trim() || null)}
          placeholder="Session id"
          className={`${selectClass} min-w-[10rem]`}
        />
        <datalist id="hive-sessions">
          {sessions.slice(0, 40).map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
        {showSearch ? (
          <input
            data-testid="table-filter"
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder="Contains command, credential, banner…"
            className="min-w-[16rem] flex-1 rounded-lg bg-hive-panel px-3 py-1.5 text-sm text-hive-ink outline-none ring-1 ring-hive-line focus:ring-hive-cyan"
          />
        ) : null}
      </div>
      {pills.length ? (
        <div data-testid="filter-pills" className="flex flex-wrap gap-1.5">
          {pills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              data-testid={`filter-pill-${pill.key}`}
              onClick={pill.clear}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-[rgba(0,212,255,0.12)] px-2.5 py-1 font-mono text-[11px] text-hive-cyan"
              title="Clear this filter"
            >
              <span className="truncate">{pill.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
