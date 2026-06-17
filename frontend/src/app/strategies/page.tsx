"use client";

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import { api, type Strategy } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import {
  Brain, Plus, Trash2, Edit3, X, Save,
  ChevronDown, ChevronUp, Shield, AlertTriangle,
} from "lucide-react";

interface TradingPlanData {
  id?: number;
  max_risk_per_trade: number;
  max_daily_drawdown: number;
  max_weekly_drawdown: number;
  max_total_drawdown: number;
  max_open_positions: number;
  max_trades_per_day: number;
  trading_hours_start: string;
  trading_hours_end: string;
  trading_hours_bypass: boolean;
  breakeven_enabled: boolean;
  breakeven_trigger_pips: number;
  breakeven_offset_pips: number;
  trailing_stop_enabled: boolean;
  trailing_stop_distance_pips: number;
  partial_tp_enabled: boolean;
  partial_tp_percent: number;
}

const DEFAULT_PLAN: TradingPlanData = {
  max_risk_per_trade: 1,
  max_daily_drawdown: 3,
  max_weekly_drawdown: 5,
  max_total_drawdown: 10,
  max_open_positions: 5,
  max_trades_per_day: 10,
  trading_hours_start: "08:00",
  trading_hours_end: "20:00",
  trading_hours_bypass: false,
  breakeven_enabled: false,
  breakeven_trigger_pips: 20,
  breakeven_offset_pips: 2,
  trailing_stop_enabled: false,
  trailing_stop_distance_pips: 15,
  partial_tp_enabled: false,
  partial_tp_percent: 50,
};

function getAssetCategory(symbol: string): { label: string; color: string } {
  const s = symbol.toUpperCase().replace(/\+$/, "");
  if (s.startsWith("XAU") || s.startsWith("XAG"))
    return { label: "Metal", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" };
  if (s.startsWith("BTC") || s.startsWith("ETH"))
    return { label: "Crypto", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
  if (["US30", "US100", "US500", "DE40", "UK100", "JP225"].some((i) => s.startsWith(i)))
    return { label: "Indice", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" };
  return { label: "Forex", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
}

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";
const inputSmClass = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none";

export default function StrategiesPage() {
  const { data: strategies, loading, refetch } = useApi<Strategy[]>(api.getStrategies);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [planTab, setPlanTab] = useState<string | null>(null); // strategy_id showing plan editor
  const [plans, setPlans] = useState<Record<string, TradingPlanData | null>>({});

  // Create form
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSymbols, setNewSymbols] = useState("");
  const [newTimeframes, setNewTimeframes] = useState("");
  const [createError, setCreateError] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSymbols, setEditSymbols] = useState("");
  const [editTimeframes, setEditTimeframes] = useState("");

  // Plan edit form
  const [planForm, setPlanForm] = useState<TradingPlanData>(DEFAULT_PLAN);

  // Fetch plans for all strategies
  const fetchPlans = useCallback(async () => {
    if (!strategies) return;
    const result: Record<string, TradingPlanData | null> = {};
    for (const s of strategies) {
      try {
        const res = await fetch(`/api/strategies/${s.strategy_id}/trading-plan`);
        if (res.ok) {
          const data = await res.json();
          result[s.strategy_id] = data;
        } else {
          result[s.strategy_id] = null;
        }
      } catch {
        result[s.strategy_id] = null;
      }
    }
    setPlans(result);
  }, [strategies]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const resetCreateForm = () => {
    setNewId(""); setNewName(""); setNewDesc(""); setNewSymbols(""); setNewTimeframes("");
    setCreateError(""); setShowCreate(false);
  };

  const handleCreate = async () => {
    if (!newId.trim() || !newName.trim()) { setCreateError("L'ID et le nom sont obligatoires"); return; }
    setCreateError("");
    try {
      await api.createStrategy({
        strategy_id: newId.trim(), name: newName.trim(), description: newDesc.trim(),
        symbols: newSymbols ? newSymbols.split(",").map((s) => s.trim()).filter(Boolean) : [],
        timeframes: newTimeframes ? newTimeframes.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      resetCreateForm();
      refetch();
    } catch (err: any) { setCreateError(err?.message || "Erreur"); }
  };

  const handleDelete = async (strategyId: string) => {
    if (deleteConfirm !== strategyId) { setDeleteConfirm(strategyId); return; }
    try { await api.deleteStrategy(strategyId); setDeleteConfirm(null); refetch(); } catch {}
  };

  const toggleStrategy = async (strategyId: string, currentState: boolean) => {
    // Block activation if no plan
    if (!currentState && !plans[strategyId]) {
      setPlanTab(strategyId);
      setExpandedId(strategyId);
      return;
    }
    try { await api.updateStrategy(strategyId, { is_active: !currentState }); refetch(); } catch {}
  };

  const handleSaveEdit = async (strategyId: string) => {
    try {
      await api.updateStrategy(strategyId, {
        name: editName || undefined, description: editDesc,
        symbols: editSymbols.split(",").map((s) => s.trim()).filter(Boolean),
        timeframes: editTimeframes.split(",").map((s) => s.trim()).filter(Boolean),
      } as any);
      setEditingId(null); refetch();
    } catch {}
  };

  const startEdit = (s: Strategy) => {
    setEditingId(s.strategy_id); setEditName(s.name); setEditDesc(s.description || "");
    setEditSymbols(s.symbols.join(", ")); setEditTimeframes(s.timeframes.join(", "));
    setExpandedId(s.strategy_id); setPlanTab(null);
  };

  const openPlanEditor = (strategyId: string) => {
    const existing = plans[strategyId];
    setPlanForm(existing ? { ...DEFAULT_PLAN, ...existing } : { ...DEFAULT_PLAN });
    setPlanTab(strategyId);
    setEditingId(null);
    setExpandedId(strategyId);
  };

  const handleSavePlan = async (strategyId: string) => {
    try {
      await fetch(`/api/strategies/${strategyId}/trading-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planForm),
      });
      setPlanTab(null);
      fetchPlans();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Strategies</h1>
          <p className="text-muted-foreground">Gerez vos strategies, actifs et plans de trading</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            showCreate ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}>
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? "Annuler" : "Nouvelle Strategie"}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> Creer une Strategie</CardTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">ID Strategie *</label>
                <input type="text" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="ex: volume_scanner" className={inputClass} />
                <p className="mt-1 text-xs text-muted-foreground">Identifiant unique, utilise dans les webhooks</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Nom *</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ex: Indice Volume Scanner" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Description</label>
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="ex: Scanner de volume" className={inputClass} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Actifs trades (virgule)</label>
                <input type="text" value={newSymbols} onChange={(e) => setNewSymbols(e.target.value)} placeholder="EURUSD+, XAUUSD+, US100" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Timeframes (virgule)</label>
                <input type="text" value={newTimeframes} onChange={(e) => setNewTimeframes(e.target.value)} placeholder="M15, H1, H4" className={inputClass} />
              </div>
            </div>
            {createError && <p className="text-sm text-danger">{createError}</p>}
            <button onClick={handleCreate} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Creer la Strategie</button>
          </div>
        </Card>
      )}

      {/* Strategy List */}
      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : strategies && strategies.length > 0 ? (
        <div className="space-y-4">
          {strategies.map((strategy) => {
            const winRate = strategy.total_trades > 0 ? (strategy.winning_trades / strategy.total_trades) * 100 : 0;
            const isExpanded = expandedId === strategy.strategy_id;
            const isEditing = editingId === strategy.strategy_id;
            const isPlanEditing = planTab === strategy.strategy_id;
            const hasPlan = !!plans[strategy.strategy_id];

            const symbolsByCategory = strategy.symbols.reduce<Record<string, string[]>>((acc, s) => {
              const cat = getAssetCategory(s);
              if (!acc[cat.label]) acc[cat.label] = [];
              acc[cat.label].push(s);
              return acc;
            }, {});

            return (
              <Card key={strategy.strategy_id}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-1 cursor-pointer items-center gap-3"
                    onClick={() => { setExpandedId(isExpanded ? null : strategy.strategy_id); setPlanTab(null); setEditingId(null); }}>
                    <div className={`rounded-lg p-2 ${strategy.is_active && hasPlan ? "bg-success/10" : !hasPlan ? "bg-warning/10" : "bg-muted"}`}>
                      <Brain className={`h-5 w-5 ${strategy.is_active && hasPlan ? "text-success" : !hasPlan ? "text-warning" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold">{strategy.name}</h3>
                        {!hasPlan ? (
                          <Badge variant="warning">Plan requis</Badge>
                        ) : (
                          <Badge variant={strategy.is_active ? "success" : "muted"}>
                            {strategy.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {strategy.strategy_id}{strategy.description && ` — ${strategy.description}`}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <Toggle enabled={strategy.is_active} onChange={() => toggleStrategy(strategy.strategy_id, strategy.is_active)} />
                  </div>
                </div>

                {/* Actifs - always visible */}
                {strategy.symbols.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {Object.entries(symbolsByCategory).map(([category, symbols]) => {
                      const catInfo = getAssetCategory(symbols[0]);
                      return (
                        <div key={category} className="flex items-center gap-2">
                          <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${catInfo.color}`}>{category}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {symbols.map((s) => (
                              <span key={s} className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{s.replace(/\+$/, "")}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground italic">Aucun actif defini — modifier la strategie pour ajouter des actifs</p>
                )}

                {/* Timeframes */}
                {strategy.timeframes.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">TF:</span>
                    <div className="flex gap-1.5">
                      {strategy.timeframes.map((tf) => (
                        <span key={tf} className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">{tf}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plan info summary */}
                {hasPlan && !isExpanded && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    <span>Risk: {plans[strategy.strategy_id]!.max_risk_per_trade}%</span>
                    <span>DD max: {plans[strategy.strategy_id]!.max_total_drawdown}%</span>
                    <span>Pos max: {plans[strategy.strategy_id]!.max_open_positions}</span>
                    <span>{plans[strategy.strategy_id]!.trading_hours_bypass ? "24/7" : `${plans[strategy.strategy_id]!.trading_hours_start}-${plans[strategy.strategy_id]!.trading_hours_end}`}</span>
                  </div>
                )}

                {/* No plan warning */}
                {!hasPlan && !isExpanded && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Definissez un plan de trading pour activer cette strategie</span>
                  </div>
                )}

                {/* Stats */}
                {strategy.total_trades > 0 && (
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{strategy.total_trades} trades</span>
                    <span>WR: <span className={winRate >= 50 ? "text-success font-medium" : "text-danger font-medium"}>{winRate.toFixed(0)}%</span></span>
                    <span>P&L: <span className={`font-medium ${strategy.total_profit >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(strategy.total_profit)}</span></span>
                  </div>
                )}

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="mt-4 border-t border-border pt-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Total Trades</p>
                        <p className="text-xl font-bold">{strategy.total_trades}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                        <p className={`text-xl font-bold ${winRate >= 50 ? "text-success" : "text-danger"}`}>{winRate.toFixed(1)}%</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Profit Total</p>
                        <p className={`text-xl font-bold ${strategy.total_profit >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(strategy.total_profit)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Max Drawdown</p>
                        <p className="text-xl font-bold text-danger">{strategy.max_drawdown.toFixed(1)}%</p>
                      </div>
                    </div>

                    {/* Edit strategy */}
                    {isEditing && (
                      <div className="mt-4 space-y-3 rounded-lg bg-muted/30 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modifier la strategie</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div><label className="mb-1 block text-xs text-muted-foreground">Nom</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} /></div>
                          <div><label className="mb-1 block text-xs text-muted-foreground">Description</label><input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className={inputClass} /></div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div><label className="mb-1 block text-xs text-muted-foreground">Actifs (virgule)</label><input type="text" value={editSymbols} onChange={(e) => setEditSymbols(e.target.value)} placeholder="EURUSD+, XAUUSD+" className={inputClass} /></div>
                          <div><label className="mb-1 block text-xs text-muted-foreground">Timeframes (virgule)</label><input type="text" value={editTimeframes} onChange={(e) => setEditTimeframes(e.target.value)} placeholder="M15, H1" className={inputClass} /></div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(strategy.strategy_id)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Save className="h-3.5 w-3.5" /> Sauvegarder</button>
                          <button onClick={() => setEditingId(null)} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
                        </div>
                      </div>
                    )}

                    {/* Plan de Trading editor */}
                    {isPlanEditing && (
                      <div className="mt-4 space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <p className="flex items-center gap-2 text-sm font-medium"><Shield className="h-4 w-4 text-primary" /> Plan de Trading</p>

                        {/* Risk */}
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Gestion du risque</p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div><label className="mb-1 block text-xs text-muted-foreground">Risk / trade (%)</label>
                              <input type="number" step="0.5" value={planForm.max_risk_per_trade} onChange={(e) => setPlanForm({ ...planForm, max_risk_per_trade: parseFloat(e.target.value) || 0 })} className={inputSmClass} /></div>
                            <div><label className="mb-1 block text-xs text-muted-foreground">DD jour max (%)</label>
                              <input type="number" step="0.5" value={planForm.max_daily_drawdown} onChange={(e) => setPlanForm({ ...planForm, max_daily_drawdown: parseFloat(e.target.value) || 0 })} className={inputSmClass} /></div>
                            <div><label className="mb-1 block text-xs text-muted-foreground">DD semaine (%)</label>
                              <input type="number" step="0.5" value={planForm.max_weekly_drawdown} onChange={(e) => setPlanForm({ ...planForm, max_weekly_drawdown: parseFloat(e.target.value) || 0 })} className={inputSmClass} /></div>
                            <div><label className="mb-1 block text-xs text-muted-foreground">DD total max (%)</label>
                              <input type="number" step="0.5" value={planForm.max_total_drawdown} onChange={(e) => setPlanForm({ ...planForm, max_total_drawdown: parseFloat(e.target.value) || 0 })} className={inputSmClass} /></div>
                          </div>
                        </div>

                        {/* Limits */}
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Limites</p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div><label className="mb-1 block text-xs text-muted-foreground">Positions max</label>
                              <input type="number" value={planForm.max_open_positions} onChange={(e) => setPlanForm({ ...planForm, max_open_positions: parseInt(e.target.value) || 0 })} className={inputSmClass} /></div>
                            <div><label className="mb-1 block text-xs text-muted-foreground">Trades / jour max</label>
                              <input type="number" value={planForm.max_trades_per_day} onChange={(e) => setPlanForm({ ...planForm, max_trades_per_day: parseInt(e.target.value) || 0 })} className={inputSmClass} /></div>
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Heure debut</label>
                              <input type="time" value={planForm.trading_hours_start} onChange={(e) => setPlanForm({ ...planForm, trading_hours_start: e.target.value })}
                                disabled={planForm.trading_hours_bypass} className={`${inputSmClass} ${planForm.trading_hours_bypass ? "opacity-40" : ""}`} />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Heure fin</label>
                              <input type="time" value={planForm.trading_hours_end} onChange={(e) => setPlanForm({ ...planForm, trading_hours_end: e.target.value })}
                                disabled={planForm.trading_hours_bypass} className={`${inputSmClass} ${planForm.trading_hours_bypass ? "opacity-40" : ""}`} />
                            </div>
                          </div>
                          <button onClick={() => setPlanForm({ ...planForm, trading_hours_bypass: !planForm.trading_hours_bypass })}
                            className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                              planForm.trading_hours_bypass
                                ? "bg-warning/20 text-warning"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}>
                            {planForm.trading_hours_bypass ? "Horaires bypasses (24/7)" : "Bypass horaires"}
                          </button>
                        </div>

                        {/* BE / Trailing / Partial */}
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Gestion de position</p>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-lg bg-background p-3">
                              <div>
                                <p className="text-sm font-medium">Break-even</p>
                                <p className="text-xs text-muted-foreground">Deplacer SL au prix d&apos;entree</p>
                              </div>
                              <div className="flex items-center gap-3">
                                {planForm.breakeven_enabled && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Trigger:</span>
                                    <input type="number" step="1" value={planForm.breakeven_trigger_pips} onChange={(e) => setPlanForm({ ...planForm, breakeven_trigger_pips: parseFloat(e.target.value) || 0 })} className="w-16 rounded border bg-background px-2 py-1 text-xs" />
                                    <span className="text-muted-foreground">pips</span>
                                  </div>
                                )}
                                <Toggle enabled={planForm.breakeven_enabled} onChange={() => setPlanForm({ ...planForm, breakeven_enabled: !planForm.breakeven_enabled })} />
                              </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg bg-background p-3">
                              <div>
                                <p className="text-sm font-medium">Trailing Stop</p>
                                <p className="text-xs text-muted-foreground">SL suiveur automatique</p>
                              </div>
                              <div className="flex items-center gap-3">
                                {planForm.trailing_stop_enabled && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Distance:</span>
                                    <input type="number" step="1" value={planForm.trailing_stop_distance_pips} onChange={(e) => setPlanForm({ ...planForm, trailing_stop_distance_pips: parseFloat(e.target.value) || 0 })} className="w-16 rounded border bg-background px-2 py-1 text-xs" />
                                    <span className="text-muted-foreground">pips</span>
                                  </div>
                                )}
                                <Toggle enabled={planForm.trailing_stop_enabled} onChange={() => setPlanForm({ ...planForm, trailing_stop_enabled: !planForm.trailing_stop_enabled })} />
                              </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg bg-background p-3">
                              <div>
                                <p className="text-sm font-medium">Take Profit Partiel</p>
                                <p className="text-xs text-muted-foreground">Cloturer une partie au TP</p>
                              </div>
                              <div className="flex items-center gap-3">
                                {planForm.partial_tp_enabled && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Fermer:</span>
                                    <input type="number" step="10" value={planForm.partial_tp_percent} onChange={(e) => setPlanForm({ ...planForm, partial_tp_percent: parseFloat(e.target.value) || 0 })} className="w-16 rounded border bg-background px-2 py-1 text-xs" />
                                    <span className="text-muted-foreground">%</span>
                                  </div>
                                )}
                                <Toggle enabled={planForm.partial_tp_enabled} onChange={() => setPlanForm({ ...planForm, partial_tp_enabled: !planForm.partial_tp_enabled })} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => handleSavePlan(strategy.strategy_id)}
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                            <Save className="h-3.5 w-3.5" /> Sauvegarder le Plan
                          </button>
                          <button onClick={() => setPlanTab(null)} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isEditing && !isPlanEditing && (
                      <div className="mt-4 flex items-center justify-between">
                        {hasPlan && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <Shield className="h-3 w-3" />
                            <span>Risk: {plans[strategy.strategy_id]!.max_risk_per_trade}%</span>
                            <span>DD: {plans[strategy.strategy_id]!.max_total_drawdown}%</span>
                            <span>Pos: {plans[strategy.strategy_id]!.max_open_positions}</span>
                            <span>{plans[strategy.strategy_id]!.trading_hours_start}-{plans[strategy.strategy_id]!.trading_hours_end}</span>
                          </div>
                        )}
                        <div className="ml-auto flex gap-2">
                          <button onClick={() => openPlanEditor(strategy.strategy_id)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                              hasPlan ? "bg-muted text-muted-foreground hover:text-foreground" : "bg-primary/20 text-primary hover:bg-primary/30"
                            }`}>
                            <Shield className="h-3.5 w-3.5" /> {hasPlan ? "Modifier le Plan" : "Definir le Plan"}
                          </button>
                          <button onClick={() => startEdit(strategy)}
                            className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                            <Edit3 className="h-3.5 w-3.5" /> Modifier
                          </button>
                          <button onClick={() => handleDelete(strategy.strategy_id)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                              deleteConfirm === strategy.strategy_id ? "bg-danger text-white" : "bg-danger/10 text-danger hover:bg-danger/20"
                            }`}>
                            <Trash2 className="h-3.5 w-3.5" /> {deleteConfirm === strategy.strategy_id ? "Confirmer" : "Supprimer"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <Brain className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">Aucune strategie</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Cliquez sur &quot;Nouvelle Strategie&quot; pour en creer une.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
