"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Strategy = Record<string, unknown>;

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [form, setForm] = useState({ name: "", description: "", enabled: true, risk_per_trade: 1.0, max_trades: 5, allowed_symbols: "", allowed_sessions: "" });
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => { api.strategies().then((d) => setStrategies(d as Strategy[])).catch(() => {}); }, []);

  async function save() {
    if (editing !== null) {
      await api.updateStrategy(editing, form);
    } else {
      await api.createStrategy(form);
    }
    setEditing(null);
    setForm({ name: "", description: "", enabled: true, risk_per_trade: 1.0, max_trades: 5, allowed_symbols: "", allowed_sessions: "" });
    api.strategies().then((d) => setStrategies(d as Strategy[])).catch(() => {});
  }

  function edit(s: Strategy) {
    setEditing(s.id as number);
    setForm({ name: String(s.name || ""), description: String(s.description || ""), enabled: Boolean(s.enabled), risk_per_trade: Number(s.risk_per_trade || 1), max_trades: Number(s.max_trades || 5), allowed_symbols: String(s.allowed_symbols || ""), allowed_sessions: String(s.allowed_sessions || "") });
  }

  async function del(id: number) {
    if (!confirm("Supprimer?")) return;
    await api.deleteStrategy(id);
    api.strategies().then((d) => setStrategies(d as Strategy[])).catch(() => {});
  }

  return (
    <DashboardLayout>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Stratégies</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>{editing !== null ? "Modifier" : "Nouvelle stratégie"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input placeholder="Risque/trade (%)" type="number" value={form.risk_per_trade} onChange={(e) => setForm({ ...form, risk_per_trade: parseFloat(e.target.value) })} />
            <input placeholder="Max trades simultanés" type="number" value={form.max_trades} onChange={(e) => setForm({ ...form, max_trades: parseInt(e.target.value) })} />
            <input placeholder="Symboles autorisés (EURUSD,GBPUSD)" value={form.allowed_symbols} onChange={(e) => setForm({ ...form, allowed_symbols: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={save}>
                {editing !== null ? "Sauvegarder" : "Créer"}
              </button>
              {editing !== null && <button className="btn-ghost" onClick={() => setEditing(null)}>Annuler</button>}
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Stratégies ({strategies.length})</div>
          {strategies.map((s) => (
            <div key={s.id as number} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1A2540" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{String(s.name)}</div>
                <div style={{ fontSize: "0.8rem", color: "#6B7A9A" }}>Risque: {String(s.risk_per_trade)}% | Max: {String(s.max_trades)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span className={s.enabled ? "badge-green" : "badge-red"}>{s.enabled ? "ON" : "OFF"}</span>
                <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: "0.8rem" }} onClick={() => edit(s)}>✎</button>
                <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: "0.8rem", color: "#FF4466" }} onClick={() => del(s.id as number)}>✕</button>
              </div>
            </div>
          ))}
          {strategies.length === 0 && <div style={{ color: "#6B7A9A" }}>Aucune stratégie</div>}
        </div>
      </div>
    </DashboardLayout>
  );
}
