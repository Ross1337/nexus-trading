"use client";

// Login systeme desactive - le AuthGuard est un pass-through
export function AuthGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
