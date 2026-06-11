const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch("/api/auth/logout", { method: "POST" }),
  me: () => apiFetch<{ email: string; role: string }>("/api/auth/me"),

  // Health
  health: () => apiFetch<{ status: string; mt5_connector: boolean }>("/api/health"),

  // MT5
  mt5Account: () => apiFetch<Record<string, unknown>>("/api/mt5/account"),
  mt5Positions: () => apiFetch<unknown[]>("/api/mt5/positions"),
  mt5Price: (symbol: string) => apiFetch<{ bid: number; ask: number }>(`/api/mt5/price/${symbol}`),
  mt5OHLCV: (symbol: string, timeframe = "H1", count = 100) =>
    apiFetch<unknown[]>(`/api/mt5/ohlcv/${symbol}?timeframe=${timeframe}&count=${count}`),

  // Trades
  tradeHistory: (limit = 100, offset = 0) =>
    apiFetch<unknown[]>(`/api/trades/history?limit=${limit}&offset=${offset}`),
  positions: () => apiFetch<unknown[]>("/api/trades/positions"),
  mt5History: (days = 7) => apiFetch<unknown[]>(`/api/trades/mt5-history?days=${days}`),
  closeTrade: (ticket: string, lot?: number) =>
    apiFetch("/api/trades/close", { method: "POST", body: JSON.stringify({ ticket, lot }) }),

  // Signals
  signals: (limit = 50) => apiFetch<unknown[]>(`/api/signals/?limit=${limit}`),

  // Strategies
  strategies: () => apiFetch<unknown[]>("/api/strategies/"),
  createStrategy: (data: unknown) =>
    apiFetch("/api/strategies/", { method: "POST", body: JSON.stringify(data) }),
  updateStrategy: (id: number, data: unknown) =>
    apiFetch(`/api/strategies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStrategy: (id: number) =>
    apiFetch(`/api/strategies/${id}`, { method: "DELETE" }),

  // Performance
  performanceSummary: () => apiFetch<Record<string, unknown>>("/api/performance/summary"),
  performanceByStrategy: () => apiFetch<unknown[]>("/api/performance/by-strategy"),
  equityCurve: () => apiFetch<unknown[]>("/api/performance/equity-curve"),

  // Accounts
  accounts: () => apiFetch<unknown[]>("/api/accounts/"),
  createAccount: (data: unknown) =>
    apiFetch("/api/accounts/", { method: "POST", body: JSON.stringify(data) }),
  updateAccount: (id: number, data: unknown) =>
    apiFetch(`/api/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAccount: (id: number) =>
    apiFetch(`/api/accounts/${id}`, { method: "DELETE" }),

  // Trading plan
  tradingPlan: () => apiFetch<Record<string, unknown>>("/api/trading-plan/"),
  updateTradingPlan: (data: unknown) =>
    apiFetch("/api/trading-plan/", { method: "PUT", body: JSON.stringify(data) }),

  // Symbol rules
  symbolRules: () => apiFetch<unknown[]>("/api/symbol-rules/"),
  createSymbolRule: (data: unknown) =>
    apiFetch("/api/symbol-rules/", { method: "POST", body: JSON.stringify(data) }),
  updateSymbolRule: (id: number, data: unknown) =>
    apiFetch(`/api/symbol-rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSymbolRule: (id: number) =>
    apiFetch(`/api/symbol-rules/${id}`, { method: "DELETE" }),
  testSymbol: (symbol: string) =>
    apiFetch("/api/symbol-rules/test", { method: "POST", body: JSON.stringify({ symbol }) }),
  seedRules: () => apiFetch("/api/symbol-rules/seed", { method: "POST" }),

  // Webhook logs
  webhookLogs: (limit = 100) => apiFetch<unknown[]>(`/api/webhook-logs/?limit=${limit}`),
  clearWebhookLogs: () => apiFetch("/api/webhook-logs/", { method: "DELETE" }),

  // Debug
  debugStatus: () => apiFetch<Record<string, unknown>>("/api/debug/status"),
  debugLogs: (service: string, lines = 50) =>
    apiFetch<{ lines: string[] }>(`/api/debug/logs/${service}?lines=${lines}`),
  testWebhook: (data: unknown) =>
    apiFetch("/api/debug/test-webhook", { method: "POST", body: JSON.stringify(data) }),

  // Telegram
  sendTelegram: (message: string) =>
    apiFetch("/api/telegram/send", { method: "POST", body: JSON.stringify({ message }) }),

  // Orders
  placeOrder: (data: unknown) =>
    apiFetch("/api/orders/", { method: "POST", body: JSON.stringify(data) }),
};
