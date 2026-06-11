const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type Row = Record<string, unknown>;

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
    apiFetch<Row>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch<Row>("/api/auth/logout", { method: "POST" }),
  me: () => apiFetch<{ email: string; role: string }>("/api/auth/me"),

  // Health
  health: () => apiFetch<{ status: string; mt5_connector: boolean }>("/api/health"),

  // MT5
  mt5Account: () => apiFetch<Row>("/api/mt5/account"),
  mt5Positions: () => apiFetch<Row[]>("/api/mt5/positions"),
  mt5Price: (symbol: string) => apiFetch<{ bid: number; ask: number }>(`/api/mt5/price/${symbol}`),
  mt5OHLCV: (symbol: string, timeframe = "H1", count = 100) =>
    apiFetch<Row[]>(`/api/mt5/ohlcv/${symbol}?timeframe=${timeframe}&count=${count}`),

  // Trades
  tradeHistory: (limit = 100, offset = 0) =>
    apiFetch<Row[]>(`/api/trades/history?limit=${limit}&offset=${offset}`),
  positions: () => apiFetch<Row[]>("/api/trades/positions"),
  mt5History: (days = 7) => apiFetch<Row[]>(`/api/trades/mt5-history?days=${days}`),
  closeTrade: (ticket: string, lot?: number) =>
    apiFetch<Row>("/api/trades/close", { method: "POST", body: JSON.stringify({ ticket, lot }) }),

  // Signals
  signals: (limit = 50) => apiFetch<Row[]>(`/api/signals/?limit=${limit}`),

  // Strategies
  strategies: () => apiFetch<Row[]>("/api/strategies/"),
  createStrategy: (data: unknown) =>
    apiFetch<Row>("/api/strategies/", { method: "POST", body: JSON.stringify(data) }),
  updateStrategy: (id: number, data: unknown) =>
    apiFetch<Row>(`/api/strategies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStrategy: (id: number) =>
    apiFetch<Row>(`/api/strategies/${id}`, { method: "DELETE" }),

  // Performance
  performanceSummary: () => apiFetch<Row>("/api/performance/summary"),
  performanceByStrategy: () => apiFetch<Row[]>("/api/performance/by-strategy"),
  equityCurve: () => apiFetch<Row[]>("/api/performance/equity-curve"),

  // Accounts
  accounts: () => apiFetch<Row[]>("/api/accounts/"),
  createAccount: (data: unknown) =>
    apiFetch<Row>("/api/accounts/", { method: "POST", body: JSON.stringify(data) }),
  updateAccount: (id: number, data: unknown) =>
    apiFetch<Row>(`/api/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAccount: (id: number) =>
    apiFetch<Row>(`/api/accounts/${id}`, { method: "DELETE" }),

  // Trading plan
  tradingPlan: () => apiFetch<Row>("/api/trading-plan/"),
  updateTradingPlan: (data: unknown) =>
    apiFetch<Row>("/api/trading-plan/", { method: "PUT", body: JSON.stringify(data) }),

  // Symbol rules
  symbolRules: () => apiFetch<Row[]>("/api/symbol-rules/"),
  createSymbolRule: (data: unknown) =>
    apiFetch<Row>("/api/symbol-rules/", { method: "POST", body: JSON.stringify(data) }),
  updateSymbolRule: (id: number, data: unknown) =>
    apiFetch<Row>(`/api/symbol-rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSymbolRule: (id: number) =>
    apiFetch<Row>(`/api/symbol-rules/${id}`, { method: "DELETE" }),
  testSymbol: (symbol: string) =>
    apiFetch<Row>("/api/symbol-rules/test", { method: "POST", body: JSON.stringify({ symbol }) }),
  seedRules: () => apiFetch<Row>("/api/symbol-rules/seed", { method: "POST" }),

  // Webhook logs
  webhookLogs: (limit = 100) => apiFetch<Row[]>(`/api/webhook-logs/?limit=${limit}`),
  clearWebhookLogs: () => apiFetch<Row>("/api/webhook-logs/", { method: "DELETE" }),

  // Debug
  debugStatus: () => apiFetch<Row>("/api/debug/status"),
  debugLogs: (service: string, lines = 50) =>
    apiFetch<{ lines: string[] }>(`/api/debug/logs/${service}?lines=${lines}`),
  testWebhook: (data: unknown) =>
    apiFetch<Row>("/api/debug/test-webhook", { method: "POST", body: JSON.stringify(data) }),

  // Telegram
  sendTelegram: (message: string) =>
    apiFetch<Row>("/api/telegram/send", { method: "POST", body: JSON.stringify({ message }) }),

  // Orders
  placeOrder: (data: unknown) =>
    apiFetch<Row>("/api/orders/", { method: "POST", body: JSON.stringify(data) }),
};
