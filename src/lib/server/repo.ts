import "server-only";
import { decryptJson, encryptJson } from "@/lib/security/crypto";
import type { Extraction } from "@/lib/ai/schema";
import { SUPPORTED_YEARS, type TaxYear } from "@/lib/tax/constants";
import { emptyCase, TaxCaseSchema, type TaxCase } from "@/lib/tax/types";
import type { AuthedUser } from "./auth";
import { db } from "./db";

export interface StoredDocument {
  id: string;
  year: number;
  fileName: string;
  kind: "image" | "pdf";
  bytes: number;
  uploadedAt: number;
  demo: boolean;
  extraction: Extraction;
  /** Person, der der Beleg zugeordnet ist (0 oder 1) */
  personIndex: number;
  /** Kind, dem Betreuungskosten zugeordnet sind */
  childId?: string;
  applied: boolean;
  /** Bei Übernahme in den Steuerfall verbuchter Betrag (für Rücknahme) */
  appliedAmount?: number;
}

export function parseYear(raw: string | null): TaxYear {
  const y = Number(raw);
  if (!(SUPPORTED_YEARS as number[]).includes(y)) return 2025;
  return y as TaxYear;
}

export function loadCase(user: AuthedUser, year: TaxYear): TaxCase {
  const row = db().prepare("SELECT data_enc FROM cases WHERE user_id = ? AND year = ?").get(user.userId, year) as { data_enc: string } | undefined;
  if (!row) return emptyCase(year);
  const parsed = TaxCaseSchema.safeParse(decryptJson(user.dek, row.data_enc, `case:${user.userId}:${year}`));
  return parsed.success ? parsed.data : emptyCase(year);
}

export function saveCase(user: AuthedUser, data: TaxCase) {
  const year = data.year;
  db()
    .prepare(
      `INSERT INTO cases (user_id, year, data_enc, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, year) DO UPDATE SET data_enc = excluded.data_enc, updated_at = excluded.updated_at`,
    )
    .run(user.userId, year, encryptJson(user.dek, data, `case:${user.userId}:${year}`), Date.now());
}

export function listDocuments(user: AuthedUser, year: number): StoredDocument[] {
  const rows = db().prepare("SELECT id, data_enc FROM documents WHERE user_id = ? AND year = ? ORDER BY created_at DESC").all(user.userId, year) as {
    id: string;
    data_enc: string;
  }[];
  return rows.map((r) => decryptJson<StoredDocument>(user.dek, r.data_enc, `doc:${user.userId}:${r.id}`));
}

export function getDocument(user: AuthedUser, id: string): StoredDocument | null {
  const row = db().prepare("SELECT data_enc FROM documents WHERE user_id = ? AND id = ?").get(user.userId, id) as { data_enc: string } | undefined;
  return row ? decryptJson<StoredDocument>(user.dek, row.data_enc, `doc:${user.userId}:${id}`) : null;
}

export function saveDocument(user: AuthedUser, doc: StoredDocument) {
  db()
    .prepare(
      `INSERT INTO documents (id, user_id, year, data_enc, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data_enc = excluded.data_enc`,
    )
    .run(doc.id, user.userId, doc.year, encryptJson(user.dek, doc, `doc:${user.userId}:${doc.id}`), doc.uploadedAt);
}

export function deleteDocumentRow(user: AuthedUser, id: string) {
  db().prepare("DELETE FROM documents WHERE user_id = ? AND id = ?").run(user.userId, id);
}

/** DSGVO Art. 20: alle Daten der Person im Klartext exportieren. */
export function exportAll(user: AuthedUser) {
  return {
    exportedAt: new Date().toISOString(),
    email: user.email,
    years: SUPPORTED_YEARS.map((y) => ({ year: y, case: loadCase(user, y), documents: listDocuments(user, y) })),
  };
}

/** DSGVO Art. 17: Konto und alle Daten unwiderruflich löschen (Crypto-Shredding durch Löschen des DEK). */
export function deleteAccount(userId: string) {
  db().prepare("DELETE FROM users WHERE id = ?").run(userId);
  db().prepare("UPDATE audit_log SET user_id = NULL WHERE user_id = ?").run(userId);
}
