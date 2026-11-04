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
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

export const pct = (n: number) => `${(n * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;

export const uid = () => crypto.randomUUID();

/** Fragt den Steuerassistenten; `onText` bekommt jeweils die ganze bisherige Antwort. */
export async function askAssistant(
  messages: { role: "user" | "assistant"; content: string }[],
  year: number,
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/assistant", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, messages }),
    signal,
  });
  if (res.status === 401) {
    window.location.href = "/anmelden?abgelaufen=1";
    throw new ApiError(401, "Sitzung abgelaufen.");
  }
  if (!res.ok || !res.body) {
    const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
    throw new ApiError(res.status, data?.error ?? "Der Assistent ist gerade nicht erreichbar.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  return text;
}

/** Kontoauszug (CSV-Text) nach absetzbaren Ausgaben durchsuchen. */
export function scanBankStatement(csv: string, year: number) {
  return api<{ findings: import("@/lib/ai/bank").BankFinding[]; hinweis: string | null }>("/api/bank-import", { method: "POST", json: { csv, year } });
}
