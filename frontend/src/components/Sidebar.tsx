"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Dashboard", icon: "⬡" },
  { href: "/trades", label: "Trades", icon: "◈" },
  { href: "/strategies", label: "Stratégies", icon: "◇" },
  { href: "/analytics", label: "Analytics", icon: "◉" },
  { href: "/trading-plan", label: "Plan Trading", icon: "◫" },
  { href: "/webhook-logs", label: "Webhooks", icon: "◎" },
  { href: "/symbol-rules", label: "Symboles", icon: "◊" },
  { href: "/test-symbols", label: "Test Symboles", icon: "◬" },
  { href: "/telegram", label: "Telegram", icon: "◐" },
  { href: "/debug", label: "Debug", icon: "◑" },
  { href: "/settings", label: "Paramètres", icon: "◒" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside
      style={{
        width: 220,
        minHeight: "100vh",
        background: "#080D18",
        borderRight: "1px solid #1A2540",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
      }}
    >
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #1A2540" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #00D4FF, #0066FF)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            N
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#E8EDF5" }}>NEXUS</div>
            <div style={{ fontSize: "0.7rem", color: "#6B7A9A" }}>Trading Bot V2</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "8px 0" }}>
        {NAV.map((item) => {
          const active = path === item.href || (item.href !== "/" && path.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                color: active ? "#00D4FF" : "#6B7A9A",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 400,
                background: active ? "rgba(0,212,255,0.07)" : "transparent",
                borderRight: active ? "2px solid #00D4FF" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "1rem", width: 20, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: "16px 20px", borderTop: "1px solid #1A2540" }}>
        <div style={{ fontSize: "0.7rem", color: "#6B7A9A" }}>Port API: 8001 | MT5: 5002</div>
      </div>
    </aside>
  );
}
