"use client";
import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Bell, Plug, Shield, Globe } from "lucide-react";

interface SettingsConfig {
  // Notifications
  telegramEnabled: boolean;
  telegramToken: string;
  telegramChatId: string;
  discordEnabled: boolean;
  discordWebhook: string;
  notifyOnSignal: boolean;
  notifyOnTrade: boolean;
  notifyOnError: boolean;
  notifyOnDrawdown: boolean;
  // API
  apiHost: string;
  apiPort: number;
  wsEnabled: boolean;
  corsOrigins: string;
  // Account
  mt5Path: string;
  defaultLeverage: number;
  defaultSymbols: string;
}

const defaultSettings: SettingsConfig = {
  telegramEnabled: true,
  telegramToken: "",
  telegramChatId: "",
  discordEnabled: false,
  discordWebhook: "",
  notifyOnSignal: true,
  notifyOnTrade: true,
  notifyOnError: true,
  notifyOnDrawdown: true,
  apiHost: "0.0.0.0",
  apiPort: 8000,
  wsEnabled: true,
  corsOrigins: "*",
  mt5Path: "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
  defaultLeverage: 100,
  defaultSymbols: "EURUSD,GBPUSD,USDJPY,XAUUSD",
};

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      />
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsConfig>(defaultSettings);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof SettingsConfig>(key: K, value: SettingsConfig[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parametres</h1>
          <p className="text-muted-foreground">Configuration des notifications, API et comptes</p>
        </div>
        <button
          onClick={handleSave}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {saved ? "Sauvegarde !" : "Sauvegarder"}
        </button>
      </div>

      {/* Notifications - Telegram */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold text-foreground">Notifications Telegram</CardTitle>
        </div>
        <div className="space-y-4">
          <Toggle
            enabled={settings.telegramEnabled}
            onChange={(v) => update("telegramEnabled", v)}
            label="Activer les notifications Telegram"
          />
          {settings.telegramEnabled && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput
                label="Bot Token"
                value={settings.telegramToken}
                onChange={(v) => update("telegramToken", v)}
                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
              />
              <TextInput
                label="Chat ID"
                value={settings.telegramChatId}
                onChange={(v) => update("telegramChatId", v)}
                placeholder="-1001234567890"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Notifications - Discord */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-accent" />
          <CardTitle className="text-base font-semibold text-foreground">Notifications Discord</CardTitle>
        </div>
        <div className="space-y-4">
          <Toggle
            enabled={settings.discordEnabled}
            onChange={(v) => update("discordEnabled", v)}
            label="Activer les notifications Discord"
          />
          {settings.discordEnabled && (
            <div className="mt-4">
              <TextInput
                label="Webhook URL"
                value={settings.discordWebhook}
                onChange={(v) => update("discordWebhook", v)}
                placeholder="https://discord.com/api/webhooks/..."
              />
            </div>
          )}
        </div>
      </Card>

      {/* Notification Events */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-warning" />
          <CardTitle className="text-base font-semibold text-foreground">Evenements de Notification</CardTitle>
        </div>
        <div className="space-y-3">
          <Toggle
            enabled={settings.notifyOnSignal}
            onChange={(v) => update("notifyOnSignal", v)}
            label="Nouveau signal detecte"
          />
          <Toggle
            enabled={settings.notifyOnTrade}
            onChange={(v) => update("notifyOnTrade", v)}
            label="Trade ouvert / ferme"
          />
          <Toggle
            enabled={settings.notifyOnError}
            onChange={(v) => update("notifyOnError", v)}
            label="Erreurs systeme"
          />
          <Toggle
            enabled={settings.notifyOnDrawdown}
            onChange={(v) => update("notifyOnDrawdown", v)}
            label="Alerte drawdown"
          />
        </div>
      </Card>

      {/* API Configuration */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Plug className="h-5 w-5 text-success" />
          <CardTitle className="text-base font-semibold text-foreground">Configuration API</CardTitle>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput
            label="Host"
            value={settings.apiHost}
            onChange={(v) => update("apiHost", v)}
          />
          <TextInput
            label="Port"
            value={settings.apiPort}
            onChange={(v) => update("apiPort", parseInt(v) || 8000)}
            type="number"
          />
          <div className="pt-6">
            <Toggle
              enabled={settings.wsEnabled}
              onChange={(v) => update("wsEnabled", v)}
              label="WebSocket actif"
            />
          </div>
          <TextInput
            label="CORS Origins"
            value={settings.corsOrigins}
            onChange={(v) => update("corsOrigins", v)}
          />
        </div>
      </Card>

      {/* Account Management */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold text-foreground">Gestion des Comptes</CardTitle>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextInput
            label="Chemin MT5"
            value={settings.mt5Path}
            onChange={(v) => update("mt5Path", v)}
          />
          <TextInput
            label="Leverage par defaut"
            value={settings.defaultLeverage}
            onChange={(v) => update("defaultLeverage", parseInt(v) || 100)}
            type="number"
          />
          <TextInput
            label="Symboles par defaut"
            value={settings.defaultSymbols}
            onChange={(v) => update("defaultSymbols", v)}
            placeholder="EURUSD,GBPUSD,..."
          />
        </div>
      </Card>
    </div>
  );
}
