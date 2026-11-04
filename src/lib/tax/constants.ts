/**
 * Steuerliche Parameter je Veranlagungsjahr.
 *
 * Quellen: §32a EStG (Tarif), §3 SolZG (Soli-Freigrenze), §9 Abs. 2 EStG
 * (Entfernungspauschale), §9a EStG (Arbeitnehmer-Pauschbetrag), §10 Abs. 3 EStG
 * (Höchstbetrag Altersvorsorge), §32 Abs. 6 EStG (Kinderfreibeträge), §66 EStG (Kindergeld).
 *
 * WICHTIG: Jede Änderung hier muss gegen den amtlichen Gesetzestext geprüft
 * und durch einen Test in `calculate.test.ts` abgesichert werden.
 * Werte mit `verified: false` sind vorläufig und vor Produktivbetrieb zu prüfen.
 */

export type TaxYear = 2024 | 2025 | 2026;
export const SUPPORTED_YEARS: TaxYear[] = [2024, 2025, 2026];
export const DEFAULT_YEAR: TaxYear = 2025;

export interface TariffZones {
  /** Grundfreibetrag */
  gfb: number;
  /** Obergrenze Zone 2 (erste Progressionszone) */
  z2End: number;
  z2a: number; // Faktor y²
  /** Obergrenze Zone 3 (zweite Progressionszone) */
  z3End: number;
  z3a: number; // Faktor z²
  z3c: number; // Konstante
  /** Obergrenze Zone 4 (42 %) */
  z4End: number;
  z4c: number;
  z5c: number;
}

export interface YearParams {
  year: TaxYear;
  verified: boolean;
  tariff: TariffZones;
  soliFreigrenzeSingle: number;
  arbeitnehmerPauschbetrag: number;
  sonderausgabenPauschbetrag: number;
  /** Entfernungspauschale €/km für km 1–20 und ab km 21 */
  entfernung: { first20: number; from21: number };
  homeofficePerDay: number;
  homeofficeMaxDays: number;
  /** Höchstbetrag Altersvorsorgeaufwendungen (Einzelveranlagung) */
  altersvorsorgeHoechstbetrag: number;
  /** Höchstbetrag sonstige Vorsorgeaufwendungen für Arbeitnehmer */
  sonstigeVorsorgeMax: number;
  /** Kinderfreibetrag + BEA-Freibetrag (beide Elternteile zusammen) je Kind */
  kinderfreibetragGesamt: number;
  kindergeldMonat: number;
  /** Kinderbetreuungskosten: abziehbarer Anteil und Höchstbetrag je Kind */
  kinderbetreuung: { share: number; max: number };
  entlastungAlleinerziehend: { base: number; perAdditionalChild: number };
}

export const YEAR_PARAMS: Record<TaxYear, YearParams> = {
  2024: {
    year: 2024,
    verified: true,
    tariff: {
      gfb: 11784,
      z2End: 17005, z2a: 954.8,
      z3End: 66760, z3a: 181.19, z3c: 991.21,
      z4End: 277825, z4c: 10636.31,
      z5c: 18971.06,
    },
    soliFreigrenzeSingle: 18130,
    arbeitnehmerPauschbetrag: 1230,
    sonderausgabenPauschbetrag: 36,
    entfernung: { first20: 0.3, from21: 0.38 },
    homeofficePerDay: 6,
    homeofficeMaxDays: 210,
    altersvorsorgeHoechstbetrag: 27566,
    sonstigeVorsorgeMax: 1900,
    kinderfreibetragGesamt: 9540,
    kindergeldMonat: 250,
    kinderbetreuung: { share: 2 / 3, max: 4000 },
    entlastungAlleinerziehend: { base: 4260, perAdditionalChild: 240 },
  },
  2025: {
    year: 2025,
    verified: true,
    tariff: {
      gfb: 12096,
      z2End: 17443, z2a: 932.3,
      z3End: 68480, z3a: 176.64, z3c: 1015.13,
      z4End: 277825, z4c: 10911.92,
      z5c: 19246.67,
    },
    soliFreigrenzeSingle: 19950,
    arbeitnehmerPauschbetrag: 1230,
    sonderausgabenPauschbetrag: 36,
    entfernung: { first20: 0.3, from21: 0.38 },
    homeofficePerDay: 6,
    homeofficeMaxDays: 210,
    altersvorsorgeHoechstbetrag: 29344,
    sonstigeVorsorgeMax: 1900,
    kinderfreibetragGesamt: 9600,
    kindergeldMonat: 255,
    kinderbetreuung: { share: 0.8, max: 4800 },
    entlastungAlleinerziehend: { base: 4260, perAdditionalChild: 240 },
  },
  2026: {
    year: 2026,
    // Vorläufig: vor Produktivbetrieb gegen BGBl. prüfen (insb. Höchstbetrag Altersvorsorge).
    verified: false,
    tariff: {
      gfb: 12348,
      z2End: 17799, z2a: 914.51,
      z3End: 69878, z3a: 173.1, z3c: 1034.87,
      z4End: 277825, z4c: 11135.63,
      z5c: 19470.38,
    },
    soliFreigrenzeSingle: 20350,
    arbeitnehmerPauschbetrag: 1230,
    sonderausgabenPauschbetrag: 36,
    // Ab 2026: 0,38 €/km ab dem ersten Kilometer
    entfernung: { first20: 0.38, from21: 0.38 },
    homeofficePerDay: 6,
    homeofficeMaxDays: 210,
    altersvorsorgeHoechstbetrag: 30826,
    sonstigeVorsorgeMax: 1900,
    kinderfreibetragGesamt: 9756,
    kindergeldMonat: 259,
    kinderbetreuung: { share: 0.8, max: 4800 },
    entlastungAlleinerziehend: { base: 4260, perAdditionalChild: 240 },
  },
};

/** Kirchensteuersatz: 8 % in Bayern und Baden-Württemberg, sonst 9 %. */
export const BUNDESLAENDER = [
  { code: "BW", name: "Baden-Württemberg", kist: 0.08 },
  { code: "BY", name: "Bayern", kist: 0.08 },
  { code: "BE", name: "Berlin", kist: 0.09 },
  { code: "BB", name: "Brandenburg", kist: 0.09 },
  { code: "HB", name: "Bremen", kist: 0.09 },
  { code: "HH", name: "Hamburg", kist: 0.09 },
  { code: "HE", name: "Hessen", kist: 0.09 },
  { code: "MV", name: "Mecklenburg-Vorpommern", kist: 0.09 },
  { code: "NI", name: "Niedersachsen", kist: 0.09 },
  { code: "NW", name: "Nordrhein-Westfalen", kist: 0.09 },
  { code: "RP", name: "Rheinland-Pfalz", kist: 0.09 },
  { code: "SL", name: "Saarland", kist: 0.09 },
  { code: "SN", name: "Sachsen", kist: 0.09 },
  { code: "ST", name: "Sachsen-Anhalt", kist: 0.09 },
  { code: "SH", name: "Schleswig-Holstein", kist: 0.09 },
  { code: "TH", name: "Thüringen", kist: 0.09 },
] as const;

export type BundeslandCode = (typeof BUNDESLAENDER)[number]["code"];

/** §35a EStG */
export const PARA35A = {
  minijobShare: 0.2, minijobMax: 510,
  dienstleistungShare: 0.2, dienstleistungMax: 4000,
  handwerkerShare: 0.2, handwerkerMax: 1200,
};

/** Pauschale Kontoführungsgebühren, von der Finanzverwaltung ohne Nachweis anerkannt. */
export const KONTOFUEHRUNG_PAUSCHALE = 16;
