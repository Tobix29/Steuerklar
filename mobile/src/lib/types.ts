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

// Laufzeit-Importe aus der reinen Steuer-Engine (siehe metro.config.js)
export { SUPPORTED_YEARS, DEFAULT_YEAR, YEAR_PARAMS, fristen, type TaxYear } from "@core/tax/constants";
export type { Mietobjekt, Betrieb } from "@core/tax/types";
export type { BankFinding } from "@core/ai/bank";

export interface Me {
  email: string;
  totpEnabled: boolean;
  aiEnabled: boolean;
}
