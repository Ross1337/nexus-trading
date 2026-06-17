"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Settings2, RefreshCw, Play, Square, Cpu, HardDrive, Clock, Wifi } from "lucide-react";

interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "error";
  uptime: string;
  lastCheck: string;
  icon: React.ReactNode;
}

function formatUptime(startMs: number) {
  const diff = Date.now() - startMs;
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60) % 60;
  const h = Math.floor(s / 3600) % 24;
  const d = Math.floor(s / 86400);
  if (d > 0) return `${d}j ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatAgo(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 5) return "a l'instant";
  if (s < 60) return `il y a ${s}s`;
  return `il y a ${Math.floor(s / 60)}m`;
}

const recentLogs: { time: string; level: string; message: string; service: string }[] = [];

export default function AdminPage() {
  const [restarting, setRestarting] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [startTime] = useState(Date.now());
  const [, setTick] = useState(0);

  const checkServices = useCallback(async () => {
    const results: ServiceStatus[] = [];

    // Check API
    try {
      const res = await fetch(`/api/health`, { signal: AbortSignal.timeout(3000) });
      results.push({
        name: "API Backend",
        status: res.ok ? "running" : "error",
        uptime: formatUptime(startTime),
        lastCheck: formatAgo(Date.now()),
        icon: <Wifi className="h-4 w-4" />,
      });
    } catch {
      results.push({ name: "API Backend", status: "stopped", uptime: "-", lastCheck: formatAgo(Date.now()), icon: <Wifi className="h-4 w-4" /> });
    }

    // Check MT5 (via account file)
    try {
      const res = await fetch(`/api/mt5/account`, { signal: AbortSignal.timeout(3000) });
      const ok = res.ok;
      const data = ok ? await res.json() : null;
      results.push({
        name: "MT5 Connector",
        status: ok && data?.login ? "running" : "stopped",
        uptime: ok && data?.login ? formatUptime(startTime) : "-",
        lastCheck: formatAgo(Date.now()),
        icon: <Cpu className="h-4 w-4" />,
      });
    } catch {
      results.push({ name: "MT5 Connector", status: "stopped", uptime: "-", lastCheck: formatAgo(Date.now()), icon: <Cpu className="h-4 w-4" /> });
    }

    // Check TradingView Webhook (via recent signals)
    try {
      const res = await fetch(`/api/signals/`, { signal: AbortSignal.timeout(3000) });
      const data = res.ok ? await res.json() : [];
      const hasRecent = Array.isArray(data) && data.length > 0;
      results.push({
        name: "TradingView Webhook",
        status: hasRecent ? "running" : "stopped",
        uptime: hasRecent ? "Signaux recus" : "En attente",
        lastCheck: formatAgo(Date.now()),
        icon: <Play className="h-4 w-4" />,
      });
    } catch {
      results.push({ name: "TradingView Webhook", status: "stopped", uptime: "-", lastCheck: formatAgo(Date.now()), icon: <Play className="h-4 w-4" /> });
    }

    // Check WebSocket
    results.push({
      name: "WebSocket Server",
      status: results[0]?.status === "running" ? "running" : "stopped",
      uptime: results[0]?.status === "running" ? formatUptime(startTime) : "-",
      lastCheck: formatAgo(Date.now()),
      icon: <Wifi className="h-4 w-4" />,
    });

    setServices(results);
  }, [startTime]);

  useEffect(() => {
    checkServices();
    const interval = setInterval(() => {
      checkServices();
      setTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [checkServices]);

  const handleRestart = (service: string) => {
    setRestarting(service);
    setTimeout(() => setRestarting(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="text-muted-foreground">Gestion des services et monitoring systeme</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleRestart("all")}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className={`h-4 w-4 ${restarting === "all" ? "animate-spin" : ""}`} />
            Redemarrer tout
          </button>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="CPU"
          value="--"
          subtitle="Aucune donnee"
          icon={<Cpu className="h-5 w-5" />}
        />
        <StatCard
          title="Memoire"
          value="--"
          subtitle="Aucune donnee"
          icon={<HardDrive className="h-5 w-5" />}
        />
        <StatCard
          title="Uptime"
          value="--"
          subtitle="Aucune donnee"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Requetes API"
          value="0"
          subtitle="Aujourd'hui"
          icon={<Wifi className="h-5 w-5" />}
        />
      </div>

      {/* Service Status */}
      <Card>
        <CardTitle className="mb-4">Statut des Services</CardTitle>
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    service.status === "running"
                      ? "bg-success/20 text-success"
                      : service.status === "error"
                      ? "bg-danger/20 text-danger"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {service.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">Uptime: {service.uptime}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge
                  variant={
                    service.status === "running"
                      ? "success"
                      : service.status === "error"
                      ? "danger"
                      : "muted"
                  }
                >
                  {service.status === "running" ? "En cours" : service.status === "error" ? "Erreur" : "Arrete"}
                </Badge>
                <span className="text-xs text-muted-foreground">{service.lastCheck}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleRestart(service.name)}
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Redemarrer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${restarting === service.name ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Arreter"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardTitle className="mb-4">Actions Rapides</CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted">
            <RefreshCw className="h-4 w-4 text-primary" />
            Redemarrer le bot
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted">
            <Settings2 className="h-4 w-4 text-warning" />
            Synchroniser les comptes
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted">
            <HardDrive className="h-4 w-4 text-accent" />
            Exporter les logs
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted">
            <Square className="h-4 w-4 text-danger" />
            Fermer toutes les positions
          </button>
        </div>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardTitle className="mb-4">Logs Recents</CardTitle>
        <div className="space-y-1 max-h-[400px] overflow-y-auto font-mono text-xs">
          {recentLogs.length > 0 ? (
            recentLogs.map((log, i) => (
              <div
                key={i}
                className="flex gap-3 rounded px-3 py-1.5 hover:bg-muted/50"
              >
                <span className="text-muted-foreground">{log.time}</span>
                <span
                  className={`w-12 font-semibold ${
                    log.level === "ERROR"
                      ? "text-danger"
                      : log.level === "WARN"
                      ? "text-warning"
                      : "text-muted-foreground"
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-muted-foreground">[{log.service}]</span>
                <span className="text-foreground">{log.message}</span>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun log disponible</p>
          )}
        </div>
      </Card>
    </div>
  );
}
