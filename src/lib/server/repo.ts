import "server-only";
import { decryptJson, encryptJson } from "@/lib/security/crypto";
import type { Extraction } from "@/lib/ai/schema";
import { SUPPORTED_YEARS, type TaxYear } from "@/lib/tax/constants";
import { emptyCase, TaxCaseSchema, type TaxCase } from "@/lib/tax/types";
import type { AuthedUser } from "./auth";
import { q } from "./db";

export interface StoredDocument {
  id: string;
  year: number;
  fileName: string;
  kind: "image" | "pdf";
  bytes: number;
  uploadedAt: number;
  demo: boolean;
  extraction: Extraction;
  applied: boolean;
  /** Bei Übernahme in den Steuerfall verbuchter Betrag (für Rücknahme) */
  appliedAmount?: number;
}

export function parseYear(raw: string | null): TaxYear {
  const y = Number(raw);
  if (!(SUPPORTED_YEARS as number[]).includes(y)) return 2025;
  return y as TaxYear;
}

export async function loadCase(user: AuthedUser, year: TaxYear): Promise<TaxCase> {
  const row = await q.get<{ data_enc: string }>("SELECT data_enc FROM cases WHERE user_id = ? AND year = ?", user.userId, year);
  if (!row) return emptyCase(year);
  const parsed = TaxCaseSchema.safeParse(decryptJson(user.dek, row.data_enc, `case:${user.userId}:${year}`));
  return parsed.success ? parsed.data : emptyCase(year);
}

export async function saveCase(user: AuthedUser, data: TaxCase): Promise<void> {
  const year = data.year;
  await q.run(
    `INSERT INTO cases (user_id, year, data_enc, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, year) DO UPDATE SET data_enc = excluded.data_enc, updated_at = excluded.updated_at`,
    user.userId, year, encryptJson(user.dek, data, `case:${user.userId}:${year}`), Date.now(),
  );
}

export async function listDocuments(user: AuthedUser, year: number): Promise<StoredDocument[]> {
  const rows = await q.all<{ id: string; data_enc: string }>(
    "SELECT id, data_enc FROM documents WHERE user_id = ? AND year = ? ORDER BY created_at DESC", user.userId, year,
  );
  return rows.map((r) => decryptJson<StoredDocument>(user.dek, r.data_enc, `doc:${user.userId}:${r.id}`));
}

export async function getDocument(user: AuthedUser, id: string): Promise<StoredDocument | null> {
  const row = await q.get<{ data_enc: string }>("SELECT data_enc FROM documents WHERE user_id = ? AND id = ?", user.userId, id);
  return row ? decryptJson<StoredDocument>(user.dek, row.data_enc, `doc:${user.userId}:${id}`) : null;
}

export async function saveDocument(user: AuthedUser, doc: StoredDocument): Promise<void> {
  await q.run(
    `INSERT INTO documents (id, user_id, year, data_enc, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data_enc = excluded.data_enc`,
    doc.id, user.userId, doc.year, encryptJson(user.dek, doc, `doc:${user.userId}:${doc.id}`), doc.uploadedAt,
  );
}

export async function deleteDocumentRow(user: AuthedUser, id: string): Promise<void> {
  await q.run("DELETE FROM documents WHERE user_id = ? AND id = ?", user.userId, id);
}

/** DSGVO Art. 20: alle Daten der Person im Klartext exportieren. */
export async function exportAll(user: AuthedUser) {
  const years = [];
  for (const y of SUPPORTED_YEARS) years.push({ year: y, case: await loadCase(user, y), documents: await listDocuments(user, y) });
  return { exportedAt: new Date().toISOString(), email: user.email, years };
}

/** DSGVO Art. 17: Konto und alle Daten unwiderruflich löschen (Crypto-Shredding durch Löschen des DEK). */
export async function deleteAccount(userId: string): Promise<void> {
  await q.run("UPDATE audit_log SET user_id = NULL WHERE user_id = ?", userId);
  await q.run("DELETE FROM users WHERE id = ?", userId);
}
