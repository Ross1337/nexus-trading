"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";

type Trade = Record<string, unknown>;

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.tradeHistory(200)
      .then((data) => setTrades(data as Trade[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = trades.filter((t) =>
    !filter || String(t.symbol).toLowerCase().includes(filter.toLowerCase())
  );

  const stats = {
    total: trades.length,
    wins: trades.filter((t) => Number(t.profit) > 0).length,
    profit: trades.reduce((s, t) => s + Number(t.profit || 0), 0),
  };
  const winrate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : "—";

  function exportCSV() {
    const headers = "Symbol,Action,Lot,Entry,Close,SL,TP,Profit,Status,Open,Close\n";
    const rows = trades.map((t) =>
      [t.symbol, t.action, t.lot_size, t.entry_price, t.close_price, t.stop_loss, t.take_profit, t.profit, t.status, t.open_time, t.close_time].join(",")
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexus_trades.csv";
    a.click();
  }

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Historique des Trades</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <Stat label="Total trades" value={String(stats.total)} />
        <Stat label="Wins" value={String(stats.wins)} color="#00FF88" />
        <Stat label="Win rate" value={`${winrate}%`} color="#00D4FF" />
        <Stat label="Total P&L" value={`${stats.profit.toFixed(2)}$`} color={stats.profit >= 0 ? "#00FF88" : "#FF4466"} />
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <input
            placeholder="Filtrer par symbole..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 220 }}
          />
          <button className="btn-ghost" onClick={exportCSV}>
            Exporter CSV
          </button>
        </div>
        {loading ? (
          <div style={{ color: "#6B7A9A", textAlign: "center", padding: 40 }}>Chargement...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Symbole</th>
                <th>Action</th>
                <th>Lot</th>
                <th>Entrée</th>
                <th>Sortie</th>
                <th>SL</th>
                <th>Profit</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: "center", color: "#6B7A9A", padding: 32 }}>Aucun trade</td></tr>
              )}
              {filtered.map((t, i) => (
                <tr key={i}>
                  <td className="mono" style={{ color: "#6B7A9A" }}>{String(t.id || i)}</td>
                  <td style={{ fontWeight: 600 }}>{String(t.symbol)}</td>
                  <td>
                    <span className={t.action === "buy" ? "badge-green" : "badge-red"}>
                      {String(t.action).toUpperCase()}
                    </span>
                  </td>
                  <td className="mono">{String(t.lot_size || "—")}</td>
                  <td className="mono">{t.entry_price ? Number(t.entry_price).toFixed(5) : "—"}</td>
                  <td className="mono">{t.close_price ? Number(t.close_price).toFixed(5) : "—"}</td>
                  <td className="mono">{t.stop_loss ? Number(t.stop_loss).toFixed(5) : "—"}</td>
                  <td className={`mono ${Number(t.profit) >= 0 ? "profit" : "loss"}`}>
                    {t.profit != null ? Number(t.profit).toFixed(2) : "—"}
                  </td>
                  <td><span className={t.status === "closed" ? "badge-green" : "badge-cyan"}>{String(t.status)}</span></td>
                  <td style={{ color: "#6B7A9A", fontSize: "0.8rem" }}>
                    {t.open_time ? new Date(String(t.open_time)).toLocaleDateString() : "—"}
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

function Stat({ label, value, color = "#E8EDF5" }: { label: string; value: string; color?: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: "0.75rem", color: "#6B7A9A", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: "1.3rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
