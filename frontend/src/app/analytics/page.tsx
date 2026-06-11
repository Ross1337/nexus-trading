"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const COLORS = ["#00D4FF", "#00FF88", "#FF4466", "#FFB800", "#8B5CF6", "#F97316"];

export default function AnalyticsPage() {
  const [equity, setEquity] = useState<unknown[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [byStrategy, setByStrategy] = useState<unknown[]>([]);

  useEffect(() => {
    api.equityCurve().then(setEquity).catch(() => {});
    api.performanceSummary().then(setSummary).catch(() => {});
    api.performanceByStrategy().then(setByStrategy).catch(() => {});
  }, []);

  const pieData = [
    { name: "Wins", value: Number(summary.wins || 0) },
    { name: "Losses", value: Number(summary.losses || 0) },
  ];

  return (
    <DashboardLayout>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Analytics</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <Stat label="Total trades" value={String(summary.total_trades || 0)} />
        <Stat label="Win rate" value={`${summary.winrate || 0}%`} color="#00D4FF" />
        <Stat label="Profit Factor" value={String(summary.profit_factor || 0)} color="#00FF88" />
        <Stat label="Total P&L" value={`${Number(summary.total_profit || 0).toFixed(2)}$`}
          color={Number(summary.total_profit) >= 0 ? "#00FF88" : "#FF4466"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card card-glow">
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#6B7A9A", marginBottom: 16 }}>COURBE EQUITY</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={equity as { equity: number }[]}>
              <defs>
                <linearGradient id="eg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#0D1421", border: "1px solid #1A2540", borderRadius: 8 }} />
              <Area type="monotone" dataKey="equity" stroke="#00D4FF" fill="url(#eg2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#6B7A9A", marginBottom: 16 }}>WINS / LOSSES</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0D1421", border: "1px solid #1A2540", borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#6B7A9A", marginBottom: 16 }}>PAR STRATÉGIE</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byStrategy as { strategy_id: number; profit: number; trades: number }[]}>
            <XAxis dataKey="strategy_id" stroke="#6B7A9A" />
            <YAxis stroke="#6B7A9A" />
            <Tooltip contentStyle={{ background: "#0D1421", border: "1px solid #1A2540", borderRadius: 8 }} />
            <Bar dataKey="profit" fill="#00D4FF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value, color = "#E8EDF5" }: { label: string; value: string; color?: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: "0.75rem", color: "#6B7A9A", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: "1.3rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
