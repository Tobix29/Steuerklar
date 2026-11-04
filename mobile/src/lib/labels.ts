import type { DocumentType, StoredDocument } from "./types";

/** Laufzeit-Kopie der Labels aus src/lib/ai/schema.ts und src/lib/tax/constants.ts (Web). */
export const DOCUMENT_LABELS: Record<DocumentType, { label: string; icon: string }> = {
  lohnzettel: { label: "Lohnzettel (L16)", icon: "💼" },
  werbungskosten: { label: "Werbungskosten", icon: "💻" },
  ergonomisches_mobiliar: { label: "Homeoffice-Mobiliar", icon: "🪑" },
  spendenbestaetigung: { label: "Spendenbestätigung", icon: "💝" },
  kirchenbeitrag: { label: "Kirchenbeitrag", icon: "⛪" },
  krankheitskosten: { label: "Krankheitskosten", icon: "🩺" },
  steuerberatung: { label: "Steuerberatungskosten", icon: "🧾" },
  unbekannt: { label: "Nicht erkannt", icon: "❔" },
};

export const WK_LABELS = {
  digitale_arbeitsmittel: "Digitale Arbeitsmittel",
  arbeitsmittel: "Arbeitsmittel",
  fachliteratur: "Fachliteratur",
  reisekosten: "Reisekosten",
  fortbildung: "Fortbildung",
  sonstige: "Sonstige",
  gewerkschaft: "Gewerkschaftsbeiträge",
} as const;
export type WkKategorie = keyof typeof WK_LABELS;

export const BUNDESLAENDER = [
  { code: "B", name: "Burgenland" },
  { code: "K", name: "Kärnten" },
  { code: "N", name: "Niederösterreich" },
  { code: "O", name: "Oberösterreich" },
  { code: "S", name: "Salzburg" },
  { code: "St", name: "Steiermark" },
  { code: "T", name: "Tirol" },
  { code: "V", name: "Vorarlberg" },
  { code: "W", name: "Wien" },
] as const;

/** Lohnzettel-Felder mit Kennzahl für das Prüf-Formular */
export const LZ_FIELDS = [
  ["kz210", "Bruttobezüge", "210"],
  ["kz215", "Steuerfreie Bezüge", "215"],
  ["kz220", "Sonstige Bezüge (13./14.)", "220"],
  ["kz225", "SV-Beiträge sonstige Bezüge", "225"],
  ["kz230", "SV-Beiträge laufende Bezüge", "230"],
  ["kz245", "Steuerpflichtige Bezüge", "245"],
  ["kz260", "Einbehaltene Lohnsteuer", "260"],
  ["kz717", "Gewerkschaftsbeiträge", "717"],
  ["kz718", "Pendlerpauschale (AG)", "718"],
  ["kz916", "Pendlereuro (AG)", "916"],
  ["telearbeitspauschale", "Telearbeitspauschale (AG)", ""],
] as const;

export function mainAmount(d: StoredDocument): number | null {
  const e = d.extraction;
  if (e.documentType === "lohnzettel") return e.lohnzettel?.kz210 ?? null;
  return e.beleg?.betrag ?? null;
}
