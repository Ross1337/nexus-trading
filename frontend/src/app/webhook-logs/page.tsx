"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import {
  api,
  type WebhookLogSummary,
  type WebhookLogDetail,
  type WebhookLogStats,
} from "@/lib/api";
import { ChevronDown, ChevronRight, RefreshCw, Trash2, Webhook } from "lucide-react";

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-success";
  if (status === 401 || status === 429) return "text-yellow-500";
  if (status >= 400) return "text-danger";
  return "text-muted-foreground";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function WebhookLogsPage() {
  const [logs, setLogs] = useState<WebhookLogSummary[]>([]);
  const [stats, setStats] = useState<WebhookLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [details, setDetails] = useState<Map<number, WebhookLogDetail>>(new Map());
  const [filter, setFilter] = useState<"all" | "success" | "errors">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filter === "success") params.set("status_code", "200");
      const [logsData, statsData] = await Promise.all([
        api.getWebhookLogs(params.toString()),
        api.getWebhookLogStats(24),
      ]);
      // Filter "errors" client-side because backend filter is exact match
      const filtered =
        filter === "errors"
          ? logsData.filter((l) => l.status_code >= 400)
          : logsData;
      setLogs(filtered);
      setStats(statsData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const toggleExpand = async (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!details.has(id)) {
        try {
          const detail = await api.getWebhookLog(id);
          setDetails((prev) => new Map(prev).set(id, detail));
        } catch (e) {
          console.error(e);
        }
      }
    }
    setExpanded(next);
  };

  const handleClear = async () => {
    if (!confirm("Supprimer tous les logs webhook ? (irreversible)")) return;
    try {
      const r = await api.clearWebhookLogs(0);
      alert(`${r.deleted} logs supprimes`);
      await load();
    } catch (e) {
      alert("Erreur: " + String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Webhook className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Webhook Logs</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4"
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-sm text-danger hover:bg-danger/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Purge
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Dernieres 24h</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Succes (2xx)</p>
            <p className="mt-1 text-2xl font-bold text-success">{stats.success}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Erreurs (4xx/5xx)</p>
            <p className="mt-1 text-2xl font-bold text-danger">{stats.rejected}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">IPs uniques (24h)</p>
            <p className="mt-1 text-2xl font-bold">{stats.top_ips.length}</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "success", "errors"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card hover:bg-muted"
            }`}
          >
            {f === "all" ? "Tous" : f === "success" ? "Succes" : "Erreurs"}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger">
          Erreur: {error}
        </div>
      )}

      {/* Logs table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2 w-8"></th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">Endpoint</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Symbol</th>
              <th className="px-4 py-2">Direction</th>
              <th className="px-4 py-2">Signal</th>
              <th className="px-4 py-2">Latence</th>
              <th className="px-4 py-2">Erreur</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  Chargement...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  Aucun log webhook pour l&apos;instant. Quand TradingView enverra une alerte, elle apparaitra ici.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <Fragment key={log.id}>
                  <tr
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <td className="px-4 py-2">
                      {expanded.has(log.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{log.client_ip}</td>
                    <td className="px-4 py-2 font-mono text-xs">{log.endpoint}</td>
                    <td className={`px-4 py-2 font-mono font-semibold ${statusColor(log.status_code)}`}>
                      {log.status_code}
                    </td>
                    <td className="px-4 py-2">{log.symbol || "-"}</td>
                    <td className="px-4 py-2">
                      {log.direction ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                            log.direction === "BUY"
                              ? "bg-success/20 text-success"
                              : "bg-danger/20 text-danger"
                          }`}
                        >
                          {log.direction}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {log.signal_id ? `#${log.signal_id}` : "-"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {log.processing_time_ms != null ? `${log.processing_time_ms}ms` : "-"}
                    </td>
                    <td className="px-4 py-2 text-xs text-danger truncate max-w-xs">
                      {log.error_message || ""}
                    </td>
                  </tr>
                  {expanded.has(log.id) && (
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={10} className="px-4 py-4">
                        {details.has(log.id) ? (
                          <LogDetailPanel log={details.get(log.id)!} />
                        ) : (
                          <p className="text-sm text-muted-foreground">Chargement...</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogDetailPanel({ log }: { log: WebhookLogDetail }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div>
        <p className="mb-1 font-semibold text-muted-foreground">Headers</p>
        <pre className="overflow-auto rounded bg-background p-3 text-xs max-h-48">
          {JSON.stringify(log.headers, null, 2)}
        </pre>
      </div>
      <div>
        <p className="mb-1 font-semibold text-muted-foreground">Body parse (secret masque)</p>
        <pre className="overflow-auto rounded bg-background p-3 text-xs max-h-48">
          {log.body_parsed ? JSON.stringify(log.body_parsed, null, 2) : log.body_raw || "(vide)"}
        </pre>
      </div>
      <div>
        <p className="mb-1 font-semibold text-muted-foreground">Body brut</p>
        <pre className="overflow-auto rounded bg-background p-3 text-xs max-h-32">
          {log.body_raw || "(vide)"}
        </pre>
      </div>
      <div>
        <p className="mb-1 font-semibold text-muted-foreground">Reponse</p>
        <pre className="overflow-auto rounded bg-background p-3 text-xs max-h-32">
          {log.response ? JSON.stringify(log.response, null, 2) : log.error_message || "(vide)"}
        </pre>
      </div>
    </div>
  );
}
