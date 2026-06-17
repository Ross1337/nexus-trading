"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { api, type Performance } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EquityChart } from "@/components/charts/equity-chart";
import { PnlBarChart } from "@/components/charts/pnl-bar-chart";
import {
  DollarSign,
  Target,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
} from "lucide-react";

export default function AnalyticsPage() {
  const { data: perf } = useApi<Performance>(api.getPerformance);
  const [equityData, setEquityData] = useState<{ date: string; equity: number }[]>([]);
  const [pnlData, setPnlData] = useState<{ date: string; pnl: number }[]>([]);

  useEffect(() => {
    fetch("/api/trades/equity-history")
      .then((r) => r.json())
      .then((data) => setEquityData(data))
      .catch(() => {});
    fetch("/api/trades/daily-pnl")
      .then((r) => r.json())
      .then((data) => setPnlData(data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Analyse detaillee de vos performances</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Profit Net"
          value={formatCurrency(perf?.net_profit ?? 0)}
          trend={perf && perf.net_profit >= 0 ? "up" : "down"}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Total Trades"
          value={String(perf?.total_trades ?? 0)}
          subtitle={`${perf?.winning_trades ?? 0} gagnants | ${perf?.losing_trades ?? 0} perdants`}
          icon={<Target className="h-5 w-5" />}
        />
        <StatCard
          title="Win Rate"
          value={formatPercent(perf?.win_rate ?? 0)}
          trend={perf && perf.win_rate >= 50 ? "up" : "down"}
          icon={<Award className="h-5 w-5" />}
        />
        <StatCard
          title="Profit Factor"
          value={(perf?.profit_factor ?? 0).toFixed(2)}
          trend={perf && perf.profit_factor >= 1 ? "up" : "down"}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Meilleur Trade"
          value={formatCurrency(perf?.best_trade ?? 0)}
          trend="up"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Pire Trade"
          value={formatCurrency(perf?.worst_trade ?? 0)}
          trend="down"
          icon={<TrendingDown className="h-5 w-5" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle className="mb-4">Courbe d&apos;Equity</CardTitle>
          <EquityChart data={equityData} />
        </Card>
        <Card>
          <CardTitle className="mb-4">P&L Journalier</CardTitle>
          <PnlBarChart data={pnlData} />
        </Card>
      </div>

      {/* Detailed stats */}
      <Card>
        <CardTitle className="mb-4">Statistiques Detaillees</CardTitle>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Gain moyen" value={formatCurrency(perf?.avg_win ?? 0)} color="text-success" />
          <Stat label="Perte moyenne" value={formatCurrency(perf?.avg_loss ?? 0)} color="text-danger" />
          <Stat label="Total gains" value={formatCurrency(perf?.total_profit ?? 0)} color="text-success" />
          <Stat label="Total pertes" value={formatCurrency(perf?.total_loss ?? 0)} color="text-danger" />
          <Stat label="Max Drawdown" value={formatPercent(-(perf?.max_drawdown ?? 0))} color="text-danger" />
          <Stat label="Positions ouvertes" value={String(perf?.open_positions ?? 0)} />
          <Stat
            label="P&L flottant"
            value={formatCurrency(perf?.floating_pnl ?? 0)}
            color={perf && perf.floating_pnl >= 0 ? "text-success" : "text-danger"}
          />
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color ?? ""}`}>{value}</p>
    </div>
  );
}
