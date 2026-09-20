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
import { EVENT_TYPE_COLOR } from "../lib/colors";
import { EVENT_TYPE_LABEL, portLabel } from "../lib/eventSummary";
import { sanitizeDisplay } from "../lib/sanitize";
import type { EventType, StatsPayload } from "../types";

const QUIET = "rgba(232, 234, 237, 0.55)";
const SLICES = ["#00D4FF", "#FF4D4D", "#FFB800", "rgba(232,234,237,0.45)", "#33FF33", "#66E0FF", "#E8EAED"];
const tip = { background: "#0C0C14", border: "1px solid rgba(0,212,255,0.28)", fontSize: 12, color: "#E8EAED" };

export function StatsView({
  stats,
  typeCounts,
  eventType,
  onEventType,
}: {
  stats: StatsPayload | null;
  typeCounts: Record<string, number>;
  eventType: EventType | null;
  onEventType: (next: EventType | null) => void;
}) {
  if (!stats) {
    return (
      <p data-testid="stats-loading" className="p-6 pb-20 pt-16 text-sm text-hive-quiet">
        Loading stats
      </p>
    );
  }

  const byType = Object.fromEntries(stats.by_type.map((row) => [row.name, row.count]));
  const stacked = stats.over_time_by_type.length
    ? stats.over_time_by_type
    : stats.over_time.map((row) => ({ t: row.t, scan: row.count, login_attempt: 0, command: 0, payload: 0 }));

  return (
    <div data-testid="stats-view" className="absolute inset-0 overflow-auto bg-hive-bg p-4 pb-20 pl-[19.5rem] pr-4 pt-14">
      <div className="mb-3">
        <TypeFilter value={eventType} counts={typeCounts} onChange={onEventType} />
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
              <XAxis dataKey="t" tick={{ fill: QUIET, fontSize: 11 }} tickFormatter={(v) => String(v).slice(11, 16)} />
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
            <div data-testid="stats-lan-split" className="flex gap-3 text-xs text-hive-quiet">
              <span>
                Internet <span className="font-mono text-hive-ink">{stats.internet_count}</span>
              </span>
              <span>
                LAN <span className="font-mono text-hive-ink">{stats.lan_count}</span>
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
                <li key={row.name} className="flex items-center justify-between gap-2 text-hive-quiet">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: SLICES[i % SLICES.length] }} />
                    {sanitizeDisplay(row.name) || "unk"}
                  </span>
                  <span className="font-mono text-hive-ink">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
        <ListCard title="Top source IPs" testid="stats-top-ips">
          {stats.top_ips.map((row) => (
            <li key={row.name} className="flex justify-between gap-3 font-mono text-xs">
              <span className="truncate text-hive-ink">{sanitizeDisplay(row.name)}</span>
              <span className="text-hive-quiet">{row.count}</span>
            </li>
          ))}
        </ListCard>
        <ListCard title="Recent commands" testid="stats-commands">
          {stats.recent_commands.map((row, i) => (
            <li key={`${row.timestamp}-${i}`} className="text-xs">
              <span className="font-mono text-hive-quiet">
                {row.timestamp.slice(11, 19)} {sanitizeDisplay(row.src_ip)}
              </span>
              <p className="truncate text-hive-ink">{sanitizeDisplay(row.text)}</p>
            </li>
          ))}
        </ListCard>
        <ListCard title="Recent payloads" testid="stats-payloads">
          {stats.recent_payloads.map((row, i) => (
            <li key={`${row.timestamp}-${i}`} className="text-xs">
              <span className="font-mono text-hive-quiet">
                {row.timestamp.slice(11, 19)} {sanitizeDisplay(row.src_ip)}
              </span>
              <p className="truncate text-hive-ink">{sanitizeDisplay(row.text)}</p>
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
    <div data-testid={testid} className="rounded-card bg-hive-panel px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wide text-hive-quiet">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-hive-ink" style={color ? { color } : undefined}>
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-[11px] text-hive-quiet">{detail}</p> : null}
    </div>
  );
}

function ChartCard({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div data-testid="stats-card" className="flex min-h-[220px] flex-col rounded-card bg-hive-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-hive-ink">{title}</p>
        {extra}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function ListCard({ title, testid, children }: { title: string; testid: string; children: ReactNode }) {
  return (
    <div data-testid={testid} className="min-h-[220px] rounded-card bg-hive-panel p-3">
      <p className="mb-2 text-sm font-medium text-hive-ink">{title}</p>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}
