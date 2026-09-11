import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import type { StatsPayload } from "../types";

const BLUE = "#00D4FF";
const QUIET = "rgba(232, 234, 237, 0.55)";
const SLICES = ["#00D4FF", "#FF4D4D", "rgba(232,234,237,0.45)", "#E8EAED", "#33FF33", "#FFB800", "#0C0C14", "#66E0FF"];

export function StatsView({ stats }: { stats: StatsPayload | null }) {
  if (!stats) {
    return (
      <p data-testid="stats-loading" className="p-6 pb-20 pt-16 text-sm text-hive-quiet">
        Loading stats
      </p>
    );
  }

  return (
    <div data-testid="stats-view" className="absolute inset-0 grid grid-cols-1 gap-3 overflow-auto bg-hive-bg p-4 pb-20 pl-[19.5rem] pr-4 pt-14 lg:grid-cols-2">
      <ChartCard title="Events over time">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.over_time}>
            <CartesianGrid stroke="rgba(59,130,246,0.12)" />
            <XAxis dataKey="t" tick={{ fill: QUIET, fontSize: 11 }} tickFormatter={(v) => String(v).slice(11, 16)} />
            <YAxis tick={{ fill: QUIET, fontSize: 11 }} />
            <Tooltip contentStyle={tip} />
            <Line type="monotone" dataKey="count" stroke={BLUE} dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Top countries">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.top_countries} layout="vertical">
            <CartesianGrid stroke="rgba(59,130,246,0.12)" />
            <XAxis type="number" tick={{ fill: QUIET, fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={48} tick={{ fill: QUIET, fontSize: 11 }} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="count" fill={BLUE} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Top ports">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.top_ports.map((p) => ({ name: String(p.port), count: p.count }))}>
            <CartesianGrid stroke="rgba(59,130,246,0.12)" />
            <XAxis dataKey="name" tick={{ fill: QUIET, fontSize: 11 }} />
            <YAxis tick={{ fill: QUIET, fontSize: 11 }} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="count" fill="#EF4444" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Protocols">
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
      </ChartCard>
    </div>
  );
}

const tip = { background: "#0C0C14", border: "1px solid rgba(0,212,255,0.28)", fontSize: 12, color: "#E8EAED" };

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div data-testid="stats-card" className="flex min-h-[220px] flex-col rounded-card bg-hive-panel p-3">
      <p className="mb-2 text-sm font-medium text-hive-ink">{title}</p>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
