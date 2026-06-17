"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
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
import { Bug, Wifi, WifiOff, Send, X, Edit3, RefreshCw, Zap, History, Power, Download, RotateCcw, Copy, Check, Trash2 } from "lucide-react";

interface LogEntry {
  time: string;
  type: "request" | "response" | "error" | "info";
  message: string;
}

interface Position {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  open_price: number;
  current_price: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  open_time: string;
}

export default function DebugPage() {
  const { isConnected: wsConnected } = useWebSocket();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Status
  const [apiStatus, setApiStatus] = useState<"ok" | "error" | "loading">("loading");
  const [mt5Status, setMt5Status] = useState<"ok" | "error" | "loading">("loading");
  const [accountInfo, setAccountInfo] = useState<Record<string, unknown> | null>(null);

  // Positions
  const [positions, setPositions] = useState<Position[]>([]);
  const [editingTicket, setEditingTicket] = useState<number | null>(null);
  const [editSL, setEditSL] = useState("");
  const [editTP, setEditTP] = useState("");

  // Strategies & plans
  const [strategies, setStrategies] = useState<any[]>([]);
  const [strategyPlans, setStrategyPlans] = useState<Record<string, boolean>>({});

  // Order form
  const [orderSymbol, setOrderSymbol] = useState("EURUSD+");
  const [orderDirection, setOrderDirection] = useState("BUY");
  const [orderVolume, setOrderVolume] = useState("0.01");
  const [orderSL, setOrderSL] = useState("");
  const [orderTP, setOrderTP] = useState("");
  const [orderStrategy, setOrderStrategy] = useState("");
  const [orderBypass, setOrderBypass] = useState(false);

  // Webhook form
  const [whSymbol, setWhSymbol] = useState("EURUSD+");
  const [whDirection, setWhDirection] = useState("BUY");
  const [whLotSize, setWhLotSize] = useState("0.01");
  const [whRiskPercent, setWhRiskPercent] = useState("1");
  const [whSL, setWhSL] = useState("");
  const [whTP, setWhTP] = useState("");
  const [whStrategyId, setWhStrategyId] = useState("");
  const [whBypass, setWhBypass] = useState(false);

  // Trade history
  const [tradeHistory, setTradeHistory] = useState<unknown[]>([]);

  // Restart
  const [restarting, setRestarting] = useState<string | null>(null);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  const handleCopyLogs = useCallback(async () => {
    if (logs.length === 0) return;
    const text = logs
      .map((l) => `[${l.time}] ${l.type.toUpperCase()} ${l.message}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [logs]);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [
      ...prev.slice(-99),
      { time: new Date().toLocaleTimeString(), type, message },
    ]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Check statuses
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { signal: AbortSignal.timeout(3000) });
      setApiStatus(res.ok ? "ok" : "error");
    } catch {
      setApiStatus("error");
    }

    try {
      const res = await fetch("/api/mt5/account", { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        setMt5Status("ok");
        setAccountInfo(data);
      } else {
        setMt5Status("error");
        setAccountInfo(null);
      }
    } catch {
      setMt5Status("error");
      setAccountInfo(null);
    }
  }, []);

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/trades/positions");
      if (res.ok) {
        const data = await res.json();
        setPositions(data);
      }
    } catch {}
  }, []);

  // Fetch trade history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/trades/history?limit=20");
      if (res.ok) {
        const data = await res.json();
        setTradeHistory(data);
      }
    } catch {}
  }, []);

  // Fetch strategies and their plans
  const fetchStrategies = useCallback(async () => {
    try {
      const res = await fetch("/api/strategies/");
      if (res.ok) {
        const data = await res.json();
        setStrategies(data);
        // Check which have plans
        const planStatus: Record<string, boolean> = {};
        for (const s of data) {
          try {
            const pRes = await fetch(`/api/strategies/${s.strategy_id}/trading-plan`);
            planStatus[s.strategy_id] = pRes.ok && (await pRes.json()) !== null;
          } catch { planStatus[s.strategy_id] = false; }
        }
        setStrategyPlans(planStatus);
      }
    } catch {}
  }, []);

  // Initial load + refresh
  useEffect(() => {
    checkStatus();
    fetchPositions();
    fetchHistory();
    fetchStrategies();
    const interval = setInterval(() => {
      fetchPositions();
    }, 3000);
    return () => clearInterval(interval);
  }, [checkStatus, fetchPositions, fetchHistory, fetchStrategies]);

  // Check if strategy is valid (has plan) + SL required
  const hasOrderSL = orderSL !== "" && parseFloat(orderSL) > 0;
  const canSendOrder = hasOrderSL && (orderBypass || (orderStrategy && strategyPlans[orderStrategy]));
  const hasWhSL = whSL !== "" && parseFloat(whSL) > 0;
  const canSendWebhook = hasWhSL && (whBypass || (whStrategyId && strategyPlans[whStrategyId]));

  // Execute order
  const handleExecuteOrder = async () => {
    if (!orderSL || parseFloat(orderSL) <= 0) { addLog("error", "Stop loss obligatoire"); return; }
    if (!orderBypass && !orderStrategy) { addLog("error", "Selectionnez une strategie"); return; }
    if (!orderBypass && !strategyPlans[orderStrategy]) { addLog("error", `Strategie "${orderStrategy}" n'a pas de plan de trading`); return; }
    const payload = {
      symbol: orderSymbol,
      direction: orderDirection,
      volume: parseFloat(orderVolume),
      stop_loss: orderSL ? parseFloat(orderSL) : 0,
      take_profit: orderTP ? parseFloat(orderTP) : 0,
      comment: orderBypass ? "Debug bypass" : `Strategy: ${orderStrategy}`,
    };
    addLog("request", `POST /api/orders/ → ${JSON.stringify(payload)}`);

    try {
      const res = await fetch("/api/orders/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      addLog(res.ok ? "response" : "error", JSON.stringify(data));
      fetchPositions();
    } catch (e) {
      addLog("error", `${e}`);
    }
  };

  // Send test webhook (format PineConnector)
  const handleSendWebhook = async () => {
    if (!whSL || parseFloat(whSL) <= 0) { addLog("error", "Stop loss obligatoire"); return; }
    if (!whBypass && !whStrategyId) { addLog("error", "Selectionnez une strategie"); return; }
    if (!whBypass && !strategyPlans[whStrategyId]) { addLog("error", `Strategie "${whStrategyId}" n'a pas de plan de trading`); return; }

    // License = bypass loopback OK, n'importe quoi marche
    const license = "DEBUG_PANEL";
    const command = whDirection === "BUY" ? "buy" : "sell";

    // Symbol sans suffixe (le serveur l'ajoute via MT5_SYMBOL_SUFFIX)
    const cleanSymbol = whSymbol.replace(/\+$/, "");

    // Build PineConnector CSV format
    const params: string[] = [];
    if (whSL) params.push(`sl=${whSL}`);
    if (whTP && parseFloat(whTP) > 0) params.push(`tp=${whTP}`);
    if (whLotSize) params.push(`vol_lots=${whLotSize}`);
    if (whRiskPercent) params.push(`risk=${whRiskPercent}`);
    params.push(`comment=Debug`);

    const body = [license, command, cleanSymbol, ...params].join(",");
    addLog("request", `POST /api/webhook/tradingview → ${body}`);

    try {
      const res = await fetch("/api/webhook/tradingview", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body,
      });
      const data = await res.json();
      addLog(res.ok ? "response" : "error", JSON.stringify(data));
      fetchHistory();
    } catch (e) {
      addLog("error", `${e}`);
    }
  };

  // Close position
  const handleClose = async (ticket: number) => {
    addLog("request", `POST /api/trades/close-position → ticket=${ticket}`);
    try {
      const res = await fetch("/api/trades/close-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      const data = await res.json();
      addLog(res.ok ? "response" : "error", JSON.stringify(data));
      setTimeout(fetchPositions, 1000);
    } catch (e) {
      addLog("error", `${e}`);
    }
  };

  // Partial close
  const handlePartialClose = async (ticket: number, volume: number) => {
    const closeVol = Math.round(volume / 2 * 100) / 100;
    addLog("request", `POST /api/trades/close-position → ticket=${ticket}, volume=${closeVol}`);
    try {
      const res = await fetch("/api/trades/close-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, volume: closeVol }),
      });
      const data = await res.json();
      addLog(res.ok ? "response" : "error", JSON.stringify(data));
      setTimeout(fetchPositions, 1000);
    } catch (e) {
      addLog("error", `${e}`);
    }
  };

  // Modify position
  const handleModify = async (ticket: number) => {
    const payload: Record<string, unknown> = { ticket };
    if (editSL) payload.stop_loss = parseFloat(editSL);
    if (editTP) payload.take_profit = parseFloat(editTP);
    addLog("request", `POST /api/trades/modify-position → ${JSON.stringify(payload)}`);
    try {
      const res = await fetch("/api/trades/modify-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      addLog(res.ok ? "response" : "error", JSON.stringify(data));
      setEditingTicket(null);
      setEditSL("");
      setEditTP("");
      setTimeout(fetchPositions, 1000);
    } catch (e) {
      addLog("error", `${e}`);
    }
  };

  // Restart service
  const handleRestart = async (service: "mt5-connector" | "api" | "all") => {
    setRestarting(service);
    addLog("request", `POST /api/debug/restart/${service}`);
    try {
      const res = await fetch(`/api/debug/restart/${service}`, { method: "POST" });
      const data = await res.json();
      addLog(data.success ? "response" : "error", JSON.stringify(data));
      if (data.success) {
        setTimeout(() => {
          checkStatus();
          fetchPositions();
        }, 3000);
      }
    } catch (e) {
      addLog("error", `${e}`);
    }
    setRestarting(null);
  };

  // Export logs
  const handleExportLogs = () => {
    // Export console logs from the page
    const logText = logs
      .map((l) => `[${l.time}] ${l.type.toUpperCase()} ${l.message}`)
      .join("\n");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trading-bot-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("info", "Logs exported");
  };

  // Export full logs from API
  const handleExportServerLogs = async () => {
    addLog("request", "GET /api/debug/logs/export");
    try {
      const res = await fetch("/api/debug/logs/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trading-bot-server-logs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog("response", "Server logs exported");
    } catch (e) {
      addLog("error", `${e}`);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "ok") return <Badge variant="success">OK</Badge>;
    if (status === "loading") return <Badge variant="muted">...</Badge>;
    return <Badge variant="danger">ERREUR</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bug className="h-6 w-6" />
            Debug &amp; Tests
          </h1>
          <p className="text-muted-foreground">
            Tester le pipeline API → MT5 Connector
          </p>
        </div>
        <button
          onClick={() => { checkStatus(); fetchPositions(); fetchHistory(); }}
          className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm hover:bg-muted/80"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Section 1: Status */}
      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          {wsConnected ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-danger" />}
          Statut Connexion
        </CardTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">API Backend</span>
              {statusBadge(apiStatus)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">localhost:8000</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">MT5 Connector</span>
              {statusBadge(mt5Status)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">localhost:5001</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">WebSocket</span>
              {wsConnected ? <Badge variant="success">Connecte</Badge> : <Badge variant="danger">Deconnecte</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">/ws/live</p>
          </div>
        </div>
        {accountInfo && (
          <div className="mt-4 rounded-lg border border-border p-4">
            <p className="text-sm">
              <span className="font-medium">Compte:</span> {String(accountInfo.login)} ({String(accountInfo.server)})
              {" | "}
              <span className="font-medium">Balance:</span> ${Number(accountInfo.balance).toFixed(2)}
              {" | "}
              <span className="font-medium">Equity:</span> ${Number(accountInfo.equity).toFixed(2)}
              {" | "}
              <span className="font-medium">Marge libre:</span> ${Number(accountInfo.free_margin).toFixed(2)}
              {" | "}
              <span className="font-medium">Levier:</span> 1:{String(accountInfo.leverage)}
            </p>
          </div>
        )}
      </Card>

      {/* Section 1b: Restart & Logs */}
      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          <Power className="h-4 w-4" />
          Gestion Services
        </CardTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => handleRestart("mt5-connector")}
            disabled={restarting !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-warning/20 px-4 py-3 text-sm font-medium text-warning hover:bg-warning/30 disabled:opacity-50"
          >
            <RotateCcw className={`h-4 w-4 ${restarting === "mt5-connector" ? "animate-spin" : ""}`} />
            {restarting === "mt5-connector" ? "Redemarrage..." : "Restart MT5 Connector"}
          </button>
          <button
            onClick={() => handleRestart("api")}
            disabled={restarting !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary/20 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/30 disabled:opacity-50"
          >
            <RotateCcw className={`h-4 w-4 ${restarting === "api" ? "animate-spin" : ""}`} />
            {restarting === "api" ? "Redemarrage..." : "Restart API"}
          </button>
          <button
            onClick={() => handleRestart("all")}
            disabled={restarting !== null}
            className="flex items-center justify-center gap-2 rounded-lg bg-danger/20 px-4 py-3 text-sm font-medium text-danger hover:bg-danger/30 disabled:opacity-50"
          >
            <RotateCcw className={`h-4 w-4 ${restarting === "all" ? "animate-spin" : ""}`} />
            {restarting === "all" ? "Redemarrage..." : "Restart Tout"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleExportLogs}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm hover:bg-muted/80"
            >
              <Download className="h-4 w-4" />
              Logs Console
            </button>
            <button
              onClick={handleExportServerLogs}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm hover:bg-muted/80"
            >
              <Download className="h-4 w-4" />
              Logs Serveur
            </button>
          </div>
        </div>
      </Card>

      {/* Section 2: Live Positions */}
      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Positions Live ({positions.length})
        </CardTitle>
        {positions.length > 0 ? (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Symbole</TableHead>
                <TableHead>Dir</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>SL</TableHead>
                <TableHead>TP</TableHead>
                <TableHead>P&amp;L</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((pos) => (
                <TableRow key={pos.ticket}>
                  <TableCell className="font-mono text-xs">{pos.ticket}</TableCell>
                  <TableCell className="font-medium">{pos.symbol}</TableCell>
                  <TableCell>
                    <Badge variant={pos.type === "BUY" ? "success" : "danger"}>{pos.type}</Badge>
                  </TableCell>
                  <TableCell>{pos.volume}</TableCell>
                  <TableCell className="font-mono text-xs">{pos.open_price}</TableCell>
                  <TableCell className="font-mono text-xs">{pos.current_price}</TableCell>
                  <TableCell>
                    {editingTicket === pos.ticket ? (
                      <input
                        type="number"
                        step="any"
                        value={editSL}
                        onChange={(e) => setEditSL(e.target.value)}
                        className="w-24 rounded border bg-background px-2 py-1 text-xs"
                        placeholder={String(pos.sl)}
                      />
                    ) : (
                      <span className="font-mono text-xs">{pos.sl || "-"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingTicket === pos.ticket ? (
                      <input
                        type="number"
                        step="any"
                        value={editTP}
                        onChange={(e) => setEditTP(e.target.value)}
                        className="w-24 rounded border bg-background px-2 py-1 text-xs"
                        placeholder={String(pos.tp)}
                      />
                    ) : (
                      <span className="font-mono text-xs">{pos.tp || "-"}</span>
                    )}
                  </TableCell>
                  <TableCell className={`font-medium ${pos.profit >= 0 ? "text-success" : "text-danger"}`}>
                    {pos.profit >= 0 ? "+" : ""}{pos.profit?.toFixed(2)}$
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editingTicket === pos.ticket ? (
                        <>
                          <button onClick={() => handleModify(pos.ticket)} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">Save</button>
                          <button onClick={() => setEditingTicket(null)} className="rounded bg-muted px-2 py-1 text-xs">X</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingTicket(pos.ticket); setEditSL(pos.sl ? String(pos.sl) : ""); setEditTP(pos.tp ? String(pos.tp) : ""); }} className="rounded bg-muted p-1" title="Modifier SL/TP">
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button onClick={() => handlePartialClose(pos.ticket, pos.volume)} className="rounded bg-warning/20 px-2 py-1 text-xs text-warning" title="Close 50%">50%</button>
                          <button onClick={() => handleClose(pos.ticket)} className="rounded bg-danger/20 p-1 text-danger" title="Fermer">
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune position ouverte</p>
        )}
      </Card>

      {/* Section 3 + 4: Forms side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Execute Order */}
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Send className="h-4 w-4" />
            Executer un Ordre (Direct MT5)
          </CardTitle>
          <div className="space-y-3">
            {/* Strategy selector */}
            <div>
              <label className="text-xs text-muted-foreground">Strategie</label>
              <select value={orderStrategy} onChange={(e) => setOrderStrategy(e.target.value)} disabled={orderBypass}
                className={`w-full rounded border bg-background px-3 py-2 text-sm ${orderBypass ? "opacity-50" : ""}`}>
                <option value="">-- Choisir --</option>
                {strategies.map((s: any) => (
                  <option key={s.strategy_id} value={s.strategy_id}>
                    {s.name} {!strategyPlans[s.strategy_id] ? "(pas de plan)" : ""}
                  </option>
                ))}
              </select>
              {orderStrategy && !strategyPlans[orderStrategy] && !orderBypass && (
                <p className="mt-1 text-xs text-danger">Cette strategie n&apos;a pas de plan de trading</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Symbole</label>
                <select value={orderSymbol} onChange={(e) => setOrderSymbol(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm">
                  {["EURUSD+", "GBPUSD+", "USDJPY+", "XAUUSD+", "AUDUSD+", "EURGBP+", "EURJPY+", "GBPJPY+"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Direction</label>
                <select value={orderDirection} onChange={(e) => setOrderDirection(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm">
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Volume</label>
                <input type="number" step="0.01" value={orderVolume} onChange={(e) => setOrderVolume(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-danger">SL * (prix)</label>
                <input type="text" value={orderSL} onChange={(e) => setOrderSL(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" placeholder="1.16504" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">TP (prix)</label>
                <input type="text" value={orderTP} onChange={(e) => setOrderTP(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" placeholder="1.17200" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExecuteOrder} disabled={!canSendOrder}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">
                Executer l&apos;ordre
              </button>
              <button onClick={() => setOrderBypass(!orderBypass)}
                className={`rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${orderBypass ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {orderBypass ? "Bypass ON" : "Bypass"}
              </button>
            </div>
          </div>
        </Card>

        {/* Test Webhook */}
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Simuler Webhook TradingView
          </CardTitle>
          <div className="space-y-3">
            {/* Strategy selector */}
            <div>
              <label className="text-xs text-muted-foreground">Strategie</label>
              <select value={whStrategyId} onChange={(e) => setWhStrategyId(e.target.value)} disabled={whBypass}
                className={`w-full rounded border bg-background px-3 py-2 text-sm ${whBypass ? "opacity-50" : ""}`}>
                <option value="">-- Choisir --</option>
                {strategies.map((s: any) => (
                  <option key={s.strategy_id} value={s.strategy_id}>
                    {s.name} {!strategyPlans[s.strategy_id] ? "(pas de plan)" : ""}
                  </option>
                ))}
              </select>
              {whStrategyId && !strategyPlans[whStrategyId] && !whBypass && (
                <p className="mt-1 text-xs text-danger">Cette strategie n&apos;a pas de plan de trading</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Symbole</label>
                <select value={whSymbol} onChange={(e) => setWhSymbol(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm">
                  {["EURUSD+", "GBPUSD+", "USDJPY+", "XAUUSD+", "AUDUSD+", "EURGBP+"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Direction</label>
                <select value={whDirection} onChange={(e) => setWhDirection(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm">
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs text-muted-foreground">Lot Size</label>
                <input type="number" step="0.01" value={whLotSize} onChange={(e) => setWhLotSize(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Risk %</label>
                <input type="number" step="0.5" value={whRiskPercent} onChange={(e) => setWhRiskPercent(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-danger">SL * (prix)</label>
                <input type="text" value={whSL} onChange={(e) => setWhSL(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" placeholder="1.16504" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">TP (prix)</label>
                <input type="text" value={whTP} onChange={(e) => setWhTP(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm" placeholder="1.17200" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSendWebhook} disabled={!canSendWebhook}
                className="flex-1 rounded-lg bg-warning/20 px-4 py-2.5 text-sm font-medium text-warning hover:bg-warning/30 disabled:opacity-40 disabled:cursor-not-allowed">
                Envoyer le webhook test
              </button>
              <button onClick={() => setWhBypass(!whBypass)}
                className={`rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${whBypass ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {whBypass ? "Bypass ON" : "Bypass"}
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Section 5: Trade History */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historique Trades (DB)
          </CardTitle>
          <button onClick={fetchHistory} className="rounded bg-muted px-3 py-1 text-xs hover:bg-muted/80">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        {tradeHistory.length > 0 ? (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Symbole</TableHead>
                <TableHead>Dir</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>SL</TableHead>
                <TableHead>TP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>P&amp;L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tradeHistory.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.id}</TableCell>
                  <TableCell className="font-mono text-xs">{t.ticket}</TableCell>
                  <TableCell className="font-medium">{t.symbol}</TableCell>
                  <TableCell>
                    <Badge variant={t.direction === "BUY" ? "success" : "danger"}>{t.direction}</Badge>
                  </TableCell>
                  <TableCell>{t.volume}</TableCell>
                  <TableCell className="font-mono text-xs">{t.entry_price}</TableCell>
                  <TableCell className="font-mono text-xs">{t.stop_loss || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{t.take_profit || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "open" ? "warning" : "muted"}>{t.status}</Badge>
                  </TableCell>
                  <TableCell className={`font-medium ${(t.profit || 0) >= 0 ? "text-success" : "text-danger"}`}>
                    {(t.profit || 0) >= 0 ? "+" : ""}{(t.profit || 0).toFixed(2)}$
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun trade en base</p>
        )}
      </Card>

      {/* Section 6: Console Log */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Console API
            <span className="text-xs text-muted-foreground">({logs.length})</span>
          </CardTitle>
          <div className="flex gap-2">
            <button
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1 text-xs hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-success" />
                  Copie !
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copier
                </>
              )}
            </button>
            <button
              onClick={() => setLogs([])}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 rounded border border-danger/40 bg-danger/10 px-3 py-1 text-xs text-danger hover:bg-danger/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>
        <div className="h-64 overflow-y-auto rounded-lg bg-[#0d1117] p-4 font-mono text-xs">
          {logs.length === 0 && (
            <p className="text-gray-500">Les logs des requetes API apparaitront ici...</p>
          )}
          {logs.map((log, i) => (
            <div key={i} className="mb-1">
              <span className="text-gray-500">[{log.time}]</span>{" "}
              <span
                className={
                  log.type === "request"
                    ? "text-blue-400"
                    : log.type === "response"
                    ? "text-green-400"
                    : log.type === "error"
                    ? "text-red-400"
                    : "text-gray-400"
                }
              >
                {log.type.toUpperCase()}
              </span>{" "}
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </Card>
    </div>
  );
}
