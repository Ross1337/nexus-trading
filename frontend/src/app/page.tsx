"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type AccountInfo = Record<string, unknown>;
type Position = Record<string, unknown>;
type Signal = Record<string, unknown>;

export default function DashboardPage() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [equityCurve, setEquityCurve] = useState<Record<string, unknown>[]>([]);
  const [health, setHealth] = useState<Record<string, unknown>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    api.signals(10).then(setSignals).catch(() => {});
    api.equityCurve().then(setEquityCurve).catch(() => {});
    api.health().then(setHealth).catch(() => {});

    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001") + "/ws/live";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "live_update") {
          if (data.account) setAccount(data.account);
          if (data.positions) setPositions(data.positions);
        }
      } catch {}
    };
    ws.onerror = () => {
      api.mt5Account().then(setAccount).catch(() => {});
      api.positions().then(setPositions).catch(() => {});
    };
    return () => ws.close();
  }, []);

  const fmt = (n: unknown) => (typeof n === "number" ? n.toFixed(2) : "—");
  const currency = (account?.currency as string) || "USD";

  return (
    <DashboardLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#E8EDF5", margin: 0 }}>Dashboard</h1>
          <div style={{ fontSize: "0.8rem", color: "#6B7A9A", marginTop: 4 }}>Mise à jour en temps réel</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <ServiceDot label="API" ok={health.status === "ok"} />
          <ServiceDot label="MT5" ok={!!health.mt5_connector} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Balance" value={`${fmt(account?.balance)} ${currency}`} color="#00D4FF" />
        <StatCard label="Equity" value={`${fmt(account?.equity)} ${currency}`} color="#00D4FF" />
        <StatCard label="Marge libre" value={`${fmt(account?.margin_free)} ${currency}`} color="#6B7A9A" />
        <StatCard
          label="P&L flottant"
          value={`${fmt(account?.profit)} ${currency}`}
          color={(account?.profit as number) >= 0 ? "#00FF88" : "#FF4466"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Equity chart */}
        <div className="card card-glow">
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#6B7A9A", marginBottom: 16 }}>
            COURBE EQUITY
          </div>
          {equityCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equityCurve}>
                <defs>
                  <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#0D1421", border: "1px solid #1A2540", borderRadius: 8 }}
                  labelStyle={{ color: "#6B7A9A" }}
                  itemStyle={{ color: "#00D4FF" }}
                />
                <Area type="monotone" dataKey="equity" stroke="#00D4FF" fill="url(#eg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", color: "#6B7A9A", padding: "40px 0" }}>
              Pas encore de données equity
            </div>
          )}
        </div>

        {/* Recent signals */}
        <div className="card">
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#6B7A9A", marginBottom: 16 }}>
            SIGNAUX RÉCENTS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {signals.length === 0 && (
              <div style={{ color: "#6B7A9A", fontSize: "0.85rem" }}>Aucun signal</div>
            )}
            {signals.slice(0, 5).map((s: Signal, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  background: "#070B14",
                  borderRadius: 8,
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {String(s.symbol)} {" "}
                  <span style={{ color: s.action === "buy" ? "#00FF88" : "#FF4466" }}>
                    {String(s.action).toUpperCase()}
                  </span>
                </span>
                <span className={s.status === "executed" ? "badge-green" : s.status === "rejected" ? "badge-red" : "badge-cyan"}>
                  {String(s.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open positions */}
      <div className="card">
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#6B7A9A", marginBottom: 16 }}>
          POSITIONS OUVERTES
          {positions.length > 0 && (
            <span className="badge-cyan" style={{ marginLeft: 8 }}>
              {positions.length}
            </span>
          )}
        </div>
        {positions.length === 0 ? (
          <div style={{ color: "#6B7A9A", fontSize: "0.875rem" }}>Aucune position ouverte</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbole</th>
                <th>Type</th>
                <th>Volume</th>
                <th>Prix ouv.</th>
                <th>Prix act.</th>
                <th>SL</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p: Position, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{String(p.symbol)}</td>
                  <td>
                    <span className={p.type === "buy" ? "badge-green" : "badge-red"}>
                      {String(p.type).toUpperCase()}
                    </span>
                  </td>
                  <td className="mono">{String(p.volume)}</td>
                  <td className="mono">{Number(p.open_price).toFixed(5)}</td>
                  <td className="mono">{Number(p.current_price).toFixed(5)}</td>
                  <td className="mono">{Number(p.sl).toFixed(5)}</td>
                  <td className={`mono ${Number(p.profit) >= 0 ? "profit" : "loss"}`}>
                    {Number(p.profit).toFixed(2)}
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

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7A9A", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: "1.4rem", fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}

function ServiceDot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#6B7A9A" }}>
      <div
        className={ok ? "pulse" : ""}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: ok ? "#00FF88" : "#FF4466",
        }}
      />
      {label}
    </div>
  );
}
