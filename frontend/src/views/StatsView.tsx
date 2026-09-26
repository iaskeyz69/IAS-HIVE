import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import { TypeFilter } from "../components/TypeFilter";
import { HitFilters } from "../components/HitFilters";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EVENT_TYPE_COLOR } from "../lib/colors";
import { EVENT_TYPE_LABEL, portLabel } from "../lib/eventSummary";
import { formatHiveClock } from "../lib/time";
import { sanitizeDisplay } from "../lib/sanitize";
import type { EventType, StatsPayload, TimeWindow } from "../types";

const QUIET = "rgba(250, 250, 249, 0.62)";
const SLICES = ["#00D4FF", "#FF4D4D", "#FFB800", "rgba(250,250,249,0.45)", "#33FF33", "#66E0FF", "#FAFAF9"];
const tip = { background: "#161616", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "#FAFAF9" };

export function StatsView({
  stats,
  typeCounts,
  eventType,
  onEventType,
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
  detailOpen = false,
}: {
  stats: StatsPayload | null;
  typeCounts: Record<string, number>;
  eventType: EventType | null;
  onEventType: (next: EventType | null) => void;
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
  detailOpen?: boolean;
}) {
  if (!stats) {
    return (
      <div
        data-testid="stats-loading"
        className={`absolute bottom-0 left-0 top-0 space-y-3 bg-background p-4 ${detailOpen ? "right-[27.5rem]" : "right-0"}`}
      >
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  const byType = Object.fromEntries(stats.by_type.map((row) => [row.name, row.count]));
  const stacked = stats.over_time_by_type.length
    ? stats.over_time_by_type
    : stats.over_time.map((row) => ({ t: row.t, scan: row.count, login_attempt: 0, command: 0, payload: 0 }));

  return (
    <div
      data-testid="stats-view"
      className={`absolute bottom-0 left-0 top-0 overflow-auto bg-background p-4 ${detailOpen ? "right-[27.5rem]" : "right-0"}`}
    >
      <div className="mb-3 flex flex-col gap-2">
        <TypeFilter value={eventType} counts={typeCounts} onChange={onEventType} />
        <HitFilters
          timezone={timezone}
          timeWindow={timeWindow}
          onTimeWindow={onTimeWindow}
          srcIp={srcIp}
          onSrcIp={onSrcIp}
          country={country}
          onCountry={onCountry}
          dstPort={dstPort}
          onDstPort={onDstPort}
          sessionId={sessionId}
          onSessionId={onSessionId}
          ipCounts={ipCounts}
          countryCounts={countryCounts}
          portCounts={portCounts}
          sessions={sessions}
          showSearch={false}
        />
      </div>
      <div data-testid="stats-kpis" className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Unique IPs" value={stats.unique_ips} testid="kpi-unique-ips" />
        <Kpi label="Scans" value={byType.scan ?? 0} color={EVENT_TYPE_COLOR.scan} testid="kpi-scan" />
        <Kpi
          label="Logins"
          value={byType.login_attempt ?? 0}
          detail={`${stats.login_success} ok · ${stats.login_fail} fail`}
          color={EVENT_TYPE_COLOR.login_attempt}
          testid="kpi-login"
        />
        <Kpi label="Commands" value={byType.command ?? 0} color={EVENT_TYPE_COLOR.command} testid="kpi-command" />
        <Kpi label="Payloads" value={byType.payload ?? 0} color={EVENT_TYPE_COLOR.payload} testid="kpi-payload" />
        <Kpi label="LAN vs net" value={stats.internet_count} detail={`${stats.lan_count} LAN`} testid="kpi-lan" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="Events over time by type">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stacked}>
              <CartesianGrid stroke="rgba(59,130,246,0.12)" />
              <XAxis dataKey="t" tick={{ fill: QUIET, fontSize: 11 }} tickFormatter={(v) => formatHiveClock(String(v), timezone)} />
              <YAxis tick={{ fill: QUIET, fontSize: 11 }} />
              <Tooltip contentStyle={tip} />
              <Legend />
              <Line type="monotone" dataKey="scan" name="Scan" stroke={EVENT_TYPE_COLOR.scan} dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="login_attempt" name="Login" stroke={EVENT_TYPE_COLOR.login_attempt} dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="command" name="Command" stroke={EVENT_TYPE_COLOR.command} dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="payload" name="Payload" stroke={EVENT_TYPE_COLOR.payload} dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Top countries (internet)"
          extra={
            <div data-testid="stats-lan-split" className="flex gap-3 text-xs text-muted-foreground">
              <span>
                Internet <span className="font-mono text-foreground">{stats.internet_count}</span>
              </span>
              <span>
                LAN <span className="font-mono text-foreground">{stats.lan_count}</span>
              </span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.top_countries} layout="vertical">
              <CartesianGrid stroke="rgba(59,130,246,0.12)" />
              <XAxis type="number" tick={{ fill: QUIET, fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={48} tick={{ fill: QUIET, fontSize: 11 }} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="count" fill="#00D4FF" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top ports">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.top_ports.map((p) => ({ name: portLabel(p.port), count: p.count }))}>
              <CartesianGrid stroke="rgba(59,130,246,0.12)" />
              <XAxis dataKey="name" tick={{ fill: QUIET, fontSize: 11 }} />
              <YAxis tick={{ fill: QUIET, fontSize: 11 }} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="count" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Protocols">
          <div className="flex h-full min-h-0 items-center gap-3">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.protocols} dataKey="count" nameKey="name" innerRadius={46} outerRadius={70} paddingAngle={2}>
                    {stats.protocols.map((_, i) => (
                      <Cell key={i} fill={SLICES[i % SLICES.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul data-testid="stats-protocol-legend" className="w-36 shrink-0 space-y-1.5 text-xs">
              {stats.protocols.map((row, i) => (
                <li key={row.name} className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: SLICES[i % SLICES.length] }} />
                    {sanitizeDisplay(row.name) || "unk"}
                  </span>
                  <span className="font-mono text-foreground">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
        <ListCard title="Top source IPs" testid="stats-top-ips">
          {stats.top_ips.map((row) => (
            <li key={row.name} className="flex justify-between gap-3 font-mono text-xs">
              <span className="truncate text-foreground">{sanitizeDisplay(row.name)}</span>
              <span className="text-muted-foreground">{row.count}</span>
            </li>
          ))}
        </ListCard>
        <ListCard title="Recent commands" testid="stats-commands">
          {stats.recent_commands.map((row, i) => (
            <li key={`${row.timestamp}-${i}`} className="text-xs">
              <span className="font-mono text-muted-foreground">
                {formatHiveClock(row.timestamp, timezone)} {sanitizeDisplay(row.src_ip)}
              </span>
              <p className="truncate text-foreground">{sanitizeDisplay(row.text)}</p>
            </li>
          ))}
        </ListCard>
        <ListCard title="Recent payloads" testid="stats-payloads">
          {stats.recent_payloads.map((row, i) => (
            <li key={`${row.timestamp}-${i}`} className="text-xs">
              <span className="font-mono text-muted-foreground">
                {formatHiveClock(row.timestamp, timezone)} {sanitizeDisplay(row.src_ip)}
              </span>
              <p className="truncate text-foreground">{sanitizeDisplay(row.text)}</p>
            </li>
          ))}
        </ListCard>
        <ChartCard title="Kill chain mix">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.by_type.map((row) => ({
                name: EVENT_TYPE_LABEL[row.name as EventType] ?? row.name,
                count: row.count,
              }))}
            >
              <CartesianGrid stroke="rgba(59,130,246,0.12)" />
              <XAxis dataKey="name" tick={{ fill: QUIET, fontSize: 11 }} />
              <YAxis tick={{ fill: QUIET, fontSize: 11 }} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="count">
                {stats.by_type.map((row) => (
                  <Cell key={row.name} fill={EVENT_TYPE_COLOR[row.name as EventType] ?? "#00D4FF"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
  color,
  testid,
}: {
  label: string;
  value: number;
  detail?: string;
  color?: string;
  testid: string;
}) {
  return (
    <div data-testid={testid} className="rounded-xl border border-white/10 bg-card px-4 py-3">
      <p className="text-3xl font-normal tabular-nums tracking-tight text-foreground" style={color ? { color } : undefined}>
        {value}
      </p>
      <div className="mt-2 h-px w-8 bg-white/70" />
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function ChartCard({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <Card data-testid="stats-card" className="flex min-h-[220px] flex-col p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {extra}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}

function ListCard({ title, testid, children }: { title: string; testid: string; children: ReactNode }) {
  return (
    <Card data-testid={testid} className="min-h-[220px] p-3">
      <p className="mb-2 text-sm font-medium text-foreground">{title}</p>
      <ul className="space-y-2">{children}</ul>
    </Card>
  );
}
