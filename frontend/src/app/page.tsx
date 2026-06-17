"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { api, type Performance, type Signal, type Strategy } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EquityChart } from "@/components/charts/equity-chart";
import {
  DollarSign,
  TrendingUp,
  Target,
  AlertTriangle,
  Activity,
  BarChart3,
} from "lucide-react";

export default function DashboardPage() {
  const { data: perf } = useApi<Performance>(api.getPerformance);
  const [equityData, setEquityData] = useState<{ date: string; equity: number }[]>([]);

  useEffect(() => {
    fetch("/api/trades/equity-history")
      .then((r) => r.json())
      .then((data) => setEquityData(data))
      .catch(() => {});
  }, []);
  const { data: strategies } = useApi<Strategy[]>(api.getStrategies);
  const { data: signals } = useApi<Signal[]>(() => api.getSignals("limit=10"));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de vos performances</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Profit Net"
          value={formatCurrency(perf?.net_profit ?? 0)}
          trend={perf && perf.net_profit >= 0 ? "up" : "down"}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Win Rate"
          value={formatPercent(perf?.win_rate ?? 0)}
          subtitle={`${perf?.winning_trades ?? 0}W / ${perf?.losing_trades ?? 0}L`}
          trend={perf && perf.win_rate >= 50 ? "up" : "down"}
          icon={<Target className="h-5 w-5" />}
        />
        <StatCard
          title="Profit Factor"
          value={(perf?.profit_factor ?? 0).toFixed(2)}
          trend={perf && perf.profit_factor >= 1 ? "up" : "down"}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Max Drawdown"
          value={formatPercent(-(perf?.max_drawdown ?? 0))}
          trend="down"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {/* Equity Chart */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Courbe d&apos;Equity
          </CardTitle>
        </div>
        <EquityChart data={equityData} />
      </Card>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Strategies actives */}
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Strategies Actives
          </CardTitle>
          {strategies && strategies.length > 0 ? (
            <div className="space-y-3">
              {strategies.map((s) => (
                <div
                  key={s.strategy_id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.symbols.join(", ")} | {s.timeframes.join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-success">
                      {formatCurrency(s.total_profit)}
                    </span>
                    <Badge variant={s.is_active ? "success" : "muted"}>
                      {s.is_active ? "ON" : "OFF"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune strategie configuree
            </p>
          )}
        </Card>

        {/* Signaux recents */}
        <Card>
          <CardTitle className="mb-4">Signaux Recents</CardTitle>
          {signals && signals.length > 0 ? (
            <div className="space-y-2">
              {signals.map((sig) => (
                <div
                  key={sig.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={sig.direction === "BUY" ? "success" : "danger"}>
                      {sig.direction}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{sig.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {sig.strategy_id} | {sig.timeframe}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      sig.status === "executed"
                        ? "success"
                        : sig.status === "rejected"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {sig.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun signal</p>
          )}
        </Card>
      </div>
    </div>
  );
}
