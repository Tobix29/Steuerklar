import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { API } from "./config";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(t: string | null) {
  token = t;
}
export function getApiToken(): string | null {
  return token;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    "X-Client": "mobile",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function handle<T>(res: Response, path: string): Promise<T> {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    onUnauthorized?.();
    throw new ApiError(401, "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Fehler ${res.status}`);
  return data as T;
}

export async function api<T>(path: string, init: { method?: string; json?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (API.error) throw new ApiError(0, API.error);
  let res: Response;
  try {
    res = await fetch(`${API.url}${path}`, {
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: headers(init.json !== undefined ? { "Content-Type": "application/json" } : undefined),
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      credentials: "omit",
      signal: init.signal,
    });
  } catch {
    throw new ApiError(0, "Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.");
  }
  return handle<T>(res, path);
}

export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string;
}

/** Multipart-Upload eines Belegs. */
export async function uploadDocument<T>(file: UploadFile, year: number): Promise<T> {
  if (API.error) throw new ApiError(0, API.error);
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(file.uri)).blob();
    form.append("file", blob, file.name);
  } else {
    // React Native akzeptiert {uri, name, type} als Datei-Teil
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
  form.append("year", String(year));
  let res: Response;
  try {
    res = await fetch(`${API.url}/api/documents`, { method: "POST", headers: headers(), body: form, credentials: "omit" });
  } catch {
    throw new ApiError(0, "Upload fehlgeschlagen – keine Verbindung zum Server.");
  }
  return handle<T>(res, "/api/documents");
}

/** Lädt die Ausfüllhilfe als PDF in den Cache und gibt die lokale URI zurück. */
export async function downloadPdf(year: number): Promise<string> {
  if (API.error) throw new ApiError(0, API.error);
  const url = `${API.url}/api/case/pdf?year=${year}`;
  if (Platform.OS === "web") return url;
  const target = new File(Paths.cache, `Arbeitnehmerveranlagung-${year}.pdf`);
  try {
    const file = await File.downloadFileAsync(url, target, { headers: headers({ Accept: "application/pdf" }), idempotent: true });
    return file.uri;
  } catch {
    throw new ApiError(0, "Das PDF konnte nicht geladen werden.");
  }
}

/** Entfernt eine temporäre Datei (z. B. nach dem Teilen des PDFs). */
export function removeLocalFile(uri: string) {
  if (Platform.OS === "web") return;
  try {
    new File(uri).delete();
  } catch {
    /* bereits gelöscht */
  }
}
