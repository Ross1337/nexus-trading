"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Rule = Record<string, unknown>;

export default function SymbolRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState({ input_pattern: "", output_symbol: "", description: "", enabled: true });
  const [editing, setEditing] = useState<number | null>(null);

  const reload = () => api.symbolRules().then((d) => setRules(d as Rule[])).catch(() => {});
  useEffect(() => { reload(); }, []);

  async function save() {
    if (editing !== null) await api.updateSymbolRule(editing, form);
    else await api.createSymbolRule(form);
    setEditing(null);
    setForm({ input_pattern: "", output_symbol: "", description: "", enabled: true });
    reload();
  }

  function edit(r: Rule) {
    setEditing(r.id as number);
    setForm({ input_pattern: String(r.input_pattern || ""), output_symbol: String(r.output_symbol || ""), description: String(r.description || ""), enabled: Boolean(r.enabled) });
  }

  return (
    <DashboardLayout>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Règles Symboles</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>{editing !== null ? "Modifier" : "Nouvelle règle"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input placeholder="Pattern entrée (OANDA:EURUSD)" value={form.input_pattern} onChange={(e) => setForm({ ...form, input_pattern: e.target.value })} />
            <input placeholder="Symbole MT5 (EURUSD)" value={form.output_symbol} onChange={(e) => setForm({ ...form, output_symbol: e.target.value })} />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={save}>{editing !== null ? "Sauvegarder" : "Créer"}</button>
              {editing !== null && <button className="btn-ghost" onClick={() => setEditing(null)}>Annuler</button>}
            </div>
            <button className="btn-ghost" onClick={() => api.seedRules().then(reload)}>Auto-seed depuis JSON</button>
          </div>
        </div>
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Pattern entrée</th>
                <th>Sortie MT5</th>
                <th>Description</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id as number}>
                  <td className="mono">{String(r.input_pattern)}</td>
                  <td className="mono" style={{ color: "#00D4FF" }}>{String(r.output_symbol)}</td>
                  <td style={{ color: "#6B7A9A", fontSize: "0.8rem" }}>{String(r.description || "")}</td>
                  <td><span className={r.enabled ? "badge-green" : "badge-red"}>{r.enabled ? "ON" : "OFF"}</span></td>
                  <td>
                    <button className="btn-ghost" style={{ padding: "3px 8px", fontSize: "0.8rem", marginRight: 4 }} onClick={() => edit(r)}>✎</button>
                    <button className="btn-ghost" style={{ padding: "3px 8px", fontSize: "0.8rem", color: "#FF4466" }} onClick={async () => { await api.deleteSymbolRule(r.id as number); reload(); }}>✕</button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#6B7A9A", padding: 24 }}>Aucune règle</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
