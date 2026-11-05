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

type Bescheid = import("@/lib/ai/finanzamt").Bescheid;
type BescheidPruefung = import("@/lib/ai/finanzamt").BescheidPruefung;
type FaPost = import("@/lib/ai/finanzamt").Post;

/** Steuerbescheid hochladen und mit der eigenen Berechnung vergleichen (wird nicht gespeichert). */
export function pruefeBescheid(file: File, year: number, zustellung: "databox" | "post") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("year", String(year));
  fd.append("zustellung", zustellung);
  return api<{ bescheid: Bescheid; pruefung: BescheidPruefung }>("/api/finanzamt/bescheid", { method: "POST", body: fd });
}

/** Brief vom Finanzamt erklären lassen und eine Antwort entwerfen (wird nicht gespeichert). */
export function erklaereBrief(file: File, year: number) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("year", String(year));
  return api<{ post: FaPost }>("/api/finanzamt/post", { method: "POST", body: fd });
}

/** Rechnung/Kassenbon für das Journal auslesen (wird nicht gespeichert). */
export function scanBuchung(file: File, year: number) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("year", String(year));
  return api<{ buchung: import("@/lib/ai/buchung").BuchungScan }>("/api/buchhaltung/scan", { method: "POST", body: fd });
}

/** KI-Ideen für den Steuer-Check. */
export function kiIdeen(year: number) {
  return api<{ ideen: import("@/lib/ai/ideen").Ideen["ideen"] }>("/api/agent/ideen", { method: "POST", json: { year } });
}
