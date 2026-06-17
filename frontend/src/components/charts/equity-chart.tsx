"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface EquityChartProps {
  data: { date: string; equity: number }[];
}

export function EquityChart({ data }: EquityChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        Pas de données disponibles
      </div>
    );
  }

  const isPositive = data[data.length - 1]?.equity >= data[0]?.equity;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={isPositive ? "#10b981" : "#ef4444"}
              stopOpacity={0.3}
            />
            <stop
              offset="100%"
              stopColor={isPositive ? "#10b981" : "#ef4444"}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis
          dataKey="date"
          stroke="#9ca3af"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#9ca3af"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v.toLocaleString()}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#111118",
            border: "1px solid #1e1e2e",
            borderRadius: "8px",
            color: "#e5e7eb",
          }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, "Equity"]}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={isPositive ? "#10b981" : "#ef4444"}
          fill="url(#equityGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
