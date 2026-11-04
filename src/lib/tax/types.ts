import { z } from "zod";
import { BUNDESLAENDER, SUPPORTED_YEARS, WK_KATEGORIEN, type TaxYear, type WkKategorie } from "./constants";

const money = z.number().finite().min(0).max(100_000_000);
const optMoney = money.default(0);

/** Werte aus dem Jahreslohnzettel L16 (Kennzahlen des amtlichen Formulars). */
export const LohnzettelSchema = z.object({
  id: z.string().max(64),
  arbeitgeber: z.string().max(200).default(""),
  /** Aktivbezug (Dienstverhältnis) oder Pension */
  art: z.enum(["aktiv", "pension"]).default("aktiv"),
  /** KZ 210: Bruttobezüge */
  kz210: optMoney,
  /** KZ 215: steuerfreie Bezüge */
  kz215: optMoney,
  /** KZ 220: sonstige Bezüge (13./14. Gehalt) vor Abzug der SV-Beiträge innerhalb des Jahressechstels */
  kz220: optMoney,
  /** KZ 225: SV-Beiträge für sonstige Bezüge */
  kz225: optMoney,
  /** KZ 230: SV-Beiträge für laufende Bezüge */
  kz230: optMoney,
  /** KZ 245: steuerpflichtige Bezüge */
  kz245: optMoney,
  /** KZ 260: einbehaltene Lohnsteuer */
  kz260: optMoney,
  /** KZ 717: vom Arbeitgeber einbehaltene Gewerkschaftsbeiträge */
  kz717: optMoney,
  /** KZ 718: vom Arbeitgeber berücksichtigte Pendlerpauschale */
  kz718: optMoney,
  /** KZ 916: vom Arbeitgeber berücksichtigter Pendlereuro */
  kz916: optMoney,
});
export type Lohnzettel = z.infer<typeof LohnzettelSchema>;

export const ExpenseSchema = z.object({
  id: z.string().max(64),
  label: z.string().max(200),
  amount: money,
  category: z.enum(Object.keys(WK_KATEGORIEN) as [WkKategorie, ...WkKategorie[]]).optional(),
  documentId: z.string().max(64).optional(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const ChildSchema = z.object({
  id: z.string().max(64),
  firstName: z.string().max(100).default(""),
  birthYear: z.number().int().min(1950).max(2100),
  /** Monate mit Familienbeihilfe im Jahr */
  months: z.number().int().min(0).max(12).default(12),
  /** Anteil Familienbonus Plus: 1 = ganz, 0.5 = Aufteilung mit dem anderen Elternteil */
  familienbonusShare: z.union([z.literal(1), z.literal(0.5)]).default(1),
  /** Monate einer Berufsausbildung außerhalb des Wohnorts (kein Ausbildungsort im Umkreis von 80 km) */
  auswaertigeAusbildungMonate: z.number().int().min(0).max(12).default(0),
});
export type Child = z.infer<typeof ChildSchema>;

export const TaxCaseSchema = z.object({
  year: z.number().refine((y): y is TaxYear => (SUPPORTED_YEARS as number[]).includes(y)),
  firstName: z.string().max(100).default(""),
  lastName: z.string().max(100).default(""),
  bundesland: z.enum(BUNDESLAENDER.map((b) => b.code) as [string, ...string[]]).default("W"),
  lohnzettel: z.array(LohnzettelSchema).max(10).default([]),

  /** Arbeitsweg: einfache Strecke in km (Ergebnis des Pendlerrechners) */
  pendlerKm: z.number().min(0).max(1000).default(0),
  /** Benützung öffentlicher Verkehrsmittel zumutbar? (kleines vs. großes Pendlerpauschale) */
  oeffiZumutbar: z.boolean().default(true),
  /** Fahrten zur Arbeitsstätte pro Kalendermonat (≥ 11 volle, 8–10: 2/3, 4–7: 1/3) */
  fahrtenProMonat: z.number().int().min(0).max(31).default(0),

  /** Telearbeitstage (Homeoffice) und vom Arbeitgeber steuerfrei gezahlte Telearbeitspauschale */
  telearbeitstage: z.number().int().min(0).max(366).default(0),
  telearbeitspauschaleArbeitgeber: optMoney,
  /** Ergonomisch geeignetes Mobiliar (KZ 158) */
  mobiliar: optMoney,
  werbungskosten: z.array(ExpenseSchema).max(200).default([]),
  /** Kosten der Zweitwohnung am Arbeitsort (KZ 723) */
  doppelteHaushaltsfuehrung: optMoney,
  /** Fahrten zum Familienwohnsitz (KZ 300), gedeckelt mit dem höchsten Pendlerpauschale */
  familienheimfahrten: optMoney,

  /** Sonderausgaben */
  kirchenbeitrag: optMoney,
  spenden: z.array(ExpenseSchema).max(200).default([]),
  steuerberatung: z.array(ExpenseSchema).max(50).default([]),

  /** Grad der Behinderung in % (ab 25 % Pauschbetrag) und Kfz-Freibetrag bei Gehbehinderung */
  behinderungGrad: z.number().int().min(0).max(100).default(0),
  behinderungKfz: z.boolean().default(false),

  /** Außergewöhnliche Belastungen mit Selbstbehalt */
  krankheitskosten: z.array(ExpenseSchema).max(200).default([]),

  children: z.array(ChildSchema).max(15).default([]),
  /** Kinder, für die gesetzlicher Unterhalt gezahlt wird (nicht im eigenen Haushalt) – Monate mit Unterhaltszahlung */
  unterhaltKinder: z
    .array(z.object({ id: z.string().max(64), firstName: z.string().max(100).default(""), months: z.number().int().min(0).max(12).default(12) }))
    .max(15)
    .default([]),
  /** Pension: Antrag auf erhöhten Pensionistenabsetzbetrag (Ehe/Partnerschaft, geringe Partnereinkünfte) */
  pensionErhoeht: z.boolean().default(false),
  /** Kapitalerträge mit Sondersteuersatz und bereits einbehaltene KESt (für die Regelbesteuerungsoption) */
  kapital: z
    .object({ ertraege275: optMoney, ertraege25: optMoney, kestBezahlt: optMoney })
    .default({ ertraege275: 0, ertraege25: 0, kestBezahlt: 0 }),
  familienstatus: z.enum(["keine", "alleinverdiener", "alleinerzieher"]).default("keine"),
  /** Einkünfte der Partnerin/des Partners (für den Alleinverdienerabsetzbetrag) */
  partnerEinkuenfte: optMoney,
});
export type TaxCase = z.infer<typeof TaxCaseSchema>;

export function emptyCase(year: TaxYear): TaxCase {
  return TaxCaseSchema.parse({ year });
}

/* ---------- Ergebnis ---------- */

export interface Line {
  label: string;
  amount: number;
  hint?: string;
  /** Kennzahl im Formular L1/L1k */
  kz?: string;
}

export interface FormEntry {
  formular: "L1" | "L1k" | "E1kv";
  kz: string;
  label: string;
  value: string;
}

export interface TaxResult {
  year: TaxYear;
  provisional: boolean;
  unverified: string[];
  laufendeBezuege: number;
  sonstigeBezuege: number;
  steuerSonstigeBezuege: number;
  werbungskosten: Line[];
  werbungskostenSumme: number;
  einkuenfte: number;
  sonderausgaben: Line[];
  sonderausgabenSumme: number;
  aussergewoehnlicheBelastungen: Line[];
  aussergewoehnlicheBelastungenSumme: number;
  einkommen: number;
  tarifsteuer: number;
  absetzbetraege: Line[];
  /** Negativsteuer (AVAB/AEAB, SV-Rückerstattung, Kindermehrbetrag) */
  negativsteuer: Line[];
  /** Einkommensteuer gesamt inkl. Steuer auf sonstige Bezüge (negativ = Gutschrift) */
  einkommensteuer: number;
  anrechenbareLohnsteuer: number;
  /** positiv = Gutschrift, negativ = Nachforderung */
  erstattung: number;
  grenzsteuersatz: number;
  durchschnittssteuersatz: number;
  formular: FormEntry[];
  /** Ergebnis der Günstigerprüfung für Kapitalerträge */
  kapitalOption: { empfohlen: boolean; erstattung: number; mehrsteuer: number } | null;
  hinweise: string[];
  pflichtveranlagung: string[];
}
