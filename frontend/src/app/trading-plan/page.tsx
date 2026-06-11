"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Plan = Record<string, unknown>;

export default function TradingPlanPage() {
  const [plan, setPlan] = useState<Plan>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.tradingPlan().then(setPlan).catch(() => {}); }, []);

  async function save() {
    setSaving(true);
    try { await api.updateTradingPlan(plan); } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  const set = (k: string, v: unknown) => setPlan((p) => ({ ...p, [k]: v }));
  const numField = (label: string, key: string) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: "0.8rem", color: "#6B7A9A", display: "block", marginBottom: 4 }}>{label}</label>
      <input type="number" step="0.1" value={String(plan[key] ?? "")} onChange={(e) => set(key, parseFloat(e.target.value))} style={{ width: "100%" }} />
    </div>
  );
  const toggle = (label: string, key: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={{ fontSize: "0.875rem" }}>{label}</span>
      <button className={plan[key] ? "btn-primary" : "btn-ghost"} style={{ padding: "4px 12px", fontSize: "0.8rem" }} onClick={() => set(key, !plan[key])}>
        {plan[key] ? "ON" : "OFF"}
      </button>
    </div>
  );

  return (
    <DashboardLayout>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Plan de Trading</h1>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Sauvegarde..." : "Sauvegarder"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Risque Global</div>
          {numField("Risque max/trade (%)", "max_risk_per_trade_pct")}
          {numField("Max trades simultanés", "max_open_trades")}
          {numField("Lot max", "max_lot_size")}
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Breakeven & Trailing</div>
          {toggle("Breakeven", "be_enabled")}
          {numField("Déclencheur BE (pips)", "be_trigger_pips")}
          {numField("Offset BE (pips)", "be_offset_pips")}
          {toggle("Trailing Stop", "trailing_enabled")}
          {numField("Step (pips)", "trailing_step_pips")}
          {numField("Distance (pips)", "trailing_distance_pips")}
          {toggle("Partial TP", "partial_tp_enabled")}
          {numField("% à clore", "partial_tp_percent")}
          {numField("RR déclencheur", "partial_tp_rr")}
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Règles Propfirm</div>
          {toggle("Mode Propfirm", "propfirm_enabled")}
          {numField("DD journalier max (%)", "max_daily_drawdown_pct")}
          {numField("DD total max (%)", "max_total_drawdown_pct")}
          {numField("Perte journalière max ($)", "max_daily_loss_usd")}
          {numField("Objectif profit (%)", "profit_target_pct")}
        </div>
      </div>
    </DashboardLayout>
  );
}
