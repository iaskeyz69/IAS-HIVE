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

const GOLD = "#38BDF8";
const MUTED = "#7B8A9E";
const SLICES = ["#38BDF8", "#FF3B3B", "#3DFF8A", "#0EA5E9", "#0369A1", "#7B8A9E", "#E8E6DF", "#1D4ED8"];

export function StatsView({ stats }: { stats: StatsPayload | null }) {
  if (!stats) {
    return <p className="p-6 font-mono text-xs text-hive-muted">LOADING STATS…</p>;
  }

  return (
    <div className="absolute inset-0 grid grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-2">
      <ChartCard title="EVENTS OVER TIME">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.over_time}>
            <CartesianGrid stroke="rgba(56,189,248,0.12)" />
            <XAxis dataKey="t" tick={{ fill: MUTED, fontSize: 9 }} tickFormatter={(v) => String(v).slice(11, 16)} />
            <YAxis tick={{ fill: MUTED, fontSize: 9 }} />
            <Tooltip contentStyle={tip} />
            <Line type="monotone" dataKey="count" stroke={GOLD} dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="TOP COUNTRIES">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.top_countries} layout="vertical">
            <CartesianGrid stroke="rgba(56,189,248,0.12)" />
            <XAxis type="number" tick={{ fill: MUTED, fontSize: 9 }} />
            <YAxis type="category" dataKey="name" width={40} tick={{ fill: MUTED, fontSize: 10 }} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="count" fill={GOLD} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="TOP PORTS">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.top_ports.map((p) => ({ name: String(p.port), count: p.count }))}>
            <CartesianGrid stroke="rgba(56,189,248,0.12)" />
            <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 10 }} />
            <YAxis tick={{ fill: MUTED, fontSize: 9 }} />
            <Tooltip contentStyle={tip} />
            <Bar dataKey="count" fill="#FF3B3B" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="PROTOCOL">
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

const tip = { background: "#0A1220", border: "1px solid #38BDF8", fontSize: 11, color: "#E8E6DF" };

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="hud-corners flex min-h-[220px] flex-col border border-hive-line bg-hive-panel p-2">
      <span className="c-br" />
      <span className="c-bl" />
      <p className="label-hud mb-1 px-1 text-hive-gold">{title}</p>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
