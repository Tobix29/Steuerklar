/**
 * Geteilte Typen aus dem Web-Backend – ausschließlich `import type`, damit kein Server-Code
 * in die App gebündelt wird.
 */
export type { TaxCase, TaxResult, Line, FormEntry, Child, Expense, Lohnzettel } from "@core/tax/types";
export type { Extraction, DocumentType, LohnzettelFields, BelegFields } from "@core/ai/schema";
import type { Extraction } from "@core/ai/schema";

/** Spiegel von `StoredDocument` (src/lib/server/repo.ts) – lokal definiert, da repo.ts Server-Module importiert. */
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
  appliedAmount?: number;
}

export type TaxYear = 2024 | 2025 | 2026;
export const SUPPORTED_YEARS: TaxYear[] = [2024, 2025, 2026];
export const DEFAULT_YEAR: TaxYear = 2025;

export interface Me {
  email: string;
  totpEnabled: boolean;
  aiEnabled: boolean;
}
