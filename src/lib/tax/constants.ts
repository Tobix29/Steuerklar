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

export type TaxYear = 2021 | 2022 | 2023 | 2024 | 2025 | 2026;
/** Die Arbeitnehmerveranlagung ist bis zu fünf Jahre rückwirkend möglich. */
export const SUPPORTED_YEARS: TaxYear[] = [2021, 2022, 2023, 2024, 2025, 2026];
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
  svRueckerstattung: { rate: number; max: number; maxPendler: number; /** Höchstbetrag enthält bereits den Zuschlag (2022) */ inklZuschlag?: boolean };
  kirchenbeitragMax: number;
  telearbeit: { perDay: number; maxDays: number };
  mobiliarMax: number;
  /** Zeitweise Erhöhung des Pendlerpauschales (Mai 2022 – Juni 2023: +50 %), als Jahresfaktor */
  pendlerFaktor: number;
  /** Pensionistenabsetzbetrag (§33 Abs 6): normal und erhöht, linear eingeschliffen bis `to` */
  pension: {
    pab: number; from: number;
    pabErhoeht: number; fromErhoeht: number;
    to: number;
    partnerLimit: number;
    /** SV-Rückerstattung für Pensionist:innen */
    svRate: number; svMax: number;
  };
  /** Unterhaltsabsetzbetrag je Monat: 1. Kind, 2. Kind, jedes weitere */
  uab: [number, number, number];
  /** Gewinnfreibetrag (Grundfreibetrag): Anteil und Gewinngrenze */
  gewinnfreibetrag: { rate: number; bis: number; /** Investitionsbedingter Teil: Obergrenzen und Sätze */ stufen: [number, number][] };
  /** Basispauschalierung: Satz, reduzierter Satz, Umsatzgrenze */
  basispauschalierung: { rate: number; reduziert: number; umsatzgrenze: number };
  /** Kleinunternehmerpauschalierung: Umsatzgrenze */
  kleinunternehmerGrenze: number;
  /** Teuerungsabsetzbetrag (nur 2022) */
  teuerung?: { amount: number; from: number; to: number; pensionFrom: number; pensionTo: number };
}

const PENDLER_KLEIN = { from20: 696, from40: 1356, from60: 2016 };
const PENDLER_GROSS = { from2: 372, from20: 1476, from40: 2568, from60: 3672 };

export const YEAR_PARAMS: Record<TaxYear, YearParams> = {
  2021: {
    year: 2021,
    unverified: ["svRueckerstattung", "pension.from/to", "pension.svRate", "pension.svMax"],
    brackets: [
      { upTo: 11000, rate: 0 },
      { upTo: 18000, rate: 0.2 },
      { upTo: 31000, rate: 0.35 },
      { upTo: 60000, rate: 0.42 },
      { upTo: 90000, rate: 0.48 },
      { upTo: 1_000_000, rate: 0.5 },
      { upTo: Infinity, rate: 0.55 },
    ],
    werbungskostenpauschale: 132,
    vab: 400,
    vabZuschlag: { amount: 650, from: 15500, to: 21500 },
    pendlereuroPerKm: 2,
    pendlerKlein: PENDLER_KLEIN,
    pendlerGross: PENDLER_GROSS,
    familienbonus: { under18: 1500.12, over18: 500.04 },
    kindermehrbetrag: 250,
    avab: { oneChild: 494, twoChildren: 669, perFurtherChild: 220 },
    avabPartnerIncomeLimit: 6000,
    svRueckerstattung: { rate: 0.5, max: 400, maxPendler: 500 },
    kirchenbeitragMax: 400,
    telearbeit: { perDay: 3, maxDays: 100 },
    mobiliarMax: 300,
    pendlerFaktor: 1,
    pension: { pab: 825, from: 17500, pabErhoeht: 1214, fromErhoeht: 19930, to: 25000, partnerLimit: 2200, svRate: 0.75, svMax: 300 },
    uab: [29.2, 43.8, 58.4],
    gewinnfreibetrag: { rate: 0.15, bis: 30000, stufen: [[175000, 0.13], [350000, 0.07], [580000, 0.045]] },
    basispauschalierung: { rate: 0.12, reduziert: 0.06, umsatzgrenze: 220000 },
    kleinunternehmerGrenze: 35000,
  },
  2022: {
    year: 2022,
    // 2022: Tarifsenkung auf 32,5 % (Mischsatz), Familienbonus rückwirkend erhöht, Pendlerpauschale/-euro ab Mai erhöht,
    // Teuerungsabsetzbetrag (bis 500 €) ist NICHT abgebildet.
    unverified: ["svRueckerstattung.maxPendler", "pendlerFaktor", "pendlereuroPerKm", "pension.from/to"],
    brackets: [
      { upTo: 11000, rate: 0 },
      { upTo: 18000, rate: 0.2 },
      { upTo: 31000, rate: 0.325 },
      { upTo: 60000, rate: 0.42 },
      { upTo: 90000, rate: 0.48 },
      { upTo: 1_000_000, rate: 0.5 },
      { upTo: Infinity, rate: 0.55 },
    ],
    werbungskostenpauschale: 132,
    vab: 400,
    vabZuschlag: { amount: 650, from: 16000, to: 24500 },
    // 2 € + 0,50 € je km und Monat für Mai–Dezember
    pendlereuroPerKm: 6,
    pendlerKlein: PENDLER_KLEIN,
    pendlerGross: PENDLER_GROSS,
    familienbonus: { under18: 2000.16, over18: 650.16 },
    kindermehrbetrag: 550,
    avab: { oneChild: 494, twoChildren: 669, perFurtherChild: 220 },
    avabPartnerIncomeLimit: 6000,
    // Teuerungs-Entlastungspaket: 70 % der SV-Beiträge, max. 1.550 € (inkl. Zuschlag)
    svRueckerstattung: { rate: 0.7, max: 1550, maxPendler: 1550, inklZuschlag: true },
    kirchenbeitragMax: 400,
    telearbeit: { perDay: 3, maxDays: 100 },
    mobiliarMax: 300,
    pendlerFaktor: 4 / 12 + (8 / 12) * 1.5,
    // 2022: SV-Rückerstattung Pensionist:innen 100 %, max. 1.050 € (Teuerungs-Entlastungspaket)
    pension: { pab: 825, from: 17500, pabErhoeht: 1214, fromErhoeht: 19930, to: 25000, partnerLimit: 2200, svRate: 1, svMax: 1050 },
    uab: [29.2, 43.8, 58.4],
    gewinnfreibetrag: { rate: 0.15, bis: 30000, stufen: [[175000, 0.13], [350000, 0.07], [580000, 0.045]] },
    basispauschalierung: { rate: 0.12, reduziert: 0.06, umsatzgrenze: 220000 },
    kleinunternehmerGrenze: 35000,
    teuerung: { amount: 500, from: 18200, to: 24500, pensionFrom: 20500, pensionTo: 25500 },
  },
  2023: {
    year: 2023,
    unverified: ["svRueckerstattung.maxPendler", "pendlerFaktor", "pendlereuroPerKm", "pension.svRate", "pension.svMax"],
    brackets: [
      { upTo: 11693, rate: 0 },
      { upTo: 19134, rate: 0.2 },
      { upTo: 32075, rate: 0.3 },
      { upTo: 62080, rate: 0.41 },
      { upTo: 93120, rate: 0.48 },
      { upTo: 1_000_000, rate: 0.5 },
      { upTo: Infinity, rate: 0.55 },
    ],
    werbungskostenpauschale: 132,
    vab: 421,
    vabZuschlag: { amount: 684, from: 16832, to: 25774 },
    // 2 € + 0,50 € je km und Monat für Jänner–Juni
    pendlereuroPerKm: 5,
    pendlerKlein: PENDLER_KLEIN,
    pendlerGross: PENDLER_GROSS,
    familienbonus: { under18: 2000.16, over18: 650.16 },
    kindermehrbetrag: 550,
    avab: { oneChild: 520, twoChildren: 704, perFurtherChild: 232 },
    avabPartnerIncomeLimit: 6312,
    svRueckerstattung: { rate: 0.55, max: 421, maxPendler: 526 },
    kirchenbeitragMax: 400,
    telearbeit: { perDay: 3, maxDays: 100 },
    mobiliarMax: 300,
    pendlerFaktor: (6 / 12) * 1.5 + 6 / 12,
    pension: { pab: 868, from: 18410, pabErhoeht: 1278, fromErhoeht: 20967, to: 26826, partnerLimit: 2315, svRate: 0.8, svMax: 579 },
    uab: [31, 47, 62],
    gewinnfreibetrag: { rate: 0.15, bis: 30000, stufen: [[175000, 0.13], [350000, 0.07], [580000, 0.045]] },
    basispauschalierung: { rate: 0.12, reduziert: 0.06, umsatzgrenze: 220000 },
    kleinunternehmerGrenze: 35000,
  },
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
    pendlerFaktor: 1,
    pension: { pab: 954, from: 20233, pabErhoeht: 1405, fromErhoeht: 23043, to: 29482, partnerLimit: 2545, svRate: 0.8, svMax: 618 },
    uab: [35, 52, 69],
    gewinnfreibetrag: { rate: 0.15, bis: 33000, stufen: [[178000, 0.13], [353000, 0.07], [583000, 0.045]] },
    basispauschalierung: { rate: 0.12, reduziert: 0.06, umsatzgrenze: 220000 },
    kleinunternehmerGrenze: 35000,
  },
  2025: {
    year: 2025,
    unverified: ["svRueckerstattung.maxPendler", "avabPartnerIncomeLimit", "pension.partnerLimit", "pension.svMax"],
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
    pendlerFaktor: 1,
    pension: { pab: 1002, from: 21245, pabErhoeht: 1476, fromErhoeht: 24196, to: 30957, partnerLimit: 2674, svRate: 0.8, svMax: 711 },
    uab: [37, 55, 73],
    gewinnfreibetrag: { rate: 0.15, bis: 33000, stufen: [[178000, 0.13], [353000, 0.07], [583000, 0.045]] },
    basispauschalierung: { rate: 0.135, reduziert: 0.0675, umsatzgrenze: 320000 },
    kleinunternehmerGrenze: 55000,
  },
  2026: {
    year: 2026,
    unverified: ["svRueckerstattung", "familienbonus.over18", "avabPartnerIncomeLimit", "pension.svRate"],
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
    pendlerFaktor: 1,
    pension: { pab: 1020, from: 21614, pabErhoeht: 1502, fromErhoeht: 24616, to: 31494, partnerLimit: 2720, svRate: 0.8, svMax: 723 },
    uab: [38, 56, 75],
    gewinnfreibetrag: { rate: 0.15, bis: 33000, stufen: [[178000, 0.13], [353000, 0.07], [583000, 0.045]] },
    basispauschalierung: { rate: 0.15, reduziert: 0.075, umsatzgrenze: 420000 },
    kleinunternehmerGrenze: 55000,
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

/** Pauschbeträge bei Behinderung (§35 Abs 3 EStG), Jahresbeträge nach Grad der Behinderung. */
export const BEHINDERUNG_PAUSCHBETRAG = [
  { from: 95, amount: 1198 },
  { from: 85, amount: 837 },
  { from: 75, amount: 718 },
  { from: 65, amount: 599 },
  { from: 55, amount: 486 },
  { from: 45, amount: 401 },
  { from: 35, amount: 164 },
  { from: 25, amount: 124 },
];

/** Weitere Pauschalen ohne Selbstbehalt (VO über außergewöhnliche Belastungen, §34 Abs 8 EStG). */
export const AGB_PAUSCHALEN = {
  /** Freibetrag für eigenes Kfz bei Gehbehinderung, je Monat (§3 VO über außergewöhnliche Belastungen, BMF) */
  kfzBehinderungMonat: 190,
  /** Auswärtige Berufsausbildung eines Kindes, je begonnenem Monat (§34 Abs 8 EStG) */
  auswaertigeAusbildungMonat: 110,
};

/** Vermietung: AfA-Sätze für Gebäude (§16 Abs 1 Z 8 EStG) */
export const VERMIETUNG = {
  afa: 0.015,
  /** Beschleunigte AfA für Anschaffung/Herstellung nach dem 30.6.2020: 1. Jahr 3-fach, 2. Jahr 2-fach */
  beschleunigtAb: { jahr: 2020, monat: 7 },
  /** Wohngebäude, fertiggestellt 2024–2026: 3-facher Satz in den ersten drei Jahren */
  neubauFaktor: 3,
  instandsetzungJahre: 15,
};

/** Umsatzsteuer-Kleinunternehmergrenze (§6 Abs 1 Z 27 UStG): bis 2024 netto 35.000 €, ab 2025 brutto 55.000 € */
export function kleinunternehmerUst(year: number): { grenze: number; brutto: boolean; toleranz: number } {
  return year >= 2025 ? { grenze: 55_000, brutto: true, toleranz: 0.1 } : { grenze: 35_000, brutto: false, toleranz: 0.15 };
}

/** Immobilienertragsteuer (§30a EStG): 30 %; Altvermögen pauschal 4,2 % (umgewidmet 18 %) des Erlöses, bis 2026 */
export const IMMOEST = { satz: 0.3, altPauschal: 0.042, altUmgewidmet: 0.18, altBasis: 0.14, altBasisUmgewidmet: 0.6 };

/** Geringwertige Wirtschaftsgüter: sofort absetzbar bis (§13 EStG) – 800 € bis 2022, 1.000 € ab 2023 */
export const gwgGrenze = (year: number) => (year >= 2023 ? 1000 : 800);
/** Pkw: Angemessenheitsgrenze (Luxustangente) und Mindestnutzungsdauer (§8 Abs 6, §20 Abs 1 Z 2 lit b EStG) */
export const PKW = { luxusgrenze: 40_000, mindestNutzungsdauer: 8 };

/** Sozialversicherung der Selbständigen (GSVG) – jährliche Werte; 2025 vorläufig wie 2026 (zu verifizieren) */
export const SVS = {
  pv: 0.185,
  kv: 0.068,
  vorsorge: 0.0153,
  uvMonat: 12.95,
  mindestMonat: 551.1,
  hoechstMonat: 8085,
};

/** Umsatzsteuervoranmeldung: monatlich ab 100.000 € Vorjahresumsatz; Abgabepflicht ab 55.000 € (bis 2024: 35.000 €) */
export const UVA = { monatlichAb: 100_000, abgabepflichtAb: (year: number) => (year >= 2025 ? 55_000 : 35_000) };

/** Veranlagungsfreibetrag für Nebeneinkünfte (§41 Abs 3 EStG), eingeschliffen bis zum Doppelten */
export const VERANLAGUNGSFREIBETRAG = 730;

/** Stammt nicht aus Primärquellen geprüft – vor Produktivbetrieb verifizieren (gilt jahresübergreifend). */
export const UNVERIFIED_GLOBAL = ["VERMIETUNG.neubauFaktor", "IMMOEST.altBasis (Regelbesteuerung Altvermögen)", "SVS-Werte (Stand 2026)"];

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
  gewerkschaft: { label: "Gewerkschaftsbeiträge (nicht vom Arbeitgeber abgezogen)", kz: "717" },
  digitale_arbeitsmittel: { label: "Digitale Arbeitsmittel (Computer, Internet)", kz: "169" },
  arbeitsmittel: { label: "Arbeitsmittel (Werkzeug, Berufskleidung)", kz: "719" },
  fachliteratur: { label: "Fachliteratur", kz: "720" },
  reisekosten: { label: "Beruflich veranlasste Reisekosten", kz: "721" },
  fortbildung: { label: "Fort-, Ausbildung und Umschulung", kz: "722" },
  sonstige: { label: "Sonstige Werbungskosten", kz: "724" },
} as const;
export type WkKategorie = keyof typeof WK_KATEGORIEN;

/** Fristen der Arbeitnehmerveranlagung: freiwillig 5 Jahre, Pflichtveranlagung bis 30. September des Folgejahres. */
export function fristen(year: number, today = new Date()) {
  const antrag = new Date(Date.UTC(year + 5, 11, 31, 23, 59, 59));
  const pflicht = new Date(Date.UTC(year + 1, 8, 30, 23, 59, 59));
  const yearEnded = today.getTime() > Date.UTC(year, 11, 31, 23, 59, 59);
  const daysLeft = Math.ceil((antrag.getTime() - today.getTime()) / 86_400_000);
  return { antrag, pflicht, yearEnded, daysLeft, expired: daysLeft < 0, urgent: daysLeft >= 0 && daysLeft <= 90 };
}
