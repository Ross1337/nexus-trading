"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Log = Record<string, unknown>;

export default function WebhookLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    api.webhookLogs(200).then((d) => setLogs(d as Log[])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  async function clear() {
    if (!confirm("Supprimer tous les logs?")) return;
    await api.clearWebhookLogs();
    reload();
  }

  return (
    <DashboardLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Webhook Logs</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={reload}>Rafraîchir</button>
          <button className="btn-ghost" style={{ color: "#FF4466" }} onClick={clear}>Vider</button>
        </div>
      </div>
      <div className="card">
        {loading ? (
          <div style={{ textAlign: "center", color: "#6B7A9A", padding: 40 }}>Chargement...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Source</th>
                <th>IP</th>
                <th>Statut</th>
                <th>Signal ID</th>
                <th>Erreur</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "#6B7A9A", padding: 32 }}>Aucun log</td></tr>
              )}
              {logs.map((l, i) => (
                <tr key={i}>
                  <td className="mono" style={{ color: "#6B7A9A" }}>{String(l.id)}</td>
                  <td><span className="badge-cyan">{String(l.source)}</span></td>
                  <td className="mono" style={{ color: "#6B7A9A", fontSize: "0.8rem" }}>{String(l.ip_address || "—")}</td>
                  <td>
                    <span className={l.status === "processed" || l.status === "executed" ? "badge-green" : l.status === "rejected" || l.status === "error" ? "badge-red" : "badge-cyan"}>
                      {String(l.status)}
                    </span>
                  </td>
                  <td className="mono">{String(l.signal_id || "—")}</td>
                  <td style={{ fontSize: "0.8rem", color: "#FF4466", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {String(l.error_message || "")}
                  </td>
                  <td style={{ color: "#6B7A9A", fontSize: "0.8rem" }}>
                    {l.created_at ? new Date(String(l.created_at)).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
