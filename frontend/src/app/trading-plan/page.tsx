"use client";
import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { Shield, Clock, Target, TrendingUp, Building2 } from "lucide-react";

const PROPFIRM_PRESETS: Record<string, { label: string; dailyLoss: number; totalDD: number; profitTarget: number; minDays: number }> = {
  none: { label: "Aucune (compte perso)", dailyLoss: 10, totalDD: 20, profitTarget: 0, minDays: 0 },
  ftmo: { label: "FTMO Challenge", dailyLoss: 5, totalDD: 10, profitTarget: 10, minDays: 4 },
  the5ers: { label: "The5%ers", dailyLoss: 4, totalDD: 6, profitTarget: 8, minDays: 3 },
  fundednext: { label: "FundedNext", dailyLoss: 5, totalDD: 10, profitTarget: 10, minDays: 5 },
  custom: { label: "Custom", dailyLoss: 5, totalDD: 10, profitTarget: 10, minDays: 0 },
};

interface TradingPlanConfig {
  // Propfirm
  propfirmEnabled: boolean;
  propfirmPreset: string;
  propfirmDailyLoss: number;
  propfirmTotalDD: number;
  propfirmProfitTarget: number;
  propfirmMinDays: number;
  // Risk management
  maxRiskPerTrade: number;
  maxDailyDrawdown: number;
  maxWeeklyDrawdown: number;
  maxTotalDrawdown: number;
  maxPositions: number;
  maxTradesPerDay: number;
  // Trading hours
  tradingStartHour: string;
  tradingEndHour: string;
  tradeFriday: boolean;
  tradeNews: boolean;
  // Position management
  breakevenEnabled: boolean;
  breakevenPips: number;
  trailingStopEnabled: boolean;
  trailingStopType: string;
  trailingStopDistance: number;
  partialTPEnabled: boolean;
  partialTPLevels: { percent: number; closePercent: number }[];
}

const defaultConfig: TradingPlanConfig = {
  propfirmEnabled: false,
  propfirmPreset: "none",
  propfirmDailyLoss: 10,
  propfirmTotalDD: 20,
  propfirmProfitTarget: 0,
  propfirmMinDays: 0,
  maxRiskPerTrade: 1.0,
  maxDailyDrawdown: 4.0,
  maxWeeklyDrawdown: 8.0,
  maxTotalDrawdown: 10.0,
  maxPositions: 3,
  maxTradesPerDay: 5,
  tradingStartHour: "08:00",
  tradingEndHour: "20:00",
  tradeFriday: false,
  tradeNews: false,
  breakevenEnabled: true,
  breakevenPips: 15,
  trailingStopEnabled: true,
  trailingStopType: "atr",
  trailingStopDistance: 20,
  partialTPEnabled: true,
  partialTPLevels: [
    { percent: 50, closePercent: 50 },
    { percent: 100, closePercent: 30 },
  ],
};

function InputField({
  label, value, onChange, type = "number", suffix, min, max, step, disabled,
}: {
  label: string; value: string | number; onChange: (val: string) => void;
  type?: string; suffix?: string; min?: number; max?: number; step?: number; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          min={min} max={max} step={step} disabled={disabled}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export default function TradingPlanPage() {
  const [config, setConfig] = useState<TradingPlanConfig>(defaultConfig);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof TradingPlanConfig>(key: K, value: TradingPlanConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const applyPreset = (presetKey: string) => {
    const preset = PROPFIRM_PRESETS[presetKey];
    if (!preset) return;
    update("propfirmPreset", presetKey);
    if (presetKey !== "custom") {
      setConfig((prev) => ({
        ...prev,
        propfirmPreset: presetKey,
        propfirmDailyLoss: preset.dailyLoss,
        propfirmTotalDD: preset.totalDD,
        propfirmProfitTarget: preset.profitTarget,
        propfirmMinDays: preset.minDays,
        // Auto-adapt risk settings for propfirm safety
        maxDailyDrawdown: Math.min(prev.maxDailyDrawdown, preset.dailyLoss * 0.8),
        maxTotalDrawdown: Math.min(prev.maxTotalDrawdown, preset.totalDD * 0.8),
        maxRiskPerTrade: Math.min(prev.maxRiskPerTrade, preset.dailyLoss / 5),
      }));
      setSaved(false);
    }
  };

  const handleSave = () => {
    // TODO: call API PUT /api/trading-plan/
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isCustom = config.propfirmPreset === "custom";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan de Trading</h1>
          <p className="text-muted-foreground">Regles de risque, propfirm et gestion des positions</p>
        </div>
        <button
          onClick={handleSave}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {saved ? "Sauvegarde !" : "Sauvegarder"}
        </button>
      </div>

      {/* Propfirm Section */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-warning" />
          <CardTitle className="text-base font-semibold text-foreground">Mode Propfirm</CardTitle>
          <div className="ml-auto">
            <Toggle
              enabled={config.propfirmEnabled}
              onChange={(v) => {
                update("propfirmEnabled", v);
                if (!v) applyPreset("none");
              }}
              label=""
            />
          </div>
        </div>

        {config.propfirmEnabled && (
          <div className="space-y-4">
            {/* Preset selector */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(PROPFIRM_PRESETS).filter(([k]) => k !== "none").map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    config.propfirmPreset === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Propfirm limits */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InputField
                label="Perte journaliere max"
                value={config.propfirmDailyLoss}
                onChange={(v) => { update("propfirmDailyLoss", parseFloat(v) || 0); update("propfirmPreset", "custom"); }}
                suffix="%" min={1} max={20} step={0.5}
                disabled={!isCustom && config.propfirmPreset !== "custom"}
              />
              <InputField
                label="Drawdown total max"
                value={config.propfirmTotalDD}
                onChange={(v) => { update("propfirmTotalDD", parseFloat(v) || 0); update("propfirmPreset", "custom"); }}
                suffix="%" min={1} max={30} step={0.5}
                disabled={!isCustom && config.propfirmPreset !== "custom"}
              />
              <InputField
                label="Objectif de profit"
                value={config.propfirmProfitTarget}
                onChange={(v) => { update("propfirmProfitTarget", parseFloat(v) || 0); update("propfirmPreset", "custom"); }}
                suffix="%" min={0} max={50} step={0.5}
                disabled={!isCustom && config.propfirmPreset !== "custom"}
              />
              <InputField
                label="Jours de trading min"
                value={config.propfirmMinDays}
                onChange={(v) => { update("propfirmMinDays", parseInt(v) || 0); update("propfirmPreset", "custom"); }}
                min={0} max={30} step={1}
                disabled={!isCustom && config.propfirmPreset !== "custom"}
              />
            </div>

            {/* Safety notice */}
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
              <p className="text-sm text-warning">
                <strong>Mode Propfirm actif</strong> — Les limites de risk management ci-dessous sont automatiquement
                ajustees a 80% des limites propfirm pour garder une marge de securite.
                Le bot arretera automatiquement de trader si une limite est atteinte.
              </p>
            </div>
          </div>
        )}

        {!config.propfirmEnabled && (
          <p className="text-sm text-muted-foreground">
            Activez le mode propfirm si votre compte est un challenge ou un compte funded.
            Les limites de drawdown et risk seront automatiquement ajustees.
          </p>
        )}
      </Card>

      {/* Risk Management */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold text-foreground">Gestion du Risque</CardTitle>
          {config.propfirmEnabled && (
            <Badge variant="warning">Adapte au propfirm</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <InputField
            label="Risque max par trade"
            value={config.maxRiskPerTrade}
            onChange={(v) => update("maxRiskPerTrade", parseFloat(v) || 0)}
            suffix="%" min={0.1} max={10} step={0.1}
          />
          <InputField
            label="Drawdown journalier max"
            value={config.maxDailyDrawdown}
            onChange={(v) => update("maxDailyDrawdown", parseFloat(v) || 0)}
            suffix="%" min={1} max={20} step={0.5}
          />
          <InputField
            label="Drawdown hebdomadaire max"
            value={config.maxWeeklyDrawdown}
            onChange={(v) => update("maxWeeklyDrawdown", parseFloat(v) || 0)}
            suffix="%" min={1} max={30} step={0.5}
          />
          <InputField
            label="Drawdown total max"
            value={config.maxTotalDrawdown}
            onChange={(v) => update("maxTotalDrawdown", parseFloat(v) || 0)}
            suffix="%" min={1} max={50} step={0.5}
          />
          <InputField
            label="Positions simultanees max"
            value={config.maxPositions}
            onChange={(v) => update("maxPositions", parseInt(v) || 1)}
            min={1} max={20} step={1}
          />
          <InputField
            label="Trades par jour max"
            value={config.maxTradesPerDay}
            onChange={(v) => update("maxTradesPerDay", parseInt(v) || 1)}
            min={1} max={50} step={1}
          />
        </div>
      </Card>

      {/* Trading Hours */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          <CardTitle className="text-base font-semibold text-foreground">Heures de Trading</CardTitle>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <InputField label="Heure de debut" value={config.tradingStartHour} onChange={(v) => update("tradingStartHour", v)} type="time" />
          <InputField label="Heure de fin" value={config.tradingEndHour} onChange={(v) => update("tradingEndHour", v)} type="time" />
          <div className="flex flex-col gap-3 pt-6">
            <Toggle enabled={config.tradeFriday} onChange={(v) => update("tradeFriday", v)} label="Trader le vendredi" />
          </div>
          <div className="flex flex-col gap-3 pt-6">
            <Toggle enabled={config.tradeNews} onChange={(v) => update("tradeNews", v)} label="Trader pendant les news" />
          </div>
        </div>
      </Card>

      {/* Breakeven */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-success" />
          <CardTitle className="text-base font-semibold text-foreground">Breakeven</CardTitle>
        </div>
        <div className="space-y-4">
          <Toggle enabled={config.breakevenEnabled} onChange={(v) => update("breakevenEnabled", v)} label="Activer le breakeven automatique" />
          {config.breakevenEnabled && (
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <InputField label="Pips avant breakeven" value={config.breakevenPips} onChange={(v) => update("breakevenPips", parseInt(v) || 0)} suffix="pips" min={5} max={100} step={1} />
            </div>
          )}
        </div>
      </Card>

      {/* Trailing Stop */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" />
          <CardTitle className="text-base font-semibold text-foreground">Trailing Stop</CardTitle>
        </div>
        <div className="space-y-4">
          <Toggle enabled={config.trailingStopEnabled} onChange={(v) => update("trailingStopEnabled", v)} label="Activer le trailing stop" />
          {config.trailingStopEnabled && (
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Type</label>
                <select
                  value={config.trailingStopType}
                  onChange={(e) => update("trailingStopType", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="fixed">Fixe (pips)</option>
                  <option value="atr">ATR</option>
                  <option value="percent">Pourcentage</option>
                </select>
              </div>
              <InputField
                label="Distance"
                value={config.trailingStopDistance}
                onChange={(v) => update("trailingStopDistance", parseFloat(v) || 0)}
                suffix={config.trailingStopType === "percent" ? "%" : "pips"}
                min={1} max={200} step={1}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Partial TP */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-warning" />
          <CardTitle className="text-base font-semibold text-foreground">Take Profit Partiel</CardTitle>
        </div>
        <div className="space-y-4">
          <Toggle enabled={config.partialTPEnabled} onChange={(v) => update("partialTPEnabled", v)} label="Activer les TP partiels" />
          {config.partialTPEnabled && (
            <div className="mt-4 space-y-3">
              {config.partialTPLevels.map((level, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg bg-muted/50 px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Niveau {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">A</label>
                    <input type="number" value={level.percent}
                      onChange={(e) => { const levels = [...config.partialTPLevels]; levels[i] = { ...levels[i], percent: parseFloat(e.target.value) || 0 }; update("partialTPLevels", levels); }}
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                    />
                    <span className="text-xs text-muted-foreground">% du TP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Fermer</label>
                    <input type="number" value={level.closePercent}
                      onChange={(e) => { const levels = [...config.partialTPLevels]; levels[i] = { ...levels[i], closePercent: parseFloat(e.target.value) || 0 }; update("partialTPLevels", levels); }}
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                    />
                    <span className="text-xs text-muted-foreground">% de la position</span>
                  </div>
                  <button onClick={() => update("partialTPLevels", config.partialTPLevels.filter((_, idx) => idx !== i))}
                    className="ml-auto text-xs text-danger hover:text-danger/80">
                    Supprimer
                  </button>
                </div>
              ))}
              <button
                onClick={() => update("partialTPLevels", [...config.partialTPLevels, { percent: 75, closePercent: 20 }])}
                className="rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                + Ajouter un niveau
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
