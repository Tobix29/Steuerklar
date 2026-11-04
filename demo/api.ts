/**
 * Browser-Ersatz für `@/lib/client/api` in der Artifact-Demo: Dieselben Endpunkte wie der Server,
 * aber lokal ausgeführt (Steuer-Engine, Beleg-Übernahme, PDF). Belege erkennt Claude über die
 * `sample`-Capability des Artifacts.
 */
import { z } from "zod";
import { demoExtraction, EXTRACTION_INSTRUCTIONS, ExtractionSchema, sanitizeExtraction, type Extraction } from "@/lib/ai/schema";
import { applyDocument, unapplyDocument } from "@/lib/tax/apply";
import { calculate } from "@/lib/tax/calculate";
import { SUPPORTED_YEARS, type TaxYear } from "@/lib/tax/constants";
import { TaxCaseSchema } from "@/lib/tax/types";
import type { StoredDocument } from "@/lib/server/repo";
import { store } from "./store";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const eur = (n: number, digits = 2) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
export const pct = (n: number) => `${(n * 100).toLocaleString("de-AT", { maximumFractionDigits: 1 })} %`;
export const uid = () => crypto.randomUUID();

type Claude = { use: (name: string) => Promise<any> };
const capability = async (name: string) => {
  const c = (window as unknown as { claude?: Claude }).claude;
  return c ? c.use(name).catch(() => null) : null;
};

const parseYear = (raw: string | null): TaxYear => {
  const y = Number(raw);
  return ((SUPPORTED_YEARS as number[]).includes(y) ? y : 2025) as TaxYear;
};

/** Kann diese Ansicht Bilder an Claude schicken? */
export async function aiAvailable(): Promise<boolean> {
  const sample = await capability("sample");
  if (!sample) return false;
  try {
    return !!(await sample.limits()).images;
  } catch {
    return false;
  }
}

const jsonSchema = JSON.stringify(z.toJSONSchema(ExtractionSchema));

async function extract(file: File, year: number): Promise<{ extraction: Extraction; demo: boolean }> {
  const sample = await capability("sample");
  const limits = sample ? await sample.limits().catch(() => null) : null;
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (sample && limits?.images && !isPdf) {
    const prompt = `${EXTRACTION_INSTRUCTIONS}

Erfasse den beigefügten Beleg für die Arbeitnehmerveranlagung ${year}.
Antworte ausschließlich mit einem JSON-Objekt, das genau diesem JSON-Schema entspricht (keine Erklärungen, kein Markdown):
${jsonSchema}`;
    try {
      const out = await sample.json(prompt, { images: [file], modelTier: "default", cache: false });
      const parsed = ExtractionSchema.safeParse(out);
      if (!parsed.success) throw new ApiError(422, "Die Erkennung lieferte ungültige Daten. Bitte ein schärferes Foto verwenden.");
      return { extraction: sanitizeExtraction(parsed.data), demo: false };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const code = (err as { code?: string })?.code;
      if (code === "rate_limited") throw new ApiError(429, "Die Belegerkennung ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.");
      if (code !== "not_granted") throw new ApiError(422, "Die Belegerkennung ist fehlgeschlagen. Bitte erneut versuchen.");
      // Viewer hat Claude nicht erlaubt → Beispielwerte
    }
  }
  const e = demoExtraction(year);
  e.warnings = [
    isPdf && limits?.images
      ? "PDFs liest die Demo nicht aus – lade ein Foto oder einen Screenshot hoch, damit Claude den Beleg erkennt. Hier siehst du Beispielwerte."
      : "Beispielwerte: Die Belegerkennung durch Claude ist in dieser Ansicht nicht verfügbar oder wurde nicht erlaubt.",
  ];
  return { extraction: e, demo: true };
}

async function handle(method: string, url: URL, body: unknown): Promise<unknown> {
  const s = await store();
  const path = url.pathname;

  if (path === "/api/me") return { email: s.kind === "konto" ? "Demo · in deinem Claude-Konto gespeichert" : "Demo · nur in diesem Browser gespeichert", totpEnabled: false, aiEnabled: await aiAvailable() };
  if (path === "/api/auth/logout") return { ok: true };
  if (path === "/api/account/totp") throw new ApiError(400, "Die Zwei-Faktor-Anmeldung gibt es nur in der vollständigen App, nicht in dieser Demo.");
  if (path === "/api/account" && method === "DELETE") {
    await s.clear();
    return { ok: true };
  }

  if (path === "/api/case") {
    if (method === "GET") {
      const year = parseYear(url.searchParams.get("year"));
      const data = await s.getCase(year);
      return { case: data, result: calculate(data), documents: (await s.listDocs(year)).length, storagePersistent: s.kind !== "sitzung" };
    }
    const parsed = TaxCaseSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Ungültige Eingabe.");
    await s.setCase(parsed.data);
    return { case: parsed.data, result: calculate(parsed.data) };
  }

  if (path === "/api/documents") {
    if (method === "GET") return { documents: await s.listDocs(parseYear(url.searchParams.get("year"))), aiEnabled: await aiAvailable() };
    const form = body as FormData;
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Keine Datei erhalten.");
    if (file.size > 10 * 1024 * 1024) throw new ApiError(413, "Die Datei ist größer als 10 MB.");
    const year = parseYear(String(form.get("year") ?? ""));
    const { extraction, demo } = await extract(file, year);
    if (extraction.taxYear && extraction.taxYear !== year) extraction.warnings.push(`Der Beleg scheint aus ${extraction.taxYear} zu stammen, nicht aus ${year}.`);
    const doc: StoredDocument = {
      id: crypto.randomUUID(),
      year,
      fileName: file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "Beleg",
      kind: file.type === "application/pdf" ? "pdf" : "image",
      bytes: file.size,
      uploadedAt: Date.now(),
      demo,
      extraction,
      applied: false,
    };
    await s.putDoc(doc);
    return { document: doc };
  }

  const m = path.match(/^\/api\/documents\/([0-9a-f-]{36})$/);
  if (m) {
    const doc = await s.getDoc(m[1]!);
    if (!doc) throw new ApiError(404, "Beleg nicht gefunden.");
    const year = parseYear(String(doc.year));
    let data = await s.getCase(year);
    if (method === "DELETE") {
      if (doc.applied) await s.setCase(unapplyDocument(data, doc));
      await s.delDoc(doc.id);
      return { ok: true };
    }
    const patch = body as { extraction?: Extraction; applied?: boolean };
    data = unapplyDocument(data, doc);
    if (patch.extraction) {
      const p = ExtractionSchema.safeParse(patch.extraction);
      if (!p.success) throw new ApiError(400, "Ungültige Belegwerte.");
      doc.extraction = sanitizeExtraction(p.data);
    }
    if (patch.applied ?? doc.applied) {
      try {
        const res = applyDocument(data, doc);
        data = res.case;
        doc.appliedAmount = res.amount;
        doc.applied = true;
      } catch (err) {
        throw new ApiError(400, err instanceof Error ? err.message : "Übernahme nicht möglich.");
      }
    } else {
      doc.applied = false;
      doc.appliedAmount = 0;
    }
    await s.setCase(data);
    await s.putDoc(doc);
    return { document: doc };
  }

  throw new ApiError(404, "Unbekannte Funktion in der Demo.");
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const url = new URL(path, "https://demo.invalid");
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.json !== undefined ? structuredClone(init.json) : init.body;
  return (await handle(method, url, body)) as T;
}

/** Downloads (PDF, Datenexport) über die `downloads`-Capability. */
export async function download(path: string): Promise<string> {
  const url = new URL(path, "https://demo.invalid");
  const downloads = await capability("downloads");
  if (!downloads) return "Downloads sind in dieser Ansicht nicht verfügbar. Öffne das Artifact direkt auf claude.ai.";
  const s = await store();
  let filename: string;
  let data: Uint8Array | string;
  if (url.pathname === "/api/case/pdf") {
    const year = parseYear(url.searchParams.get("year"));
    const c = await s.getCase(year);
    const { buildPdf } = await import("@/lib/server/pdf");
    data = await buildPdf(c, calculate(c));
    filename = `Arbeitnehmerveranlagung-${year}-Ausfuellhilfe.pdf`;
  } else if (url.pathname === "/api/account/export") {
    const years = [];
    for (const y of SUPPORTED_YEARS) years.push({ year: y, case: await s.getCase(y), documents: await s.listDocs(y) });
    data = JSON.stringify({ exportedAt: new Date().toISOString(), years }, null, 2);
    filename = `steuerklar-export-${new Date().toISOString().slice(0, 10)}.json`;
  } else return "Unbekannter Download.";
  try {
    await downloads.save({ filename, data });
    return "Datei bereitgestellt.";
  } catch (err) {
    const code = (err as { code?: string })?.code;
    return code === "declined" ? "Download abgebrochen." : "Der Download hat nicht geklappt.";
  }
}
