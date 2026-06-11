"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Account = Record<string, unknown>;

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ name: "", login: "", password: "", server: "", mode: "demo", enabled: true });
  const [editing, setEditing] = useState<number | null>(null);

  const reload = () => api.accounts().then((d) => setAccounts(d as Account[])).catch(() => {});
  useEffect(() => { reload(); }, []);

  async function save() {
    if (editing !== null) await api.updateAccount(editing, form);
    else await api.createAccount(form);
    setEditing(null);
    setForm({ name: "", login: "", password: "", server: "", mode: "demo", enabled: true });
    reload();
  }

  function edit(a: Account) {
    setEditing(a.id as number);
    setForm({ name: String(a.name || ""), login: String(a.login || ""), password: "", server: String(a.server || ""), mode: String(a.mode || "demo"), enabled: Boolean(a.enabled) });
  }

  async function logout() {
    await api.logout();
    window.location.href = "/login";
  }

  return (
    <DashboardLayout>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Paramètres</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>{editing !== null ? "Modifier compte" : "Ajouter compte MT5"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Login" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
            <input placeholder="Mot de passe" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <input placeholder="Serveur broker" value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} />
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="demo">Demo</option>
              <option value="live">Live</option>
              <option value="propfirm">Propfirm</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={save}>{editing !== null ? "Sauvegarder" : "Ajouter"}</button>
              {editing !== null && <button className="btn-ghost" onClick={() => setEditing(null)}>Annuler</button>}
            </div>
          </div>
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #1A2540" }}>
            <button className="btn-ghost" style={{ width: "100%", color: "#FF4466" }} onClick={logout}>
              Se déconnecter
            </button>
          </div>
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Comptes MT5 ({accounts.length})</div>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Login</th>
                <th>Serveur</th>
                <th>Mode</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id as number}>
                  <td style={{ fontWeight: 600 }}>{String(a.name)}</td>
                  <td className="mono">{String(a.login)}</td>
                  <td style={{ color: "#6B7A9A", fontSize: "0.85rem" }}>{String(a.server)}</td>
                  <td><span className={a.mode === "live" ? "badge-red" : a.mode === "propfirm" ? "badge-cyan" : "badge-green"}>{String(a.mode).toUpperCase()}</span></td>
                  <td><span className={a.enabled ? "badge-green" : "badge-red"}>{a.enabled ? "ON" : "OFF"}</span></td>
                  <td>
                    <button className="btn-ghost" style={{ padding: "3px 8px", fontSize: "0.8rem", marginRight: 4 }} onClick={() => edit(a)}>✎</button>
                    <button className="btn-ghost" style={{ padding: "3px 8px", fontSize: "0.8rem", color: "#FF4466" }} onClick={async () => { await api.deleteAccount(a.id as number); reload(); }}>✕</button>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#6B7A9A", padding: 24 }}>Aucun compte</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
