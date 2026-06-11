"use client";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";

export default function TelegramPage() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    if (!message.trim()) return;
    const r = await api.sendTelegram(message) as { ok: boolean };
    setResult(r.ok ? "✅ Message envoyé" : "❌ Erreur d'envoi");
    setMessage("");
  }

  return (
    <DashboardLayout>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Configuration Telegram</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Envoyer un message test</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Votre message Telegram..."
            rows={4}
            style={{ width: "100%", marginBottom: 12, resize: "vertical" }}
          />
          <button className="btn-primary" onClick={send}>Envoyer</button>
          {result && <div style={{ marginTop: 10, color: result.startsWith("✅") ? "#00FF88" : "#FF4466" }}>{result}</div>}
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Configuration</div>
          <div style={{ fontSize: "0.875rem", color: "#6B7A9A", lineHeight: 1.8 }}>
            <p>Les clés de configuration sont gérées via le fichier <code style={{ color: "#00D4FF" }}>.env</code>:</p>
            <ul style={{ paddingLeft: 20 }}>
              <li><code style={{ color: "#00D4FF" }}>TELEGRAM_BOT_TOKEN</code> — Token du bot</li>
              <li><code style={{ color: "#00D4FF" }}>TELEGRAM_CHAT_ID</code> — Chat ID destination</li>
            </ul>
            <p style={{ marginTop: 16 }}>Alertes automatiques configurées:</p>
            <ul style={{ paddingLeft: 20 }}>
              <li>🔔 Signal reçu</li>
              <li>✅ Trade exécuté</li>
              <li>💰 Trade fermé</li>
              <li>⛔ Signal rejeté</li>
              <li>🚨 Service DOWN</li>
              <li>✅ Service recovery</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
