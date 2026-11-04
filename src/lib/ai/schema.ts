import { z } from "zod";

export const DOCUMENT_TYPES = {
  lohnsteuerbescheinigung: { label: "Lohnsteuerbescheinigung", icon: "💼" },
  arbeitsmittel: { label: "Werbungskosten (Arbeitsmittel, Fortbildung …)", icon: "💻" },
  spendenbescheinigung: { label: "Spendenbescheinigung", icon: "💝" },
  handwerkerleistung: { label: "Handwerkerrechnung", icon: "🛠️" },
  haushaltsnahe_dienstleistung: { label: "Haushaltsnahe Dienstleistung / Nebenkosten", icon: "🧹" },
  krankheitskosten: { label: "Krankheitskosten", icon: "🩺" },
  kinderbetreuung: { label: "Kinderbetreuung", icon: "🧸" },
  lohnersatzleistung: { label: "Elterngeld / Arbeitslosengeld", icon: "📄" },
  unbekannt: { label: "Nicht erkannt", icon: "❔" },
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;
const typeKeys = Object.keys(DOCUMENT_TYPES) as [DocumentType, ...DocumentType[]];

const num = () => z.number().nullable();

export const LohnsteuerFieldsSchema = z.object({
  arbeitgeber: z.string().nullable().describe("Name des Arbeitgebers"),
  bruttoarbeitslohn: num().describe("Zeile 3: Bruttoarbeitslohn in Euro"),
  lohnsteuer: num().describe("Zeile 4: Einbehaltene Lohnsteuer"),
  soli: num().describe("Zeile 5: Einbehaltener Solidaritätszuschlag"),
  kirchensteuer: num().describe("Zeile 6: Einbehaltene Kirchensteuer des Arbeitnehmers"),
  kirchensteuerEhegatte: num().describe("Zeile 7: Kirchensteuer des Ehegatten"),
  lohnersatzleistungen: num().describe("Zeile 15: Kurzarbeitergeld, Zuschuss zum Mutterschaftsgeld u. a."),
  steuerfreieFahrtkosten: num().describe("Summe Zeilen 17 und 18: steuerfreie/pauschal besteuerte Arbeitgeberleistungen für Fahrten"),
  rvArbeitgeber: num().describe("Zeile 22a: Arbeitgeberanteil zur gesetzlichen Rentenversicherung"),
  rvArbeitnehmer: num().describe("Zeile 23a: Arbeitnehmeranteil zur gesetzlichen Rentenversicherung"),
  zuschuesseKvPv: num().describe("Summe Zeilen 24a und 24b: Arbeitgeberzuschüsse zur Kranken- und Pflegeversicherung"),
  kvArbeitnehmer: num().describe("Zeile 25: Arbeitnehmerbeiträge zur gesetzlichen Krankenversicherung"),
  pvArbeitnehmer: num().describe("Zeile 26: Arbeitnehmerbeiträge zur sozialen Pflegeversicherung"),
  alvArbeitnehmer: num().describe("Zeile 27: Arbeitnehmerbeiträge zur Arbeitslosenversicherung"),
  pkvBasis: num().describe("Zeile 28: Beiträge zur privaten Kranken- und Pflege-Pflichtversicherung"),
  steuerId: z.string().nullable().describe("Steuerliche Identifikationsnummer (11 Ziffern, ohne Leerzeichen)"),
});
export type LohnsteuerFields = z.infer<typeof LohnsteuerFieldsSchema>;

export const BelegFieldsSchema = z.object({
  betrag: num().describe("Gesamtbetrag in Euro (brutto)"),
  arbeitskosten: num().describe("Nur bei Handwerker/haushaltsnahen Leistungen: Arbeits-, Maschinen- und Fahrtkosten inkl. USt., ohne Material"),
  datum: z.string().nullable().describe("Rechnungs- oder Zahlungsdatum im Format JJJJ-MM-TT"),
  beschreibung: z.string().describe("Kurze Beschreibung, z. B. 'Malerarbeiten Wohnzimmer' oder 'Laptop'"),
  empfaenger: z.string().nullable().describe("Aussteller bzw. Zahlungsempfänger"),
  unbarGezahlt: z.boolean().nullable().describe("Gibt es Hinweise auf Überweisung/Kartenzahlung? Barzahlung ist bei §35a nicht begünstigt."),
});
export type BelegFields = z.infer<typeof BelegFieldsSchema>;

export const ExtractionSchema = z.object({
  documentType: z.enum(typeKeys),
  confidence: z.enum(["hoch", "mittel", "niedrig"]),
  taxYear: z.number().int().nullable().describe("Jahr, auf das sich der Beleg bezieht"),
  personName: z.string().nullable().describe("Name der Person, auf die der Beleg ausgestellt ist"),
  summary: z.string().describe("Ein Satz auf Deutsch, was der Beleg ist"),
  lohnsteuerbescheinigung: LohnsteuerFieldsSchema.nullable(),
  beleg: BelegFieldsSchema.nullable(),
  warnings: z.array(z.string()).describe("Unklarheiten, unleserliche Felder oder steuerliche Hinweise"),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** Plausibilitätsprüfung der Steuer-ID (ISO 7064, MOD 11,10). */
export function isValidSteuerId(id: string): boolean {
  if (!/^[1-9]\d{10}$/.test(id)) return false;
  let product = 10;
  for (let i = 0; i < 10; i++) {
    let s = (Number(id[i]) + product) % 10;
    if (s === 0) s = 10;
    product = (s * 2) % 11;
  }
  const check = (11 - product) % 10;
  return check === Number(id[10]);
}

/** Bereinigt und plausibilisiert die KI-Ausgabe, bevor sie gespeichert wird. */
export function sanitizeExtraction(e: Extraction): Extraction {
  const clampMoney = (n: number | null) => (n === null || !Number.isFinite(n) || n < 0 || n > 10_000_000 ? null : Math.round(n * 100) / 100);
  const clip = (s: string | null, max = 300) => (s === null ? null : s.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max));
  const warnings = e.warnings.map((w) => clip(w, 400)!).slice(0, 10);

  let lst = e.lohnsteuerbescheinigung;
  if (lst) {
    const cleaned = Object.fromEntries(
      Object.entries(lst).map(([k, v]) => [k, typeof v === "number" || v === null ? (k === "steuerId" ? v : clampMoney(v as number | null)) : v]),
    ) as LohnsteuerFields;
    cleaned.arbeitgeber = clip(cleaned.arbeitgeber, 200);
    const sid = cleaned.steuerId?.replace(/\s/g, "") ?? null;
    cleaned.steuerId = sid && isValidSteuerId(sid) ? sid : null;
    if (sid && !cleaned.steuerId) warnings.push("Die erkannte Steuer-ID ist nicht plausibel und wurde verworfen.");
    if (cleaned.bruttoarbeitslohn !== null && cleaned.lohnsteuer !== null && cleaned.lohnsteuer > cleaned.bruttoarbeitslohn * 0.5)
      warnings.push("Die Lohnsteuer erscheint im Verhältnis zum Bruttolohn ungewöhnlich hoch – bitte prüfen.");
    lst = cleaned;
  }
  let beleg = e.beleg;
  if (beleg) {
    beleg = {
      ...beleg,
      betrag: clampMoney(beleg.betrag),
      arbeitskosten: clampMoney(beleg.arbeitskosten),
      datum: beleg.datum && /^\d{4}-\d{2}-\d{2}$/.test(beleg.datum) ? beleg.datum : null,
      beschreibung: clip(beleg.beschreibung, 200) ?? "",
      empfaenger: clip(beleg.empfaenger, 200),
    };
    if (beleg.arbeitskosten !== null && beleg.betrag !== null && beleg.arbeitskosten > beleg.betrag) beleg.arbeitskosten = beleg.betrag;
  }
  return {
    ...e,
    personName: clip(e.personName, 120),
    summary: clip(e.summary, 300) ?? "",
    taxYear: e.taxYear && e.taxYear > 2000 && e.taxYear < 2100 ? e.taxYear : null,
    lohnsteuerbescheinigung: lst,
    beleg,
    warnings,
  };
}
