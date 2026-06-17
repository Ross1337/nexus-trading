"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { api, type TestRunStatus, type TestResult } from "@/lib/api";
import { Play, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Loader2, Beaker } from "lucide-react";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  success: { bg: "bg-success/15", text: "text-success", label: "OK" },
  market_closed: { bg: "bg-yellow-500/15", text: "text-yellow-500", label: "Marche ferme" },
  unavailable: { bg: "bg-orange-500/15", text: "text-orange-500", label: "Indispo broker" },
  invalid_volume: { bg: "bg-danger/15", text: "text-danger", label: "Volume invalide" },
  invalid_stops: { bg: "bg-danger/15", text: "text-danger", label: "Stops invalides" },
  risk_overrun: { bg: "bg-purple-500/15", text: "text-purple-500", label: "Risk overrun" },
  sl_too_tight: { bg: "bg-purple-500/15", text: "text-purple-500", label: "SL trop serre" },
  other_error: { bg: "bg-danger/15", text: "text-danger", label: "Erreur" },
};

const PHASE_LABELS: Record<string, string> = {
  init: "Initialisation...",
  open: "Phase 1/3: ouverture des trades",
  hold: "Phase 2/3: attente avant cloture",
  close: "Phase 3/3: cloture des positions",
  complete: "Termine",
  error: "Erreur",
};

export default function TestSymbolsPage() {
  const [allSymbols, setAllSymbols] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [closeAfter, setCloseAfter] = useState(true);
  const [waitBetween, setWaitBetween] = useState(2);
  const [holdDuration, setHoldDuration] = useState(5);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<TestRunStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Charge la liste des symboles au mount
  useEffect(() => {
    api.getTestSymbols().then((d) => {
      setAllSymbols(d.symbols);
      setSelected(new Set(d.symbols)); // tous selectionnes par defaut
    });
  }, []);

  // Polling status
  const pollStatus = useCallback(async () => {
    if (!taskId) return;
    try {
      const s = await api.getTestStatus(taskId);
      setStatus(s);
      if (s.status === "done" || s.status === "error") {
        setPolling(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch (e) {
      console.error(e);
    }
  }, [taskId]);

  useEffect(() => {
    if (!polling || !taskId) return;
    pollRef.current = setInterval(pollStatus, 1500);
    pollStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [polling, taskId, pollStatus]);

  const startTest = async () => {
    if (selected.size === 0) {
      alert("Selectionne au moins un symbole");
      return;
    }
    const symbols = Array.from(selected);
    try {
      const r = await api.startTestRun({
        symbols,
        close_after: closeAfter,
        wait_between: waitBetween,
        hold_duration: holdDuration,
      });
      setTaskId(r.task_id);
      setStatus(null);
      setPolling(true);
    } catch (e) {
      alert("Erreur: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const toggleSymbol = (s: string) => {
    const next = new Set(selected);
    next.has(s) ? next.delete(s) : next.add(s);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(allSymbols));
  const selectNone = () => setSelected(new Set());
  const selectForex = () => setSelected(new Set(allSymbols.filter((s) => s.startsWith("OANDA:") && !s.includes("USD") || s.endsWith("JPY"))));
  const selectStocksUS = () => setSelected(new Set(allSymbols.filter((s) => s.startsWith("NASDAQ:") || s.startsWith("NYSE:"))));
  const selectIndices = () => setSelected(new Set(allSymbols.filter((s) => s.endsWith("USD") || s.endsWith("EUR"))));

  const isRunning = status?.status === "running" || status?.status === "starting";
  const progressPct = status ? Math.round((status.progress / status.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Beaker className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Test des symboles</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Lance un BUY (SL/TP large 5%/10%) sur chaque symbole selectionne, puis ferme automatiquement.
        Permet de valider quels actifs sont disponibles et tradables sur ton broker.
      </p>

      {/* Configuration */}
      {!isRunning && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Symboles ({selected.size}/{allSymbols.length})</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <button onClick={selectAll} className="rounded border border-border px-2 py-1 hover:bg-muted">Tous</button>
                <button onClick={selectNone} className="rounded border border-border px-2 py-1 hover:bg-muted">Aucun</button>
                <button onClick={selectForex} className="rounded border border-border px-2 py-1 hover:bg-muted">Forex/JPY</button>
                <button onClick={selectStocksUS} className="rounded border border-border px-2 py-1 hover:bg-muted">Actions US</button>
                <button onClick={selectIndices} className="rounded border border-border px-2 py-1 hover:bg-muted">Indices/Or</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto p-2 bg-background rounded-lg">
              {allSymbols.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSymbol(s)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    selected.has(s)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {s.split(":").pop()}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="font-semibold">Options</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={closeAfter}
                onChange={(e) => setCloseAfter(e.target.checked)}
                className="h-4 w-4"
              />
              Fermer apres test
            </label>
            <div>
              <label className="text-xs text-muted-foreground">Pause entre trades (s)</label>
              <input
                type="number"
                value={waitBetween}
                onChange={(e) => setWaitBetween(parseFloat(e.target.value))}
                step="0.5"
                min="0.5"
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
            {closeAfter && (
              <div>
                <label className="text-xs text-muted-foreground">Hold avant cloture (s)</label>
                <input
                  type="number"
                  value={holdDuration}
                  onChange={(e) => setHoldDuration(parseFloat(e.target.value))}
                  step="1"
                  min="1"
                  className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
            )}
            <button
              onClick={startTest}
              disabled={selected.size === 0}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Lancer le test ({selected.size})
            </button>
            <p className="text-xs text-muted-foreground">
              Duree estimee: ~{Math.ceil((selected.size * waitBetween + (closeAfter ? holdDuration + selected.size * waitBetween : 0)))}s
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      {status && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRunning ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : status.status === "done" ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-danger" />
              )}
              <span className="font-semibold">{PHASE_LABELS[status.phase] || status.phase}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {status.progress}/{status.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {status.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {Object.entries(status.summary.by_category).map(([cat, count]) => {
                const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other_error;
                return (
                  <div key={cat} className={`rounded-lg px-3 py-2 ${c.bg}`}>
                    <p className={`text-2xl font-bold ${c.text}`}>{count}</p>
                    <p className={`text-xs ${c.text}`}>{c.label}</p>
                  </div>
                );
              })}
            </div>
          )}
          {status.summary && (
            <p className="text-xs text-muted-foreground pt-1">
              Duree: {status.summary.duration_s}s · Trades fermes: {status.summary.trades_closed}
            </p>
          )}
        </div>
      )}

      {/* Results table */}
      {status && status.results.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">Broker</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2 text-right">Volume</th>
                <th className="px-3 py-2 text-right">Prix</th>
                <th className="px-3 py-2 text-right">SL</th>
                <th className="px-3 py-2 text-right">TP</th>
                <th className="px-3 py-2 text-right">R:R</th>
                <th className="px-3 py-2">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {status.results.map((r) => {
                const c = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.other_error;
                return (
                  <tr key={r.ticker} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.ticker}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.broker_symbol || "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
                        {c.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.volume ?? "-"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.price ? r.price.toFixed(4) : "-"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.sl ? r.sl.toFixed(4) : "-"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.tp ? r.tp.toFixed(4) : "-"}</td>
                    <td className="px-3 py-2 text-right text-xs">{r.rr ? `1:${r.rr}` : "-"}</td>
                    <td className="px-3 py-2 text-xs text-danger truncate max-w-xs">{r.error}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset button quand termine */}
      {status && status.status === "done" && (
        <button
          onClick={() => {
            setStatus(null);
            setTaskId(null);
          }}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Nouveau test
        </button>
      )}
    </div>
  );
}
