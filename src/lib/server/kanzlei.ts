import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import {
  abgeschlossen,
  AbgabeFehler,
  erstelleSnapshot,
  FREIGABE_TEXT,
  freigabeMoeglich,
  STATUS,
  uebergang,
  VOLLMACHT_TEXT,
  type AbgabeDaten,
  type AbgabeStatus,
  type Aktion,
  type Rolle,
} from "@/lib/abgabe/abgabe";
import { decryptJson, encryptJson, newWrappedDataKey, unwrapDataKey } from "@/lib/security/crypto";
import { calculate } from "@/lib/tax/calculate";
import type { TaxYear } from "@/lib/tax/constants";
import type { AuthedUser } from "./auth";
import { q } from "./db";
import { HttpError } from "./guard";
import { listDocuments, loadCase } from "./repo";

/**
 * Zugriffsmodell:
 *  - Mandant:innen sehen nur ihre eigenen Abgaben.
 *  - Kanzlei-Mitglieder sehen Abgaben ihrer Kanzlei – nur solange eine Vollmacht besteht oder die Abgabe bereits übermittelt ist
 *    (Aufbewahrungspflicht der Kanzlei).
 *  - Jede Abgabe hat einen eigenen Datenschlüssel (Envelope Encryption, AAD bindet an die Abgabe-ID).
 */

export interface Kanzlei {
  id: string;
  name: string;
  code: string;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function neuerCode(): string {
  const b = randomBytes(8);
  return [...b].map((x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join("").replace(/^(.{4})/, "$1-");
}

export async function kanzleiVon(userId: string): Promise<(Kanzlei & { rolle: string }) | null> {
  const row = await q.get<{ id: string; name: string; code: string; rolle: string }>(
    "SELECT k.id, k.name, k.code, m.rolle FROM kanzleien k JOIN kanzlei_mitglieder m ON m.kanzlei_id = k.id WHERE m.user_id = ?",
    userId,
  );
  return row ?? null;
}

export async function kanzleiAnlegen(user: AuthedUser, name: string): Promise<Kanzlei> {
  if (await kanzleiVon(user.userId)) throw new HttpError(409, "Du gehörst bereits zu einer Kanzlei.");
  const k: Kanzlei = { id: randomUUID(), name: name.trim(), code: neuerCode() };
  await q.run("INSERT INTO kanzleien (id, name, code, created_at) VALUES (?, ?, ?, ?)", k.id, k.name, k.code, Date.now());
  await q.run("INSERT INTO kanzlei_mitglieder (kanzlei_id, user_id, rolle) VALUES (?, ?, 'inhaber')", k.id, user.userId);
  return k;
}

export async function kanzleiPerCode(code: string): Promise<Kanzlei | null> {
  const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})/, "$1-");
  return (await q.get<Kanzlei>("SELECT id, name, code FROM kanzleien WHERE code = ?", c)) ?? null;
}

/* ------------------------------- Vollmachten ------------------------------- */

export interface Vollmacht {
  id: string;
  kanzleiId: string;
  kanzleiName: string;
  text: string;
  erteiltAt: number;
  widerrufenAt: number | null;
}

export async function vollmachten(userId: string): Promise<Vollmacht[]> {
  return q.all<Vollmacht>(
    `SELECT v.id, v.kanzlei_id AS "kanzleiId", k.name AS "kanzleiName", v.text, v.erteilt_at AS "erteiltAt", v.widerrufen_at AS "widerrufenAt"
     FROM vollmachten v JOIN kanzleien k ON k.id = v.kanzlei_id WHERE v.user_id = ? ORDER BY v.erteilt_at DESC`,
    userId,
  );
}

async function aktiveVollmacht(userId: string, kanzleiId: string): Promise<boolean> {
  return !!(await q.get("SELECT id FROM vollmachten WHERE user_id = ? AND kanzlei_id = ? AND widerrufen_at IS NULL", userId, kanzleiId));
}

export async function vollmachtErteilen(user: AuthedUser, k: Kanzlei): Promise<Vollmacht> {
  if (await aktiveVollmacht(user.userId, k.id)) throw new HttpError(409, "Diese Kanzlei hat bereits eine Vollmacht.");
  const v: Vollmacht = { id: randomUUID(), kanzleiId: k.id, kanzleiName: k.name, text: VOLLMACHT_TEXT(k.name), erteiltAt: Date.now(), widerrufenAt: null };
  await q.run("INSERT INTO vollmachten (id, user_id, kanzlei_id, text, erteilt_at) VALUES (?, ?, ?, ?, ?)", v.id, user.userId, k.id, v.text, v.erteiltAt);
  return v;
}

export async function vollmachtWiderrufen(user: AuthedUser, id: string): Promise<void> {
  const row = await q.get<{ kanzlei_id: string }>("SELECT kanzlei_id FROM vollmachten WHERE id = ? AND user_id = ? AND widerrufen_at IS NULL", id, user.userId);
  if (!row) throw new HttpError(404, "Vollmacht nicht gefunden.");
  await q.run("UPDATE vollmachten SET widerrufen_at = ? WHERE id = ?", Date.now(), id);
  // Offene Abgaben dieser Kanzlei werden zurückgezogen
  for (const a of await q.all<{ id: string; dek: string; data_enc: string; status: string }>(
    "SELECT id, dek, data_enc, status FROM abgaben WHERE user_id = ? AND kanzlei_id = ?", user.userId, row.kanzlei_id,
  )) {
    if (abgeschlossen(a.status as AbgabeStatus) || a.status === "zurueckgezogen") continue;
    const d = oeffnen(a);
    d.status = "zurueckgezogen";
    d.ereignisse.push({ at: Date.now(), von: "system", text: "Vollmacht widerrufen – Abgabe zurückgezogen." });
    await speichern(d, a.dek, user.userId);
  }
}

/* --------------------------------- Abgaben --------------------------------- */

function oeffnen(row: { id: string; dek: string; data_enc: string }): AbgabeDaten {
  const dek = unwrapDataKey(row.dek, `abgabe:${row.id}`);
  return decryptJson<AbgabeDaten>(dek, row.data_enc, `abgabe:${row.id}`);
}

async function speichern(d: AbgabeDaten, wrapped: string | null, userId: string): Promise<void> {
  const dekWrapped = wrapped ?? newWrappedDataKey(`abgabe:${d.id}`);
  const dek = unwrapDataKey(dekWrapped, `abgabe:${d.id}`);
  d.updatedAt = Date.now();
  await q.run(
    `INSERT INTO abgaben (id, user_id, kanzlei_id, year, status, dek, data_enc, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, data_enc = excluded.data_enc, updated_at = excluded.updated_at`,
    d.id, userId, d.kanzleiId, d.year, d.status, dekWrapped, encryptJson(dek, d, `abgabe:${d.id}`), d.createdAt, d.updatedAt,
  );
}

/** Kurzfassung ohne Fall-Snapshot – für Listen. */
export function kurz(d: AbgabeDaten) {
  return {
    id: d.id,
    year: d.year,
    kanzleiName: d.kanzleiName,
    mandant: d.mandant,
    status: d.status,
    statusLabel: STATUS[d.status].label,
    gutschrift: d.snapshot.result.erstattung,
    formulare: d.snapshot.formulare,
    kritisch: d.snapshot.pruefliste.filter((p) => p.stufe === "kritisch").length,
    pruefen: d.snapshot.pruefliste.filter((p) => p.stufe === "pruefen").length,
    version: d.snapshot.version,
    uebermittlung: d.uebermittlung,
    ungelesen: d.nachrichten.length ? d.nachrichten[d.nachrichten.length - 1]!.von : null,
    updatedAt: d.updatedAt,
  };
}

/** Sicht der Mandantin/des Mandanten: ohne interne Prüfliste-Details der Kanzlei ist nichts zu verbergen – alles sichtbar außer Schlüsseln. */
export async function meineAbgaben(user: AuthedUser, year: number) {
  const rows = await q.all<{ id: string; dek: string; data_enc: string }>("SELECT id, dek, data_enc FROM abgaben WHERE user_id = ? AND year = ? ORDER BY created_at DESC", user.userId, year);
  return rows.map(oeffnen).map((d) => ({ ...kurz(d), ereignisse: d.ereignisse, nachrichten: d.nachrichten, pruefliste: d.snapshot.pruefliste, hash: d.snapshot.hash, freigabe: d.freigabe }));
}

/** Freigabe: erstellt einen neuen Snapshot des Falls und übergibt ihn an die Kanzlei. */
export async function freigeben(user: AuthedUser, year: TaxYear, kanzleiId: string): Promise<AbgabeDaten> {
  const k = await q.get<Kanzlei>("SELECT id, name, code FROM kanzleien WHERE id = ?", kanzleiId);
  if (!k) throw new HttpError(404, "Kanzlei nicht gefunden.");
  if (!(await aktiveVollmacht(user.userId, k.id))) throw new HttpError(403, "Erteile der Kanzlei zuerst eine Vollmacht.");
  const c = await loadCase(user, year);
  const r = calculate(c);
  const docs = await listDocuments(user, year);
  const belege = docs.map((d) => ({ id: d.id, fileName: d.fileName, typ: d.extraction.documentType, betrag: d.extraction.beleg?.betrag ?? d.extraction.lohnzettel?.kz210 ?? null, uebernommen: d.applied }));

  const row = await q.get<{ id: string; dek: string; data_enc: string }>(
    "SELECT id, dek, data_enc FROM abgaben WHERE user_id = ? AND kanzlei_id = ? AND year = ? ORDER BY created_at DESC", user.userId, k.id, year,
  );
  const alt = row ? oeffnen(row) : null;
  if (alt && abgeschlossen(alt.status)) throw new HttpError(409, `Die Abgabe ${year} ist bereits ${STATUS[alt.status].label.toLowerCase()}. Für Korrekturen schreib der Kanzlei eine Nachricht.`);
  const status = uebergang(alt?.status ?? null, "freigeben", "mandant");
  const snapshot = await erstelleSnapshot(c, r, belege, (alt?.snapshot.version ?? 0) + 1);
  if (!freigabeMoeglich(snapshot)) throw new HttpError(422, "Vor der Freigabe sind kritische Punkte zu klären: " + snapshot.pruefliste.filter((p) => p.stufe === "kritisch").map((p) => p.text).join(" "));
  const now = Date.now();
  const d: AbgabeDaten = {
    id: alt?.id ?? randomUUID(),
    year,
    kanzleiId: k.id,
    kanzleiName: k.name,
    mandant: { name: [c.firstName, c.lastName].filter(Boolean).join(" ") || user.email, email: user.email },
    status,
    snapshot,
    freigabe: { at: now, text: FREIGABE_TEXT(year, k.name), hash: snapshot.hash },
    uebermittlung: null,
    ereignisse: [...(alt?.ereignisse ?? []), { at: now, von: "mandant", text: alt ? `Neue Version ${snapshot.version} freigegeben.` : "Zur Abgabe freigegeben." }],
    nachrichten: alt?.nachrichten ?? [],
    createdAt: alt?.createdAt ?? now,
    updatedAt: now,
  };
  await speichern(d, row?.dek ?? null, user.userId);
  return d;
}

async function ladeFuer(user: AuthedUser, id: string, rolle: Rolle): Promise<{ d: AbgabeDaten; dek: string; userId: string }> {
  const row = await q.get<{ id: string; dek: string; data_enc: string; user_id: string; kanzlei_id: string; status: string }>(
    "SELECT id, dek, data_enc, user_id, kanzlei_id, status FROM abgaben WHERE id = ?", id,
  );
  if (!row) throw new HttpError(404, "Abgabe nicht gefunden.");
  if (rolle === "mandant" && row.user_id !== user.userId) throw new HttpError(404, "Abgabe nicht gefunden.");
  if (rolle === "kanzlei") {
    const k = await kanzleiVon(user.userId);
    if (!k || k.id !== row.kanzlei_id) throw new HttpError(404, "Abgabe nicht gefunden.");
    const erlaubt = (await aktiveVollmacht(row.user_id, row.kanzlei_id)) || abgeschlossen(row.status as AbgabeStatus);
    if (!erlaubt) throw new HttpError(403, "Die Vollmacht wurde widerrufen.");
  }
  return { d: oeffnen(row), dek: row.dek, userId: row.user_id };
}

export async function abgabeFuerKanzlei(user: AuthedUser, id: string): Promise<AbgabeDaten> {
  return (await ladeFuer(user, id, "kanzlei")).d;
}

/** Aktion auf einer Abgabe: Statuswechsel und/oder Nachricht. */
export async function aktion(user: AuthedUser, id: string, rolle: Rolle, a: Aktion | "nachricht", text: string, referenz = ""): Promise<AbgabeDaten> {
  const { d, dek, userId } = await ladeFuer(user, id, rolle);
  const now = Date.now();
  const t = text.trim().slice(0, 4000);
  if (a === "nachricht") {
    if (!t) throw new HttpError(400, "Nachricht ist leer.");
    d.nachrichten.push({ at: now, von: rolle, text: t });
  } else {
    if (a === "freigeben") throw new HttpError(400, "Freigabe über /api/abgaben.");
    try {
      d.status = uebergang(d.status, a, rolle);
    } catch (err) {
      if (err instanceof AbgabeFehler) throw new HttpError(409, err.message);
      throw err;
    }
    if (a === "rueckfrage" && !t) throw new HttpError(400, "Bitte formuliere die Rückfrage.");
    if (a === "ablehnen" && !t) throw new HttpError(400, "Bitte gib einen Grund an.");
    if (a === "uebermitteln") {
      const ref = referenz.trim().slice(0, 80);
      if (!ref) throw new HttpError(400, "Bitte die FinanzOnline-Übermittlungsbestätigung (Referenz) angeben.");
      d.uebermittlung = { at: now, referenz: ref };
    }
    const label: Record<Exclude<Aktion, "freigeben">, string> = {
      zurueckziehen: "Abgabe zurückgezogen.",
      pruefen: "Kanzlei hat mit der Prüfung begonnen.",
      rueckfrage: "Kanzlei hat eine Rückfrage gestellt.",
      uebermitteln: `An das Finanzamt übermittelt (Referenz ${referenz.trim().slice(0, 80)}).`,
      bescheid: "Bescheid ist eingelangt.",
      ablehnen: "Kanzlei hat das Mandat abgelehnt.",
    };
    d.ereignisse.push({ at: now, von: rolle, text: label[a] });
    if (t) d.nachrichten.push({ at: now, von: rolle, text: t });
  }
  await speichern(d, dek, userId);
  return d;
}

/** Übersicht für die Kanzlei: Mandant:innen mit Vollmacht und alle Abgaben. */
export async function kanzleiUebersicht(user: AuthedUser) {
  const k = await kanzleiVon(user.userId);
  if (!k) return null;
  const mandanten = await q.all<{ userId: string; erteiltAt: number }>(
    `SELECT user_id AS "userId", erteilt_at AS "erteiltAt" FROM vollmachten WHERE kanzlei_id = ? AND widerrufen_at IS NULL ORDER BY erteilt_at DESC`, k.id,
  );
  const rows = await q.all<{ id: string; dek: string; data_enc: string; user_id: string; status: string }>(
    "SELECT id, dek, data_enc, user_id, status FROM abgaben WHERE kanzlei_id = ? ORDER BY updated_at DESC LIMIT 500", k.id,
  );
  const aktiv = new Set(mandanten.map((m) => m.userId));
  const abgaben = rows.filter((r) => aktiv.has(r.user_id) || abgeschlossen(r.status as AbgabeStatus)).map(oeffnen).map(kurz);
  return { kanzlei: { id: k.id, name: k.name, code: k.code, rolle: k.rolle }, mandanten: mandanten.length, abgaben };
}
