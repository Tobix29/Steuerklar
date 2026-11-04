/**
 * Steuerliche Parameter Österreich je Veranlagungsjahr (Arbeitnehmerveranlagung).
 *
 * Rechtsgrundlagen: §33 EStG 1988 (Tarif, Absetzbeträge), §16 Abs 1 Z 6 EStG (Pendlerpauschale),
 * §33 Abs 5 Z 4 (Pendlereuro), §16 Abs 3 (Werbungskostenpauschale), §18 (Sonderausgaben),
 * §34 (außergewöhnliche Belastungen), §67 (sonstige Bezüge), §33 Abs 3a (Familienbonus Plus).
 *
 * Seit 2023 werden Tarifstufen und Absetzbeträge jährlich an die Inflation angepasst
 * (Abschaffung der kalten Progression). Werte in `unverified` sind aus Sekundärquellen
 * übernommen bzw. widersprüchlich belegt und MÜSSEN vor dem Produktivbetrieb gegen
 * EStG (RIS) und das BMF-Steuerbuch geprüft werden. Jede Änderung → Test in calculate.test.ts.
 */

export type TaxYear = 2024 | 2025 | 2026;
export const SUPPORTED_YEARS: TaxYear[] = [2024, 2025, 2026];
/** Im Herbst 2026 wird typischerweise die Arbeitnehmerveranlagung 2025 gemacht. */
export const DEFAULT_YEAR: TaxYear = 2025;

export interface Bracket {
  /** Obergrenze der Stufe (Einkommen in €) */
  upTo: number;
  rate: number;
}

export interface YearParams {
  year: TaxYear;
  /** Liste der Parameter, die noch nicht gegen Primärquellen geprüft sind */
  unverified: string[];
  brackets: Bracket[];
  werbungskostenpauschale: number;
  /** Verkehrsabsetzbetrag */
  vab: number;
  /** Zuschlag zum Verkehrsabsetzbetrag und Einschleifbereich (Einkommen) */
  vabZuschlag: { amount: number; from: number; to: number };
  /** Pendlereuro je km einfacher Strecke und Jahr */
  pendlereuroPerKm: number;
  /** Jahresbeträge Pendlerpauschale */
  pendlerKlein: { from20: number; from40: number; from60: number };
  pendlerGross: { from2: number; from20: number; from40: number; from60: number };
  /** Familienbonus Plus pro Kind und Jahr */
  familienbonus: { under18: number; over18: number };
  /** Kindermehrbetrag pro Kind (Negativsteuer für Geringverdienende) */
  kindermehrbetrag: number;
  /** Alleinverdiener-/Alleinerzieherabsetzbetrag */
  avab: { oneChild: number; twoChildren: number; perFurtherChild: number };
  avabPartnerIncomeLimit: number;
  /** SV-Rückerstattung: Anteil der SV-Beiträge und Höchstbeträge */
  svRueckerstattung: { rate: number; max: number; maxPendler: number };
  kirchenbeitragMax: number;
  telearbeit: { perDay: number; maxDays: number };
  mobiliarMax: number;
}

export const YEAR_PARAMS: Record<TaxYear, YearParams> = {
  2024: {
    year: 2024,
    unverified: ["vabZuschlag", "svRueckerstattung.maxPendler", "avabPartnerIncomeLimit"],
    brackets: [
      { upTo: 12816, rate: 0 },
      { upTo: 20818, rate: 0.2 },
      { upTo: 34513, rate: 0.3 },
      { upTo: 66612, rate: 0.4 },
      { upTo: 99266, rate: 0.48 },
      { upTo: 1_000_000, rate: 0.5 },
      { upTo: Infinity, rate: 0.55 },
    ],
    werbungskostenpauschale: 132,
    vab: 463,
    vabZuschlag: { amount: 752, from: 18499, to: 28326 },
    pendlereuroPerKm: 2,
    pendlerKlein: { from20: 696, from40: 1356, from60: 2016 },
    pendlerGross: { from2: 372, from20: 1476, from40: 2568, from60: 3672 },
    familienbonus: { under18: 2000.16, over18: 700.08 },
    kindermehrbetrag: 700,
    avab: { oneChild: 572, twoChildren: 774, perFurtherChild: 255 },
    avabPartnerIncomeLimit: 6937,
    svRueckerstattung: { rate: 0.55, max: 463, maxPendler: 579 },
    kirchenbeitragMax: 600,
    telearbeit: { perDay: 3, maxDays: 100 },
    mobiliarMax: 300,
  },
  2025: {
    year: 2025,
    unverified: ["svRueckerstattung.maxPendler", "avabPartnerIncomeLimit"],
    brackets: [
      { upTo: 13308, rate: 0 },
      { upTo: 21617, rate: 0.2 },
      { upTo: 35836, rate: 0.3 },
      { upTo: 69166, rate: 0.4 },
      { upTo: 103072, rate: 0.48 },
      { upTo: 1_000_000, rate: 0.5 },
      { upTo: Infinity, rate: 0.55 },
    ],
    werbungskostenpauschale: 132,
    vab: 487,
    vabZuschlag: { amount: 790, from: 19424, to: 29743 },
    pendlereuroPerKm: 2,
    pendlerKlein: { from20: 696, from40: 1356, from60: 2016 },
    pendlerGross: { from2: 372, from20: 1476, from40: 2568, from60: 3672 },
    familienbonus: { under18: 2000.16, over18: 700.08 },
    kindermehrbetrag: 700,
    avab: { oneChild: 601, twoChildren: 813, perFurtherChild: 268 },
    avabPartnerIncomeLimit: 7284,
    svRueckerstattung: { rate: 0.55, max: 487, maxPendler: 608 },
    kirchenbeitragMax: 600,
    telearbeit: { perDay: 3, maxDays: 100 },
    mobiliarMax: 300,
  },
  2026: {
    year: 2026,
    unverified: ["vab", "vabZuschlag", "svRueckerstattung", "familienbonus.over18", "avabPartnerIncomeLimit"],
    brackets: [
      { upTo: 13539, rate: 0 },
      { upTo: 21992, rate: 0.2 },
      { upTo: 36458, rate: 0.3 },
      { upTo: 70365, rate: 0.4 },
      { upTo: 104859, rate: 0.48 },
      { upTo: 1_000_000, rate: 0.5 },
      { upTo: Infinity, rate: 0.55 },
    ],
    werbungskostenpauschale: 132,
    vab: 496,
    vabZuschlag: { amount: 804, from: 19761, to: 30259 },
    // Ab 2026 verdreifacht (6 € statt 2 € je km)
    pendlereuroPerKm: 6,
    pendlerKlein: { from20: 696, from40: 1356, from60: 2016 },
    pendlerGross: { from2: 372, from20: 1476, from40: 2568, from60: 3672 },
    familienbonus: { under18: 2000.16, over18: 700.08 },
    kindermehrbetrag: 700,
    avab: { oneChild: 612, twoChildren: 828, perFurtherChild: 273 },
    avabPartnerIncomeLimit: 7411,
    svRueckerstattung: { rate: 0.55, max: 496, maxPendler: 614 },
    kirchenbeitragMax: 600,
    telearbeit: { perDay: 3, maxDays: 100 },
    mobiliarMax: 300,
  },
};

/** Besteuerung sonstiger Bezüge innerhalb des Jahressechstels (§67 Abs 1 EStG). */
export const SONSTIGE_BEZUEGE = {
  freigrenze: 2100,
  bands: [
    { size: 620, rate: 0 },
    { size: 24380, rate: 0.06 },
    { size: 25000, rate: 0.27 },
    { size: 33333, rate: 0.3575 },
  ],
};

/** Selbstbehalt bei außergewöhnlichen Belastungen (§34 Abs 4 EStG) */
export const SELBSTBEHALT = [
  { upTo: 7300, rate: 0.06 },
  { upTo: 14600, rate: 0.08 },
  { upTo: 36400, rate: 0.1 },
  { upTo: Infinity, rate: 0.12 },
];

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

/** Werbungskosten-Kategorien mit Kennzahl im Formular L1 (Zuordnung vor Produktivbetrieb verifizieren). */
export const WK_KATEGORIEN = {
  digitale_arbeitsmittel: { label: "Digitale Arbeitsmittel (Computer, Internet)", kz: "169" },
  arbeitsmittel: { label: "Arbeitsmittel (Werkzeug, Berufskleidung)", kz: "719" },
  fachliteratur: { label: "Fachliteratur", kz: "720" },
  reisekosten: { label: "Beruflich veranlasste Reisekosten", kz: "721" },
  fortbildung: { label: "Fort-, Ausbildung und Umschulung", kz: "722" },
  sonstige: { label: "Sonstige Werbungskosten", kz: "724" },
} as const;
export type WkKategorie = keyof typeof WK_KATEGORIEN;
