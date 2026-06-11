"use client";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";

export default function TestSymbolsPage() {
  const [input, setInput] = useState("OANDA:EURUSD");
  const [result, setResult] = useState<{ input: string; output: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function test() {
    setLoading(true);
    try {
      const r = await api.testSymbol(input) as { input: string; output: string };
      setResult(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Test Normalisation Symboles</h1>
      <div className="card" style={{ maxWidth: 500 }}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Tester un symbole TradingView → MT5</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: OANDA:EURUSD, BTCUSDT, FX:GBPUSD"
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={test} disabled={loading}>
            {loading ? "..." : "Tester"}
          </button>
        </div>
        {result && (
          <div style={{ background: "#070B14", borderRadius: 10, padding: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "#6B7A9A", fontSize: "0.8rem" }}>Entrée:</span>
              <div className="mono" style={{ color: "#E8EDF5", marginTop: 2 }}>{result.input}</div>
            </div>
            <div style={{ fontSize: "1.5rem", color: "#6B7A9A", textAlign: "center" }}>↓</div>
            <div>
              <span style={{ color: "#6B7A9A", fontSize: "0.8rem" }}>Symbole MT5:</span>
              <div className="mono" style={{ color: "#00D4FF", fontSize: "1.2rem", fontWeight: 700, marginTop: 2 }}>
                {result.output}
              </div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 16, fontSize: "0.8rem", color: "#6B7A9A" }}>
          Exemples: OANDA:EURUSD, BTCUSDT, FX:GBPUSD, XAUUSD.PRO
        </div>
      </div>
    </DashboardLayout>
  );
}
