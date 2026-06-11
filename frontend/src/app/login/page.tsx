"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.login(email, password);
      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#070B14",
      }}
    >
      <div className="card" style={{ width: 380, padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #00D4FF, #0066FF)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 800,
              color: "#fff",
              marginBottom: 16,
            }}
          >
            N
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.4rem", color: "#E8EDF5" }}>NEXUS Trading</div>
          <div style={{ fontSize: "0.85rem", color: "#6B7A9A", marginTop: 4 }}>
            Connectez-vous à votre dashboard
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: "0.8rem", color: "#6B7A9A", display: "block", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              style={{ width: "100%" }}
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: "0.8rem", color: "#6B7A9A", display: "block", marginBottom: 6 }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: "100%" }}
              required
            />
          </div>
          {error && (
            <div
              style={{
                background: "rgba(255,68,102,0.1)",
                border: "1px solid rgba(255,68,102,0.3)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#FF4466",
                fontSize: "0.85rem",
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", padding: "12px", fontSize: "0.95rem" }}
            disabled={loading}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
