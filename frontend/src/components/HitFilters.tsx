import { TIME_PRESETS, formatHiveTime, matchingPreset, presetWindow, toDatetimeLocal, fromDatetimeLocal, tzAbbrev } from "../lib/time";
import type { TimeWindow } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";

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

  function clearAll() {
    onTimeWindow(null);
    onSrcIp(null);
    onCountry(null);
    onDstPort(null);
    onSessionId(null);
    onSearch?.("");
  }

  return (
    <div data-testid="hit-filters" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-muted-foreground">Time {abbrev}</span>
        {TIME_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={active === preset.id ? "default" : "outline"}
            data-testid={`filter-time-${preset.id}`}
            aria-pressed={active === preset.id}
            onClick={() => onTimeWindow(presetWindow(preset.minutes))}
          >
            {preset.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant={active === "custom" ? "default" : "outline"}>
              Custom
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(20rem,calc(100vw-2rem))]">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-time-from">From</Label>
                <Input
                  id="filter-time-from"
                  data-testid="filter-time-from"
                  type="datetime-local"
                  value={fromLocal}
                  onChange={(e) => {
                    const from = e.target.value ? fromDatetimeLocal(e.target.value, timezone) : timeWindow?.from;
                    if (!from) return;
                    onTimeWindow({ from, to: timeWindow?.to ?? new Date().toISOString() });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-time-to">To</Label>
                <Input
                  id="filter-time-to"
                  data-testid="filter-time-to"
                  type="datetime-local"
                  value={toLocal}
                  onChange={(e) => {
                    const to = e.target.value ? fromDatetimeLocal(e.target.value, timezone) : timeWindow?.to;
                    if (!to) return;
                    onTimeWindow({ from: timeWindow?.from ?? to, to });
                  }}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {pills.length ? (
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            Clear all
          </Button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>Source IP</Label>
          <Select value={srcIp ?? ALL} onValueChange={(value) => onSrcIp(value === ALL ? null : value)}>
            <SelectTrigger data-testid="filter-ip">
              <SelectValue placeholder="All IPs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All IPs ({ips.length})</SelectItem>
              {ips.map(([ip, n]) => (
                <SelectItem key={ip} value={ip}>
                  {ip} ({n})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Country</Label>
          <Select value={country ?? ALL} onValueChange={(value) => onCountry(value === ALL ? null : value)}>
            <SelectTrigger data-testid="filter-country">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All countries</SelectItem>
              {countries.map(([name, n]) => (
                <SelectItem key={name} value={name}>
                  {name} ({n})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Port</Label>
          <Select
            value={dstPort == null ? ALL : String(dstPort)}
            onValueChange={(value) => onDstPort(value === ALL ? null : Number(value))}
          >
            <SelectTrigger data-testid="filter-port">
              <SelectValue placeholder="All ports" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All ports</SelectItem>
              {ports.map(([port, n]) => (
                <SelectItem key={port} value={port}>
                  {port} ({n})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-session">Session</Label>
          <Input
            id="filter-session"
            data-testid="filter-session"
            list="hive-sessions"
            value={sessionId ?? ""}
            onChange={(e) => onSessionId(e.target.value.trim() || null)}
            placeholder="Session id"
            className="font-mono"
          />
          <datalist id="hive-sessions">
            {sessions.slice(0, 40).map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </div>
      </div>
      {showSearch ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="table-filter">Contains</Label>
          <Input
            id="table-filter"
            data-testid="table-filter"
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder="Command, credential, banner…"
          />
        </div>
      ) : null}
      {pills.length ? (
        <div data-testid="filter-pills" className="flex flex-wrap gap-1.5">
          {pills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              data-testid={`filter-pill-${pill.key}`}
              onClick={pill.clear}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-foreground"
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
