import { z } from "zod";
import { WK_KATEGORIEN, type WkKategorie } from "@/lib/tax/constants";

export const DOCUMENT_TYPES = {
  lohnzettel: { label: "Lohnzettel (L16)", icon: "💼" },
  werbungskosten: { label: "Werbungskosten (Arbeitsmittel, Fortbildung …)", icon: "💻" },
  ergonomisches_mobiliar: { label: "Homeoffice-Mobiliar (Schreibtisch, Sessel)", icon: "🪑" },
  spendenbestaetigung: { label: "Spendenbestätigung", icon: "💝" },
  kirchenbeitrag: { label: "Kirchenbeitrag", icon: "⛪" },
  krankheitskosten: { label: "Krankheitskosten", icon: "🩺" },
  steuerberatung: { label: "Steuerberatungskosten", icon: "🧾" },
  unbekannt: { label: "Nicht erkannt", icon: "❔" },
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;
const typeKeys = Object.keys(DOCUMENT_TYPES) as [DocumentType, ...DocumentType[]];
const wkKeys = Object.keys(WK_KATEGORIEN) as [WkKategorie, ...WkKategorie[]];

const num = () => z.number().nullable();

export const LohnzettelFieldsSchema = z.object({
  arbeitgeber: z.string().nullable().describe("Name des Arbeitgebers"),
  kz210: num().describe("KZ 210: Bruttobezüge in Euro"),
  kz215: num().describe("KZ 215: steuerfreie Bezüge"),
  kz220: num().describe("KZ 220: sonstige Bezüge vor Abzug der SV-Beiträge (13./14. Gehalt innerhalb des Jahressechstels)"),
  kz225: num().describe("KZ 225: SV-Beiträge für sonstige Bezüge"),
  kz230: num().describe("KZ 230: SV-Beiträge für laufende Bezüge (Dienstnehmeranteil)"),
  kz245: num().describe("KZ 245: steuerpflichtige Bezüge"),
  kz260: num().describe("KZ 260: einbehaltene Lohnsteuer"),
  kz717: num().describe("KZ 717: Gewerkschaftsbeiträge"),
  kz718: num().describe("KZ 718: berücksichtigte Pendlerpauschale"),
  kz916: num().describe("KZ 916: berücksichtigter Pendlereuro"),
  telearbeitstage: num().describe("Anzahl der am Lohnzettel ausgewiesenen Telearbeitstage"),
  telearbeitspauschale: num().describe("Vom Arbeitgeber steuerfrei ausbezahlte Telearbeitspauschale"),
});
export type LohnzettelFields = z.infer<typeof LohnzettelFieldsSchema>;

export const BelegFieldsSchema = z.object({
  betrag: num().describe("Bezahlter Gesamtbetrag in Euro (brutto)"),
  datum: z.string().nullable().describe("Rechnungs- oder Zahlungsdatum im Format JJJJ-MM-TT"),
  beschreibung: z.string().describe("Kurze Beschreibung, z. B. 'Laptop' oder 'Sprachkurs Englisch'"),
  empfaenger: z.string().nullable().describe("Aussteller bzw. Zahlungsempfänger"),
  wkKategorie: z.enum(wkKeys).nullable().describe("Nur bei Werbungskosten: passende Kategorie"),
  beruflicherAnteil: z.number().nullable().describe("Geschätzter beruflicher Nutzungsanteil 0–1, falls privat mitgenutzt (z. B. Laptop 0.6); sonst null"),
});
export type BelegFields = z.infer<typeof BelegFieldsSchema>;

export const ExtractionSchema = z.object({
  documentType: z.enum(typeKeys),
  confidence: z.enum(["hoch", "mittel", "niedrig"]),
  taxYear: z.number().int().nullable().describe("Jahr, auf das sich der Beleg bezieht"),
  personName: z.string().nullable().describe("Name der Person, auf die der Beleg ausgestellt ist"),
  summary: z.string().describe("Ein Satz auf Deutsch, was der Beleg ist"),
  lohnzettel: LohnzettelFieldsSchema.nullable(),
  beleg: BelegFieldsSchema.nullable(),
  warnings: z.array(z.string()).describe("Unklarheiten, unleserliche Felder oder steuerliche Hinweise"),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** Bereinigt und plausibilisiert die KI-Ausgabe, bevor sie gespeichert wird. */
export function sanitizeExtraction(e: Extraction): Extraction {
  const clampMoney = (n: number | null) => (n === null || !Number.isFinite(n) || n < 0 || n > 10_000_000 ? null : Math.round(n * 100) / 100);
  const clip = (s: string | null, max = 300) => (s === null ? null : s.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max));
  const warnings = e.warnings.map((w) => clip(w, 400)!).slice(0, 10);

  let lz = e.lohnzettel;
  if (lz) {
    const cleaned = { ...lz } as LohnzettelFields;
    for (const k of Object.keys(cleaned) as (keyof LohnzettelFields)[]) {
      if (k !== "arbeitgeber") (cleaned as Record<string, unknown>)[k] = clampMoney(cleaned[k] as number | null);
    }
    cleaned.arbeitgeber = clip(cleaned.arbeitgeber, 200);
    if (cleaned.telearbeitstage !== null) cleaned.telearbeitstage = Math.min(366, Math.round(cleaned.telearbeitstage));
    if (cleaned.kz210 !== null && cleaned.kz260 !== null && cleaned.kz260 > cleaned.kz210 * 0.5)
      warnings.push("Die Lohnsteuer erscheint im Verhältnis zu den Bruttobezügen ungewöhnlich hoch – bitte prüfen.");
    if (cleaned.kz210 !== null && cleaned.kz245 !== null && cleaned.kz245 > cleaned.kz210)
      warnings.push("Die steuerpflichtigen Bezüge (KZ 245) sind höher als die Bruttobezüge (KZ 210) – bitte prüfen.");
    lz = cleaned;
  }
  let beleg = e.beleg;
  if (beleg) {
    const share = beleg.beruflicherAnteil;
    beleg = {
      ...beleg,
      betrag: clampMoney(beleg.betrag),
      datum: beleg.datum && /^\d{4}-\d{2}-\d{2}$/.test(beleg.datum) ? beleg.datum : null,
      beschreibung: clip(beleg.beschreibung, 200) ?? "",
      empfaenger: clip(beleg.empfaenger, 200),
      beruflicherAnteil: share !== null && Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : null,
    };
  }
  return {
    ...e,
    personName: clip(e.personName, 120),
    summary: clip(e.summary, 300) ?? "",
    taxYear: e.taxYear && e.taxYear > 2000 && e.taxYear < 2100 ? e.taxYear : null,
    lohnzettel: lz,
    beleg,
    warnings,
  };
}
