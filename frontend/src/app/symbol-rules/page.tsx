"use client";

import { useEffect, useState, useCallback } from "react";
import { api, type SymbolRule } from "@/lib/api";
import { Settings2, Plus, Pencil, Trash2, X, Check, RefreshCw, Sparkles, Search } from "lucide-react";

export default function SymbolRulesPage() {
  const [rules, setRules] = useState<SymbolRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  // Test mapping inline
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<{ tv_symbol: string; broker_symbol: string; matched_pattern: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.getSymbolRules();
      setRules(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTest = async () => {
    if (!testInput.trim()) return;
    try {
      const r = await api.testSymbolMapping(testInput.trim());
      setTestResult(r);
    } catch (e) {
      alert(`Erreur: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleSeed = async () => {
    if (!confirm("Importer les aliases hardcodes Python en DB ? Les regles existantes ne seront pas ecrasees.")) return;
    try {
      const r = await api.seedSymbolRules();
      alert(`${r.added} regles importees (${r.total_in_python_dict} dans le code Python)`);
      await load();
    } catch (e) {
      alert(`Erreur: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const filtered = rules.filter(r =>
    !search || r.pattern.toLowerCase().includes(search.toLowerCase()) ||
    r.broker_symbol.toLowerCase().includes(search.toLowerCase()) ||
    (r.note || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Regles de mapping symboles</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Importer aliases Python
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle regle
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Mappe un nom TradingView vers le symbole reel envoye a MT5. Les regles user
        prioritaires sur les aliases hardcodes Python. Format pattern: <code className="px-1 rounded bg-muted">NASDAQ:GOOGL</code>,
        <code className="px-1 rounded bg-muted ml-1">EURONEXT:MC</code> ou simplement <code className="px-1 rounded bg-muted">AMZN</code>.
        Cache TTL 30s, modifications appliquees au prochain webhook.
      </p>

      {/* Test mapping inline */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" />
          Tester un mapping
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={testInput}
            onChange={e => setTestInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleTest()}
            placeholder="Ex: NASDAQ:GOOGL, EURONEXT:MC, BTCUSDT, OANDA:US30USD..."
            className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm font-mono"
          />
          <button
            onClick={handleTest}
            disabled={!testInput.trim()}
            className="rounded bg-primary text-primary-foreground px-4 py-1.5 text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            Tester
          </button>
        </div>
        {testResult && (
          <div className="mt-3 rounded bg-muted p-3 text-sm">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-muted-foreground">{testResult.tv_symbol}</span>
              <span>&rarr;</span>
              <span className="font-bold text-success">{testResult.broker_symbol}</span>
              {testResult.matched_pattern && (
                <span className="text-xs text-muted-foreground">
                  (regle DB: <code>{testResult.matched_pattern}</code>)
                </span>
              )}
              {!testResult.matched_pattern && (
                <span className="text-xs text-muted-foreground">(aucune regle DB ne match - alias Python ou comportement par defaut)</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher dans les regles (pattern, broker, note)..."
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
      />

      {error && (
        <div className="rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger">
          Erreur: {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2">Pattern TV</th>
              <th className="px-4 py-2">Symbole broker</th>
              <th className="px-4 py-2 text-center">Active</th>
              <th className="px-4 py-2">Note</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {creating && (
              <RuleForm
                onSubmit={async (data) => {
                  try {
                    await api.createSymbolRule(data);
                    setCreating(false);
                    await load();
                  } catch (e) {
                    alert(`Erreur: ${e instanceof Error ? e.message : String(e)}`);
                  }
                }}
                onCancel={() => setCreating(false)}
              />
            )}
            {loading && rules.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                {rules.length === 0 ? (
                  <>Aucune regle. <button onClick={handleSeed} className="text-primary underline">Importer les aliases Python</button> ou cree une regle.</>
                ) : "Aucune regle ne match la recherche."}
              </td></tr>
            ) : (
              filtered.map(rule => (
                editingId === rule.id ? (
                  <RuleForm
                    key={rule.id}
                    initial={rule}
                    onSubmit={async (data) => {
                      try {
                        await api.updateSymbolRule(rule.id, data);
                        setEditingId(null);
                        await load();
                      } catch (e) {
                        alert(`Erreur: ${e instanceof Error ? e.message : String(e)}`);
                      }
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <tr key={rule.id} className={`border-t border-border hover:bg-muted/30 ${!rule.enabled ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2 font-mono text-xs">{rule.pattern}</td>
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-primary">{rule.broker_symbol}</td>
                    <td className="px-4 py-2 text-center">
                      {rule.enabled ? <Check className="h-4 w-4 inline text-success" /> : <X className="h-4 w-4 inline text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-xs">{rule.note || ""}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setEditingId(rule.id)}
                          className="p-1 rounded hover:bg-muted"
                          title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Supprimer la regle ${rule.pattern} -> ${rule.broker_symbol} ?`)) return;
                            await api.deleteSymbolRule(rule.id);
                            await load();
                          }}
                          className="p-1 rounded hover:bg-danger/20 text-danger"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Total: {rules.length} regles ({rules.filter(r => r.enabled).length} actives, {rules.filter(r => !r.enabled).length} desactivees)
      </p>
    </div>
  );
}


// Composant inline pour creer/modifier une regle
function RuleForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: SymbolRule;
  onSubmit: (data: { pattern: string; broker_symbol: string; enabled: boolean; note?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [pattern, setPattern] = useState(initial?.pattern || "");
  const [brokerSymbol, setBrokerSymbol] = useState(initial?.broker_symbol || "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [note, setNote] = useState(initial?.note || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!pattern.trim() || !brokerSymbol.trim()) return;
    setSaving(true);
    await onSubmit({ pattern: pattern.trim(), broker_symbol: brokerSymbol.trim(), enabled, note: note.trim() || undefined });
    setSaving(false);
  };

  return (
    <tr className="border-t border-border bg-primary/5">
      <td className="px-4 py-2">
        <input
          type="text"
          value={pattern}
          onChange={e => setPattern(e.target.value.toUpperCase())}
          placeholder="NASDAQ:GOOGL"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono"
          autoFocus={!initial}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={brokerSymbol}
          onChange={e => setBrokerSymbol(e.target.value)}
          placeholder="GOOG"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono"
        />
      </td>
      <td className="px-4 py-2 text-center">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Commentaire optionnel"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !pattern.trim() || !brokerSymbol.trim()}
            className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-3 w-3 inline" />
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1 rounded border border-border text-xs hover:bg-muted"
          >
            <X className="h-3 w-3 inline" />
          </button>
        </div>
      </td>
    </tr>
  );
}
