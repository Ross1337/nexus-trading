import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatDate(date: string): string {
  if (!date) return "—";
  // MT5 uses "2026.03.22 18:14" format - convert dots to dashes for JS parsing
  const normalized = date.replace(/(\d{4})\.(\d{2})\.(\d{2})/, "$1-$2-$3");
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return date; // fallback to raw string
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPrice(price: number, digits = 5): string {
  if (price == null || isNaN(price)) return "—";
  return price.toFixed(digits);
}
