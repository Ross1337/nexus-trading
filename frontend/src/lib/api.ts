const API_BASE = (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL)
  ? `${process.env.NEXT_PUBLIC_API_URL}/api`
  : "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function logout() {
  if (typeof window !== 'undefined') {
    // Best-effort call to backend to invalidate the HTTP-only cookie
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.removeItem('auth_token');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/login';
  }
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers,
    credentials: "include",
    ...options,
  });

  if (res.status === 401) {
    // Auth disabled — log it but don't redirect.
    throw new Error(`API error 401: ${await res.text()}`);
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Identifiants invalides");
  }
  // Backend NEXUS V2 sets an HTTP-only cookie 'access_token'.
  // We mirror it as a non-HTTP-only 'auth_token' cookie so the Next.js
  // middleware (which reads request.cookies.get('auth_token')) can detect the session.
  // We also keep a localStorage flag for the auth-guard logic.
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", "session");
    document.cookie = `auth_token=session; path=/; max-age=86400; samesite=lax`;
  }
}

// Types
export interface Account {
  id: number;
  login: number;
  name: string;
  server: string;
  mode: string;
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  profit: number;
  currency: string;
  leverage: number;
  is_active: boolean;
  last_sync: string | null;
}

export interface Strategy {
  id: number;
  strategy_id: string;
  name: string;
  description: string;
  is_active: boolean;
  symbols: string[];
  timeframes: string[];
  max_risk_percent: number;
  max_positions: number;
  total_trades: number;
  winning_trades: number;
  total_profit: number;
  max_drawdown: number;
  parameters: Record<string, unknown>;
  win_rate: number;
}

export interface Signal {
  id: number;
  strategy_id: string;
  symbol: string;
  timeframe: string;
  direction: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  lot_size: number;
  risk_percent: number;
  confidence: number;
  indicators: Record<string, number>;
  status: string;
  executed_ticket: number | null;
  rejection_reason: string | null;
  timestamp: string;
}

export interface Trade {
  id: number;
  ticket: number;
  account_id: number;
  strategy_id: string;
  symbol: string;
  direction: string;
  volume: number;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number;
  take_profit: number;
  profit: number;
  swap: number;
  commission: number;
  status: string;
  open_time: string;
  close_time: string | null;
  timeframe: string | null;
  comment: string;
}

export interface Performance {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_profit: number;
  total_loss: number;
  net_profit: number;
  profit_factor: number;
  max_drawdown: number;
  avg_win: number;
  avg_loss: number;
  best_trade: number;
  worst_trade: number;
  open_positions: number;
  floating_pnl: number;
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartData {
  candles: CandleData[];
  indicators: {
    name: string;
    color: string;
    data: { time: string; value: number }[];
  }[];
  signals: Signal[];
}

export interface TradingPlan {
  max_risk_per_trade: number;
  max_daily_drawdown: number;
  max_weekly_drawdown: number;
  max_total_drawdown: number;
  max_positions: number;
  max_trades_per_day: number;
  trading_start_hour: string;
  trading_end_hour: string;
  trade_friday: boolean;
  trade_news: boolean;
  breakeven_enabled: boolean;
  breakeven_pips: number;
  trailing_stop_enabled: boolean;
  trailing_stop_type: string;
  trailing_stop_distance: number;
  partial_tp_enabled: boolean;
  partial_tp_levels: { percent: number; close_percent: number }[];
}

export interface PropfirmRules {
  preset: string;
  account_size: number;
  daily_loss_limit: number;
  total_drawdown_limit: number;
  profit_target: number;
  min_trading_days: number;
  max_trading_days: number | null;
}

export interface PropfirmStatus {
  current_balance: number;
  start_balance: number;
  daily_pnl: number;
  total_profit: number;
  trading_days: number;
  open_positions: number;
  floating_pnl: number;
  rules: PropfirmRules;
}

export interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "error";
  uptime: string;
  last_check: string;
}

export interface SystemStats {
  cpu_percent: number;
  memory_used: number;
  memory_total: number;
  uptime: string;
  api_requests_today: number;
}

export interface NotificationSettings {
  telegram_enabled: boolean;
  telegram_token: string;
  telegram_chat_id: string;
  discord_enabled: boolean;
  discord_webhook: string;
  notify_on_signal: boolean;
  notify_on_trade: boolean;
  notify_on_error: boolean;
  notify_on_drawdown: boolean;
}

export interface LivePosition {
  ticket: number;
  symbol: string;
  direction: string;
  volume: number;
  entry_price: number;
  current_price: number;
  stop_loss: number;
  take_profit: number;
  profit: number;
  swap: number;
  open_time: string;
  strategy_id: string;
}

export interface SymbolRule {
  id: number;
  pattern: string;
  broker_symbol: string;
  enabled: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  ticker: string;
  broker_symbol: string | null;
  success: boolean;
  category: "success" | "market_closed" | "unavailable" | "invalid_volume" | "invalid_stops" | "risk_overrun" | "sl_too_tight" | "other_error";
  ticket: number;
  volume: number | null;
  price: number | null;
  sl: number | null;
  tp: number | null;
  rr: number | null;
  error: string;
}

export interface TestCloseResult {
  ticker: string;
  closed: number;
  success: boolean;
}

export interface TestRunStatus {
  id: string;
  status: "starting" | "running" | "done" | "error";
  phase: "init" | "open" | "hold" | "close" | "complete" | "error";
  started_at: number;
  ended_at: number | null;
  total: number;
  progress: number;
  config: {
    symbols: string[];
    close_after: boolean;
    wait_between: number;
    hold_duration: number;
  };
  results: TestResult[];
  close_results: TestCloseResult[];
  summary: {
    total: number;
    duration_s: number;
    by_category: Record<string, number>;
    trades_closed: number;
  } | null;
  error?: string;
}

export interface TestTaskSummary {
  id: string;
  status: string;
  phase: string;
  started_at: number;
  total: number;
  progress: number;
  summary: TestRunStatus["summary"];
}

export interface WebhookLogSummary {
  id: number;
  created_at: string;
  client_ip: string;
  method: string;
  endpoint: string;
  status_code: number;
  symbol: string | null;
  direction: string | null;
  signal_id: number | null;
  error_message: string | null;
  processing_time_ms: number | null;
  body_preview: string | null;
}

export interface WebhookLogDetail extends WebhookLogSummary {
  headers: Record<string, string>;
  body_raw: string | null;
  body_parsed: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
}

export interface WebhookLogStats {
  since_hours: number;
  total: number;
  success: number;
  rejected: number;
  by_status_code: Record<string, number>;
  top_ips: { ip: string; count: number }[];
}

// API calls
export const api = {
  getHealth: () => fetchAPI<{ status: string }>("/health"),
  getAccounts: () => fetchAPI<Account[]>("/accounts/"),
  getAccount: (id: number) => fetchAPI<Account>(`/accounts/${id}`),
  getStrategies: () => fetchAPI<Strategy[]>("/strategies/"),
  createStrategy: (data: Record<string, unknown>) =>
    fetchAPI<Strategy>("/strategies/", { method: "POST", body: JSON.stringify(data) }),
  updateStrategy: (id: string, data: Partial<Strategy>) =>
    fetchAPI<Strategy>(`/strategies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStrategy: (id: string) =>
    fetchAPI<{ success: boolean }>(`/strategies/${id}`, { method: "DELETE" }),
  getSignals: (params?: string) => fetchAPI<Signal[]>(`/signals/${params ? `?${params}` : ""}`),
  getPerformance: () => fetchAPI<Performance>("/performance/"),
  getStrategyPerformance: (id: string) => fetchAPI<Performance>(`/performance/${id}`),
  getTrades: (params?: string) => fetchAPI<Trade[]>(`/trades/history${params ? `?${params}` : ""}`),

  getChartData: (symbol: string, timeframe: string) =>
    fetchAPI<ChartData>(`/chart/${symbol}/${timeframe}`),

  getTradingPlan: () => fetchAPI<TradingPlan>("/trading-plan/"),
  updateTradingPlan: (data: Partial<TradingPlan>) =>
    fetchAPI<TradingPlan>("/trading-plan/", { method: "PUT", body: JSON.stringify(data) }),

  getPropfirmRules: () => fetchAPI<PropfirmRules>("/propfirm/rules"),
  updatePropfirmRules: (data: Partial<PropfirmRules>) =>
    fetchAPI<PropfirmRules>("/propfirm/rules", { method: "PUT", body: JSON.stringify(data) }),
  getPropfirmStatus: () => fetchAPI<PropfirmStatus>("/propfirm/status"),

  getServiceStatus: () => fetchAPI<ServiceStatus[]>("/admin/services"),
  getSystemStats: () => fetchAPI<SystemStats>("/admin/stats"),
  restartService: (name: string) =>
    fetchAPI<{ status: string }>(`/admin/restart/${name}`, { method: "POST" }),
  getLogs: (limit?: number) =>
    fetchAPI<{ time: string; level: string; message: string; service: string }[]>(
      `/admin/logs${limit ? `?limit=${limit}` : ""}`
    ),

  getNotificationSettings: () => fetchAPI<NotificationSettings>("/settings/notifications"),
  updateNotificationSettings: (data: Partial<NotificationSettings>) =>
    fetchAPI<NotificationSettings>("/settings/notifications", { method: "PUT", body: JSON.stringify(data) }),

  getLivePositions: () => fetchAPI<LivePosition[]>("/trades/positions"),
  closePosition: (ticket: number, volume?: number) =>
    fetchAPI<{ success: boolean }>("/trades/close-position", {
      method: "POST",
      body: JSON.stringify({ ticket, volume }),
    }),
  modifyPosition: (ticket: number, data: { stop_loss?: number; take_profit?: number }) =>
    fetchAPI<{ success: boolean }>("/trades/modify-position", {
      method: "POST",
      body: JSON.stringify({ ticket, ...data }),
    }),

  getMT5Account: () => fetchAPI<Record<string, unknown>>("/mt5/account"),
  getMT5Prices: () => fetchAPI<Record<string, unknown>>("/mt5/prices"),

  executeOrder: (data: { symbol: string; direction: string; volume: number; stop_loss?: number; take_profit?: number; comment?: string }) =>
    fetchAPI<{ success: boolean; order_ticket: number; price: number; comment: string }>("/orders/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  sendTestWebhook: (data: Record<string, unknown>) =>
    fetchAPI<{ success: boolean; signal_id: number; status: string }>("/webhook/tradingview", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getWebhookLogs: (params?: string) =>
    fetchAPI<WebhookLogSummary[]>(`/webhook-logs/${params ? `?${params}` : ""}`),
  getWebhookLog: (id: number) => fetchAPI<WebhookLogDetail>(`/webhook-logs/${id}`),
  getWebhookLogStats: (sinceHours = 24) =>
    fetchAPI<WebhookLogStats>(`/webhook-logs/stats?since_hours=${sinceHours}`),
  clearWebhookLogs: (olderThanDays = 0) =>
    fetchAPI<{ deleted: number }>(`/webhook-logs/?older_than_days=${olderThanDays}`, {
      method: "DELETE",
    }),

  getSymbolRules: () => fetchAPI<SymbolRule[]>("/symbol-rules/"),
  createSymbolRule: (data: { pattern: string; broker_symbol: string; enabled?: boolean; note?: string }) =>
    fetchAPI<SymbolRule>("/symbol-rules/", { method: "POST", body: JSON.stringify(data) }),
  updateSymbolRule: (id: number, data: Partial<{ pattern: string; broker_symbol: string; enabled: boolean; note: string }>) =>
    fetchAPI<SymbolRule>(`/symbol-rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSymbolRule: (id: number) =>
    fetchAPI<{ deleted: boolean; id: number }>(`/symbol-rules/${id}`, { method: "DELETE" }),
  testSymbolMapping: (tvSymbol: string) =>
    fetchAPI<{ tv_symbol: string; broker_symbol: string; matched_pattern: string | null }>("/symbol-rules/test", {
      method: "POST",
      body: JSON.stringify({ tv_symbol: tvSymbol }),
    }),
  seedSymbolRules: () =>
    fetchAPI<{ added: number; total_in_python_dict: number }>("/symbol-rules/seed", { method: "POST" }),

  getTestSymbols: () => fetchAPI<{ symbols: string[]; count: number }>("/test/symbols"),
  startTestRun: (data: {
    symbols?: string[];
    close_after?: boolean;
    wait_between?: number;
    hold_duration?: number;
  }) =>
    fetchAPI<{ task_id: string; total: number }>("/test/run-all", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTestStatus: (taskId: string) => fetchAPI<TestRunStatus>(`/test/status/${taskId}`),
  getTestTasks: () => fetchAPI<TestTaskSummary[]>("/test/tasks"),
};

