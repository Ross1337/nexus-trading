"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";

export default function DebugPage() {
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<{ [k: string]: string[] }>({});
  const [testResult, setTestResult] = useState<unknown>(null);
  const [activeLog, setActiveLog] = useState("api");

  useEffect(() => {
    api.debugStatus().then(setStatus).catch(() => {});
  }, []);

  async function loadLogs(service: string) {
    setActiveLog(service);
    const r = await api.debugLogs(service, 50);
    setLogs((prev) => ({ ...prev, [service]: r.lines }));
  }

  async function runTestWebhook() {
    const r = await api.testWebhook({ symbol: "EURUSD", action: "buy", lot: 0.01, sl: 1.08, tp: 1.09 });
    setTestResult(r);
  }

  const mt5 = status.mt5_connector as Record<string, unknown> | undefined;
  const sys = status.system as Record<string, unknown> | undefined;

  return (
    <DashboardLayout>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Debug & Monitoring</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>MT5 Connector</div>
          {mt5 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.875rem" }}>
              <InfoRow label="Status" value={String(mt5.status)} color={mt5.status === "ok" ? "#00FF88" : "#FF4466"} />
              <InfoRow label="MT5 Connected" value={mt5.mt5_connected ? "✅" : "❌"} />
              <InfoRow label="Terminal Running" value={mt5.terminal_running ? "✅" : "❌"} />
              <InfoRow label="BTC Tick OK" value={mt5.btc_tick_ok ? "✅" : "❌"} />
              <InfoRow label="Login" value={String(mt5.login || "—")} />
              <InfoRow label="Server" value={String(mt5.server || "—")} />
              <InfoRow label="Uptime" value={`${mt5.uptime_seconds}s`} />
            </div>
          ) : (
            <div style={{ color: "#FF4466" }}>MT5 Connector non disponible</div>
          )}
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Système</div>
          {sys ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <InfoRow label="CPU" value={`${sys.cpu_percent}%`} />
              <InfoRow label="RAM" value={`${sys.memory_percent}%`} />
              <InfoRow label="Disk" value={`${sys.disk_percent}%`} />
            </div>
          ) : (
            <div style={{ color: "#6B7A9A" }}>N/A</div>
          )}
          <div style={{ marginTop: 20 }}>
            <button className="btn-ghost" style={{ width: "100%", marginBottom: 8 }} onClick={() => api.debugStatus().then(setStatus)}>
              Rafraîchir statut
            </button>
            <button className="btn-ghost" style={{ width: "100%" }} onClick={runTestWebhook}>
              Tester webhook EURUSD BUY
            </button>
            {testResult && (
              <div style={{ marginTop: 10, background: "#070B14", borderRadius: 8, padding: 10, fontSize: "0.8rem", fontFamily: "monospace" }}>
                {JSON.stringify(testResult, null, 2)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Logs</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["api", "mt5", "telegram"].map((s) => (
            <button key={s} className={activeLog === s ? "btn-primary" : "btn-ghost"} style={{ padding: "6px 14px" }} onClick={() => loadLogs(s)}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ background: "#070B14", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: "0.78rem", maxHeight: 400, overflowY: "auto", color: "#B0BED0" }}>
          {logs[activeLog]?.length ? (
            logs[activeLog].map((line, i) => <div key={i}>{line}</div>)
          ) : (
            <div style={{ color: "#6B7A9A" }}>Cliquer sur un service pour charger les logs</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#6B7A9A" }}>{label}</span>
      <span className="mono" style={{ color: color || "#E8EDF5" }}>{value}</span>
    </div>
  );
}
