import { z } from "zod";
import { BUNDESLAENDER, SUPPORTED_YEARS, type TaxYear } from "./constants";

const money = z.number().finite().min(0).max(100_000_000);
const optMoney = money.default(0);

/** Daten aus einer elektronischen Lohnsteuerbescheinigung (Zeilennummern des amtlichen Musters). */
export const EmploymentSchema = z.object({
  id: z.string().max(64),
  employer: z.string().max(200).default(""),
  /** Zeile 3: Bruttoarbeitslohn */
  bruttoarbeitslohn: optMoney,
  /** Zeile 4: einbehaltene Lohnsteuer */
  lohnsteuer: optMoney,
  /** Zeile 5: einbehaltener Solidaritätszuschlag */
  soli: optMoney,
  /** Zeile 6: Kirchensteuer des Arbeitnehmers */
  kirchensteuer: optMoney,
  /** Zeile 7: Kirchensteuer des Ehegatten (konfessionsverschiedene Ehe) */
  kirchensteuerEhegatte: optMoney,
  /** Zeile 15: Kurzarbeitergeld, Zuschuss Mutterschaftsgeld u. a. (Progressionsvorbehalt) */
  lohnersatzleistungen: optMoney,
  /** Zeilen 17+18: steuerfreie Arbeitgeberleistungen für Fahrten Wohnung–Arbeit */
  steuerfreieFahrtkosten: optMoney,
  /** Zeile 22a: Arbeitgeberanteil Rentenversicherung */
  rvArbeitgeber: optMoney,
  /** Zeile 23a: Arbeitnehmeranteil Rentenversicherung */
  rvArbeitnehmer: optMoney,
  /** Zeile 24a+b: steuerfreie Arbeitgeberzuschüsse zur Kranken-/Pflegeversicherung (PKV) */
  zuschuesseKvPv: optMoney,
  /** Zeile 25: Arbeitnehmerbeiträge gesetzliche Krankenversicherung */
  kvArbeitnehmer: optMoney,
  /** Zeile 26: Arbeitnehmerbeiträge soziale Pflegeversicherung */
  pvArbeitnehmer: optMoney,
  /** Zeile 27: Arbeitnehmerbeiträge Arbeitslosenversicherung */
  alvArbeitnehmer: optMoney,
  /** Zeile 28: Beiträge private Kranken-/Pflege-Pflichtversicherung (Basisabsicherung) */
  pkvBasis: optMoney,
});
export type Employment = z.infer<typeof EmploymentSchema>;

export const ExpenseSchema = z.object({
  id: z.string().max(64),
  label: z.string().max(200),
  amount: money,
  /** Verweis auf hochgeladenen Beleg (optional) */
  documentId: z.string().max(64).optional(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const PersonSchema = z.object({
  firstName: z.string().max(100).default(""),
  lastName: z.string().max(100).default(""),
  churchMember: z.boolean().default(false),
  employments: z.array(EmploymentSchema).max(10).default([]),
  /** Einfache Entfernung Wohnung – erste Tätigkeitsstätte in km */
  commuteKm: z.number().min(0).max(1000).default(0),
  /** Tage, an denen die Arbeitsstätte aufgesucht wurde */
  commuteDays: z.number().int().min(0).max(366).default(0),
  /** Tage im Homeoffice (Tagespauschale) */
  homeofficeDays: z.number().int().min(0).max(366).default(0),
  /** Arbeitsmittel, Fortbildung, Fachliteratur, Bewerbungen … */
  workExpenses: z.array(ExpenseSchema).max(200).default([]),
  /** Kontoführungspauschale (16 €) ansetzen */
  kontofuehrung: z.boolean().default(true),
  /** Elterngeld, Arbeitslosengeld I u. a. (nicht auf der Lohnsteuerbescheinigung) */
  weitereLohnersatzleistungen: optMoney,
});
export type Person = z.infer<typeof PersonSchema>;

export const ChildSchema = z.object({
  id: z.string().max(64),
  firstName: z.string().max(100).default(""),
  birthYear: z.number().int().min(1950).max(2100),
  /** Monate mit Kindergeldanspruch im Jahr */
  months: z.number().int().min(0).max(12).default(12),
  /** Anteil der Kinderfreibeträge: 1 = voll (Zusammenveranlagung/Übertragung), 0.5 = halb */
  share: z.union([z.literal(1), z.literal(0.5)]).default(1),
  /** Kinderbetreuungskosten (Kita, Tagesmutter …), nur Betreuungsanteil, unbar gezahlt */
  betreuungskosten: optMoney,
});
export type Child = z.infer<typeof ChildSchema>;

export const TaxCaseSchema = z.object({
  year: z.number().refine((y): y is TaxYear => (SUPPORTED_YEARS as number[]).includes(y)),
  filing: z.enum(["single", "joint"]).default("single"),
  bundesland: z.enum(BUNDESLAENDER.map((b) => b.code) as [string, ...string[]]).default("NW"),
  alleinerziehend: z.boolean().default(false),
  persons: z.array(PersonSchema).min(1).max(2),
  children: z.array(ChildSchema).max(15).default([]),
  /** Spenden und Mitgliedsbeiträge an steuerbegünstigte Organisationen */
  spenden: z.array(ExpenseSchema).max(200).default([]),
  /** Krankheitskosten u. a. außergewöhnliche Belastungen (§33 EStG) */
  krankheitskosten: z.array(ExpenseSchema).max(200).default([]),
  /** Lohnkostenanteile §35a EStG */
  haushaltsnaheDienstleistungen: z.array(ExpenseSchema).max(200).default([]),
  handwerkerleistungen: z.array(ExpenseSchema).max(200).default([]),
  minijobImHaushalt: optMoney,
});
export type TaxCase = z.infer<typeof TaxCaseSchema>;

export function emptyPerson(): Person {
  return PersonSchema.parse({});
}

export function emptyCase(year: TaxYear): TaxCase {
  return TaxCaseSchema.parse({ year, persons: [emptyPerson()] });
}

/* ---------- Ergebnis ---------- */

export interface Line {
  label: string;
  amount: number;
  hint?: string;
}

export interface PersonResult {
  name: string;
  bruttoarbeitslohn: number;
  werbungskostenTatsaechlich: number;
  werbungskostenAngesetzt: number;
  werbungskostenDetails: Line[];
  einkuenfte: number;
  progressionsvorbehalt: number;
  withheld: { lohnsteuer: number; soli: number; kirchensteuer: number };
}

export interface TaxResult {
  year: TaxYear;
  filing: "single" | "joint";
  provisional: boolean;
  persons: PersonResult[];
  gesamtbetragDerEinkuenfte: number;
  sonderausgaben: Line[];
  sonderausgabenSumme: number;
  aussergewoehnlicheBelastungen: Line[];
  aussergewoehnlicheBelastungenSumme: number;
  kinderfreibetraegeAngesetzt: boolean;
  kinderfreibetraege: number;
  entlastungsbetragAlleinerziehend: number;
  zuVersteuerndesEinkommen: number;
  tariflicheEinkommensteuer: number;
  steuersatzProgression: number | null;
  steuerermaessigung35a: Line[];
  kindergeldHinzurechnung: number;
  festzusetzen: { einkommensteuer: number; soli: number; kirchensteuer: number; summe: number };
  bereitsGezahlt: { lohnsteuer: number; soli: number; kirchensteuer: number; summe: number };
  /** positiv = Erstattung, negativ = Nachzahlung */
  erstattung: number;
  grenzsteuersatz: number;
  durchschnittssteuersatz: number;
  hinweise: string[];
  pflichtveranlagung: string[];
}
