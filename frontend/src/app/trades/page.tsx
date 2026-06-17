"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { useWebSocket } from "@/hooks/use-websocket";
import { api, type Trade, type LivePosition } from "@/lib/api";
import { formatCurrency, formatDate, formatPrice } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { History, Wifi, WifiOff, X, Edit3, Radio, Wallet } from "lucide-react";

export default function TradesPage() {
  const [filter, setFilter] = useState<string>("all");
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [mt5History, setMt5History] = useState<Trade[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [editingTicket, setEditingTicket] = useState<number | null>(null);
  const [editSL, setEditSL] = useState<string>("");
  const [editTP, setEditTP] = useState<string>("");
  const [closingTicket, setClosingTicket] = useState<number | null>(null);
  const [showSignals, setShowSignals] = useState(false);
  const [signals, setSignals] = useState<any[]>([]);
  const [accountInfo, setAccountInfo] = useState<Record<string, unknown> | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const { isConnected, lastEvent } = useWebSocket();

  const handleClosePosition = async (ticket: number, volume?: number) => {
    setClosingTicket(ticket);
    try {
      const res = await fetch(`/api/trades/close-position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, volume }),
      });
      if (!res.ok) throw new Error("Close failed");
      // Wait for MT5 to process then refresh both positions and history
      setTimeout(() => {
        setClosingTicket(null);
        refreshAll();
      }, 3000);
    } catch (e) {
      console.error("Close position error:", e);
      setClosingTicket(null);
    }
  };

  const handleModifyPosition = async (ticket: number) => {
    try {
      const body: Record<string, number> = { ticket };
      if (editSL) body.stop_loss = parseFloat(editSL);
      if (editTP) body.take_profit = parseFloat(editTP);

      const res = await fetch(`/api/trades/modify-position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Modify failed");
      setEditingTicket(null);
      setEditSL("");
      setEditTP("");
    } catch (e) {
      console.error("Modify position error:", e);
    }
  };

  const startEditing = (pos: LivePosition) => {
    setEditingTicket(pos.ticket);
    setEditSL(pos.stop_loss > 0 ? pos.stop_loss.toString() : "");
    setEditTP(pos.take_profit > 0 ? pos.take_profit.toString() : "");
  };

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshAll = () => setRefreshTrigger((n) => n + 1);

  // Stable update: only setState if data actually changed
  const stableUpdate = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, newData: T) => {
    setter((prev) => JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData);
  };

  // Fetch MT5 trade history (all trades including manual)
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/trades/mt5-history`);
        if (res.ok) {
          const data = await res.json();
          stableUpdate(setMt5History, data);
        }
      } catch {}
      setHistoryLoading(false);
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  const trades = mt5History.filter((t: any) => {
    if (filter === "all") return true;
    return t.status === filter;
  });
  const loading = historyLoading;

  // Fetch account info
  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const res = await fetch("/api/mt5/account");
        if (res.ok) setAccountInfo(await res.json());
      } catch {}
    };
    fetchAccount();
    const interval = setInterval(fetchAccount, 5000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  // Fetch live positions from MT5
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await fetch(`/api/trades/positions`);
        if (res.ok) {
          const data = await res.json();
          const mapped = data.map((p: any) => ({
            ticket: p.ticket ?? 0,
            symbol: p.symbol ?? "",
            direction: p.type || p.direction || "BUY",
            volume: p.volume ?? 0,
            entry_price: p.open_price ?? p.entry_price ?? 0,
            current_price: p.current_price ?? p.open_price ?? p.entry_price ?? 0,
            stop_loss: p.sl ?? p.stop_loss ?? 0,
            take_profit: p.tp ?? p.take_profit ?? 0,
            profit: p.profit ?? 0,
            swap: p.swap ?? 0,
            open_time: p.open_time || new Date().toISOString(),
            strategy_id: p.source === "manual" ? "Manual" : (p.comment || "bot"),
          }));
          stableUpdate(setPositions, mapped);
        }
      } catch {}
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 3000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  // Fetch signals when toggled on (no auto-refresh to avoid page jumps)
  useEffect(() => {
    if (!showSignals) return;
    const fetchSignals = async () => {
      setSignalsLoading(true);
      try {
        const res = await fetch("/api/signals/?limit=100");
        if (res.ok) {
          const data = await res.json();
          stableUpdate(setSignals, data);
        }
      } catch {}
      setSignalsLoading(false);
    };
    fetchSignals();
  }, [showSignals, refreshTrigger]);

  // Also update from WebSocket
  useEffect(() => {
    if (lastEvent?.type === "positions_update" && lastEvent.data) {
      setPositions(lastEvent.data);
    }
    if (lastEvent?.type === "position_update" && lastEvent.data) {
      setPositions((prev) =>
        prev.map((p) =>
          p.ticket === lastEvent.data.ticket ? { ...p, ...lastEvent.data } : p
        )
      );
    }
  }, [lastEvent]);

  const totalFloatingPnl = positions.reduce((sum, p) => sum + p.profit, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Historique des Trades</h1>
        <p className="text-muted-foreground">
          Tous vos trades passes et en cours
        </p>
      </div>

      {/* Account Info */}
      {accountInfo && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-lg font-bold">{formatCurrency(Number(accountInfo.balance))}</p>
          </div>
          <div className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">Equity</p>
            <p className={`text-lg font-bold ${Number(accountInfo.equity) >= Number(accountInfo.balance) ? "text-success" : "text-danger"}`}>
              {formatCurrency(Number(accountInfo.equity))}
            </p>
          </div>
          <div className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">P&L Flottant</p>
            <p className={`text-lg font-bold ${Number(accountInfo.profit) >= 0 ? "text-success" : "text-danger"}`}>
              {Number(accountInfo.profit) >= 0 ? "+" : ""}{formatCurrency(Number(accountInfo.profit))}
            </p>
          </div>
          <div className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">Marge Utilisee</p>
            <p className="text-lg font-bold">{formatCurrency(Number(accountInfo.margin))}</p>
          </div>
          <div className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">Marge Libre</p>
            <p className="text-lg font-bold">{formatCurrency(Number(accountInfo.free_margin))}</p>
          </div>
          <div className="rounded-xl bg-card border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">Levier</p>
            <p className="text-lg font-bold">1:{String(accountInfo.leverage)}</p>
          </div>
        </div>
      )}

      {/* Live Positions Section */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold text-foreground">
              Positions Live ({positions.length})
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi className="h-3.5 w-3.5 text-success" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-danger" />
              )}
              <span className="text-xs text-muted-foreground">
                {isConnected ? "Connecte" : "Deconnecte"}
              </span>
            </div>
          </div>
          <div className={`text-lg font-bold ${totalFloatingPnl >= 0 ? "text-success" : "text-danger"}`}>
            P&L: {formatCurrency(totalFloatingPnl)}
          </div>
        </div>

        {positions.length > 0 ? (
          <div className="space-y-2">
            {positions.map((pos) => (
              <div key={pos.ticket} className="rounded-lg bg-muted/50 px-4 py-3">
                {/* Row 1: Symbol, direction, P&L, actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={pos.direction === "BUY" ? "success" : "danger"}>
                      {pos.direction}
                    </Badge>
                    <span className="text-sm font-medium">{pos.symbol}</span>
                    <span className="text-xs text-muted-foreground">x{pos.volume}</span>
                    <span className="text-xs text-muted-foreground">#{pos.ticket}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`text-sm font-bold ${
                        pos.profit >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {formatCurrency(pos.profit)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          editingTicket === pos.ticket
                            ? setEditingTicket(null)
                            : startEditing(pos)
                        }
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          editingTicket === pos.ticket
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        SL/TP
                      </button>
                      {pos.volume > 0.01 && (
                        <button
                          onClick={() => handleClosePosition(pos.ticket, pos.volume / 2)}
                          className="rounded bg-muted px-2 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/20"
                        >
                          50%
                        </button>
                      )}
                      <button
                        onClick={() => handleClosePosition(pos.ticket)}
                        disabled={closingTicket === pos.ticket}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          closingTicket === pos.ticket
                            ? "animate-pulse bg-danger/20 text-danger"
                            : "bg-danger/10 text-danger hover:bg-danger/20"
                        }`}
                      >
                        {closingTicket === pos.ticket ? "..." : "Fermer"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Details */}
                <div className="mt-2 flex items-center gap-6 text-xs text-muted-foreground">
                  <span>Entree: <span className="text-foreground">{formatPrice(pos.entry_price)}</span></span>
                  <span>Actuel: <span className="text-foreground">{formatPrice(pos.current_price)}</span></span>
                  <span>SL: <span className="text-danger">{pos.stop_loss > 0 ? formatPrice(pos.stop_loss) : "—"}</span></span>
                  <span>TP: <span className="text-success">{pos.take_profit > 0 ? formatPrice(pos.take_profit) : "—"}</span></span>
                  {pos.swap !== 0 && <span>Swap: {formatCurrency(pos.swap)}</span>}
                  <span>{pos.strategy_id}</span>
                </div>

                {/* Edit SL/TP panel */}
                {editingTicket === pos.ticket && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                    <label className="text-xs text-muted-foreground">SL:</label>
                    <input
                      type="number"
                      step="any"
                      value={editSL}
                      onChange={(e) => setEditSL(e.target.value)}
                      placeholder={pos.stop_loss > 0 ? pos.stop_loss.toString() : "0"}
                      className="w-28 rounded bg-background px-2 py-1 text-sm border border-border focus:border-primary focus:outline-none"
                    />
                    <label className="text-xs text-muted-foreground">TP:</label>
                    <input
                      type="number"
                      step="any"
                      value={editTP}
                      onChange={(e) => setEditTP(e.target.value)}
                      placeholder={pos.take_profit > 0 ? pos.take_profit.toString() : "0"}
                      className="w-28 rounded bg-background px-2 py-1 text-sm border border-border focus:border-primary focus:outline-none"
                    />
                    <button
                      onClick={() => handleModifyPosition(pos.ticket)}
                      className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80"
                    >
                      Appliquer
                    </button>
                    <button
                      onClick={() => { setEditingTicket(null); setEditSL(""); setEditTP(""); }}
                      className="rounded px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-6">
            Aucune position ouverte
          </p>
        )}
      </Card>

      {/* Filters + Signals toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["all", "open", "closed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Tous" : f === "open" ? "Ouvertes" : "Fermees"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowSignals(!showSignals)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
            showSignals
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="h-4 w-4" />
          {showSignals ? "Masquer Signaux" : "Voir Signaux"}
        </button>
      </div>

      {/* Signals Panel */}
      {showSignals && (
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            Signaux Recus ({signals.length})
          </CardTitle>
          {signalsLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : signals.length > 0 ? (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {signals.map((sig: any) => {
                const statusColor = sig.status === "executed"
                  ? "success"
                  : sig.status === "pending"
                  ? "warning"
                  : "danger";
                return (
                  <div
                    key={sig.id}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      sig.status === "executed"
                        ? "border-success/20 bg-success/5"
                        : sig.status === "rejected"
                        ? "border-danger/20 bg-danger/5"
                        : "border-warning/20 bg-warning/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={statusColor}>
                        {sig.status === "executed" ? "Execute" : sig.status === "pending" ? "En attente" : "Rejete"}
                      </Badge>
                      <Badge variant={sig.direction === "BUY" ? "success" : "danger"}>
                        {sig.direction}
                      </Badge>
                      <span className="text-sm font-medium">{sig.symbol}</span>
                      <span className="text-xs text-muted-foreground">x{sig.lot_size}</span>
                      {sig.executed_ticket && (
                        <span className="text-xs text-muted-foreground">→ #{sig.executed_ticket}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{sig.strategy_id}</span>
                      <span>{sig.timeframe}</span>
                      <span>{new Date(sig.timestamp).toLocaleString("fr-FR")}</span>
                      {sig.rejection_reason && (
                        <span className="max-w-48 truncate text-danger" title={sig.rejection_reason}>
                          {sig.rejection_reason}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucun signal recu
            </p>
          )}
        </Card>
      )}

      {loading ? (
        <Card><p className="text-muted-foreground">Chargement...</p></Card>
      ) : trades && trades.length > 0 ? (
        <div className="space-y-3">
          {trades.map((trade: any) => {
            const closes = trade.comment?.includes("Close ") ? trade.comment.split(" | ") : null;
            const isWin = trade.profit >= 0;
            return (
              <div
                key={trade.id}
                className={`rounded-xl border px-5 py-4 ${
                  isWin ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5"
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={trade.direction === "BUY" ? "success" : "danger"}>
                      {trade.direction}
                    </Badge>
                    <span className="text-sm font-semibold">{trade.symbol}</span>
                    <span className="text-xs text-muted-foreground">x{trade.volume}</span>
                    {closes && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {closes.length} clotures partielles
                      </span>
                    )}
                  </div>
                  <span className={`text-lg font-bold ${isWin ? "text-success" : "text-danger"}`}>
                    {isWin ? "+" : ""}{formatCurrency(trade.profit)}
                  </span>
                </div>

                {/* Details row */}
                <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>Entree: <span className="text-foreground">{formatPrice(trade.entry_price)}</span></span>
                  <span>Sortie: <span className="text-foreground">{trade.exit_price ? formatPrice(trade.exit_price) : "—"}{closes ? " (moy.)" : ""}</span></span>
                  {trade.swap !== 0 && <span>Swap: {formatCurrency(trade.swap)}</span>}
                  {trade.commission !== 0 && <span>Com: {formatCurrency(trade.commission)}</span>}
                  <span>{trade.strategy_id}</span>
                </div>

                {/* Dates */}
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                  <span>Ouvert: {formatDate(trade.open_time)}</span>
                  {trade.close_time && <span>Ferme: {formatDate(trade.close_time)}</span>}
                </div>

                {/* Partial closes timeline */}
                {closes && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Detail des clotures
                    </p>
                    <div className="space-y-1.5">
                      {closes.map((c: string, i: number) => {
                        const profitMatch = c.match(/= ([+-]?[\d.]+)\$/);
                        const volMatch = c.match(/Close \d+: ([\d.]+) lot/);
                        const priceMatch = c.match(/@ ([\d.]+)/);
                        const timeMatch = c.match(/\(([^)]+)\)/);
                        const profit = profitMatch ? parseFloat(profitMatch[1]) : 0;
                        const pIsWin = profit >= 0;
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                                pIsWin ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                              }`}>
                                {i + 1}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {volMatch?.[1]} lot @ <span className="text-foreground">{priceMatch?.[1]}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-muted-foreground">{timeMatch?.[1]}</span>
                              <span className={`text-xs font-semibold ${pIsWin ? "text-success" : "text-danger"}`}>
                                {pIsWin ? "+" : ""}{profit}$
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <History className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">Aucun trade</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Les trades apparaitront ici une fois que le bot sera en marche.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
