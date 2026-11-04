"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && !path.startsWith("/api/auth")) {
    window.location.href = "/anmelden?abgelaufen=1";
    throw new ApiError(401, "Sitzung abgelaufen.");
  }
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "Unbekannter Fehler.");
  return data as T;
}

export const eur = (n: number, digits = 2) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

export const pct = (n: number) => `${(n * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;

export const uid = () => crypto.randomUUID();
