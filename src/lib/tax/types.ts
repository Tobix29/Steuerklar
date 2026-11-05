import { z } from "zod";
import { BUNDESLAENDER, SUPPORTED_YEARS, WK_KATEGORIEN, type TaxYear, type WkKategorie } from "./constants";
import { E1A_KEYS } from "./journal";

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

/** Vermietetes Objekt (Beilage E1b). */
export const MietobjektSchema = z.object({
  id: z.string().max(64),
  bezeichnung: z.string().max(200).default(""),
  /** Mieteinnahmen netto (ohne USt) inkl. weiterverrechneter Betriebskosten */
  einnahmen: optMoney,
  /** Anschaffungs-/Herstellungskosten inkl. Grund */
  anschaffungskosten: optMoney,
  /** Anteil Grund und Boden in % (pauschal 20/30/40 % laut GrundanteilVO, oder Gutachten) */
  grundanteil: z.number().min(0).max(100).default(20),
  anschaffungsjahr: z.number().int().min(1900).max(2100).default(2020),
  anschaffungsmonat: z.number().int().min(1).max(12).default(1),
  /** Wohngebäude, fertiggestellt 2024–2026 (dreifache AfA in den ersten drei Jahren) */
  neubau2024bis2026: z.boolean().default(false),
  /** Manuelle Jahres-AfA (z. B. aus dem Vorjahresbescheid) – überschreibt die Berechnung, wenn > 0 */
  afaManuell: optMoney,
  zinsen: optMoney,
  instandhaltung: optMoney,
  /** Instandsetzungen, die auf 15 Jahre verteilt werden */
  instandsetzungen: z.array(z.object({ id: z.string().max(64), jahr: z.number().int().min(1990).max(2100), betrag: money })).max(30).default([]),
  betriebskosten: optMoney,
  sonstigeWerbungskosten: optMoney,
  /** Umsatzsteuer: Wohnung 10 %, Geschäftsraum/Garage 20 %, steuerfrei 0 % */
  ustSatz: z.union([z.literal(0), z.literal(10), z.literal(13), z.literal(20)]).default(10),
  vorsteuer: optMoney,
});
export type Mietobjekt = z.infer<typeof MietobjektSchema>;

/** Selbständige Arbeit oder Gewerbebetrieb (Beilage E1a). */
export const BetriebSchema = z.object({
  id: z.string().max(64),
  bezeichnung: z.string().max(200).default(""),
  art: z.enum(["selbstaendig", "gewerbe"]).default("selbstaendig"),
  /** Betriebseinnahmen netto (ohne USt) */
  einnahmen: optMoney,
  gewinnermittlung: z.enum(["ear", "basis", "klein"]).default("ear"),
  /** Tatsächliche Betriebsausgaben (ohne Sozialversicherung) – bei Einnahmen-Ausgaben-Rechnung */
  ausgaben: optMoney,
  /** Bezahlte SVS-Beiträge (immer zusätzlich abziehbar) */
  sozialversicherung: optMoney,
  /** Basispauschalierung: Tätigkeit mit reduziertem Satz (z. B. Beratung, Vortrag, Schriftsteller) */
  reduzierterSatz: z.boolean().default(false),
  /** Rechnungsaussteller:in (für Ausgangsrechnungen nach § 11 UStG) */
  firma: z
    .object({
      name: z.string().max(200).default(""),
      adresse: z.string().max(400).default(""),
      uid: z.string().max(20).default(""),
      iban: z.string().max(40).default(""),
      bic: z.string().max(15).default(""),
      email: z.string().max(200).default(""),
      /** Kleinunternehmerbefreiung auf Rechnungen ausweisen (§ 6 Abs 1 Z 27 UStG) */
      kleinunternehmer: z.boolean().default(true),
    })
    .default({ name: "", adresse: "", uid: "", iban: "", bic: "", email: "", kleinunternehmer: true }),
  rechnungen: z
    .array(
      z.object({
        id: z.string().max(64),
        nummer: z.string().max(40),
        datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        leistungVon: z.string().max(10).default(""),
        leistungBis: z.string().max(10).default(""),
        kunde: z
          .object({ name: z.string().max(200).default(""), adresse: z.string().max(400).default(""), uid: z.string().max(20).default("") })
          .default({ name: "", adresse: "", uid: "" }),
        positionen: z
          .array(z.object({ text: z.string().max(300).default(""), menge: z.number().finite().min(0).max(1_000_000).default(1), einheit: z.string().max(20).default("Stk."), preis: money, ustSatz: z.union([z.literal(20), z.literal(13), z.literal(10), z.literal(0)]).default(20) }))
          .max(50)
          .default([]),
        zahlungszielTage: z.number().int().min(0).max(365).default(14),
        reverseCharge: z.boolean().default(false),
        notiz: z.string().max(1000).default(""),
        /** Zahlungseingang (JJJJ-MM-TT) – erzeugt eine Buchung „Erlöse“ im Journal */
        bezahltAm: z.string().max(10).default(""),
        storniert: z.boolean().default(false),
      }),
    )
    .max(2000)
    .default([]),
  /** Einnahmen-Ausgaben-Journal: wenn vorhanden, ersetzen die Summen Einnahmen, Ausgaben, Vorsteuer und SVS */
  buchungen: z
    .array(
      z.object({
        id: z.string().max(64),
        datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        kategorie: z.enum(E1A_KEYS),
        beschreibung: z.string().max(200).default(""),
        /** Nettobetrag (ohne USt); bei Kleinunternehmer-Einnahmen der Rechnungsbetrag */
        netto: money,
        /** Umsatzsteuer bzw. Vorsteuer laut Rechnung */
        ust: optMoney,
        privatanteil: z.number().min(0).max(100).default(0),
      }),
    )
    .max(3000)
    .default([]),
  /** Anlagenverzeichnis: abnutzbares Anlagevermögen (Computer, Möbel, Auto …) – Abschreibung über die Nutzungsdauer */
  anlagen: z
    .array(
      z.object({
        id: z.string().max(64),
        bezeichnung: z.string().max(200).default(""),
        anschaffungsjahr: z.number().int().min(1990).max(2100),
        anschaffungsmonat: z.number().int().min(1).max(12).default(1),
        /** Anschaffungskosten (netto, wenn Vorsteuerabzug möglich) */
        kosten: money,
        nutzungsdauer: z.number().int().min(1).max(50).default(3),
        /** Privater Nutzungsanteil in % */
        privatanteil: z.number().min(0).max(100).default(0),
        /** Pkw: Luxustangente 40.000 € und mindestens 8 Jahre Nutzungsdauer */
        pkw: z.boolean().default(false),
      }),
    )
    .max(100)
    .default([]),
  /** Begünstigte Investitionen (abnutzbare Anlagen, Wohnbauanleihen u. a.) für den investitionsbedingten Gewinnfreibetrag */
  investitionen: optMoney,
  /** Kleinunternehmerpauschalierung: Dienstleistungsbetrieb (20 % statt 45 %) */
  dienstleistung: z.boolean().default(false),
  ustSatz: z.union([z.literal(0), z.literal(10), z.literal(13), z.literal(20)]).default(20),
  vorsteuer: optMoney,
});
export type Betrieb = z.infer<typeof BetriebSchema>;

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
  mietobjekte: z.array(MietobjektSchema).max(20).default([]),
  betriebe: z.array(BetriebSchema).max(10).default([]),
  /** Noch nicht verrechnete betriebliche Verluste aus Vorjahren (Verlustvortrag, §18 Abs 6 EStG) */
  verlustvortrag: optMoney,
  /** AMS-Bezüge (Arbeitslosengeld, Notstandshilfe, Weiterbildungsgeld …): steuerfrei, aber Hochrechnung nach §3 Abs 2 EStG */
  ams: z
    .object({ betrag: optMoney, monate: z.number().int().min(0).max(12).default(0) })
    .default({ betrag: 0, monate: 0 }),
  /** Pension: Antrag auf erhöhten Pensionistenabsetzbetrag (Ehe/Partnerschaft, geringe Partnereinkünfte) */
  pensionErhoeht: z.boolean().default(false),
  /** Kapitalerträge mit Sondersteuersatz und bereits einbehaltene KESt (für die Regelbesteuerungsoption) */
  kapital: z
    .object({
      ertraege275: optMoney,
      ertraege25: optMoney,
      kestBezahlt: optMoney,
      /** Realisierte Verluste (Aktien, Fonds …), die die Bank nicht schon verrechnet hat – z. B. bei mehreren Depots */
      verluste275: optMoney,
      /** Erträge mit 27,5 % ohne KESt-Abzug: ausländisches Depot, Kryptowährungen (Neuvermögen) an ausländischen Börsen, Staking */
      ohneKest275: optMoney,
    })
    .default({ ertraege275: 0, ertraege25: 0, kestBezahlt: 0, verluste275: 0, ohneKest275: 0 }),
  /** Sonstige Einkünfte (§ 29 EStG) */
  sonstige: z
    .object({
      /** Spekulationsgeschäfte (§ 31): Verkauf von Gold, Kunst, Sammlerstücken … innerhalb eines Jahres nach Kauf */
      spekulation: optMoney,
      /** Gelegentliche Leistungen (§ 29 Z 3): Vermittlungsprovisionen, gelegentliche Vermietung von Auto, Gegenständen … */
      leistungen: optMoney,
    })
    .default({ spekulation: 0, leistungen: 0 }),
  /** Ausländische Einkünfte (Formular L1i bzw. E1) */
  ausland: z
    .array(
      z.object({
        id: z.string().max(64),
        land: z.string().max(80).default(""),
        art: z.enum(["nichtselbstaendig", "pension", "sonstige"]).default("nichtselbstaendig"),
        /** Einkünfte in Euro (nach ausländischer Sozialversicherung) */
        betrag: optMoney,
        /** Laut Doppelbesteuerungsabkommen: steuerfrei mit Progressionsvorbehalt oder Anrechnung der Auslandssteuer */
        methode: z.enum(["befreiung", "anrechnung"]).default("befreiung"),
        steuerAusland: optMoney,
      }),
    )
    .max(10)
    .default([]),
  /** Private Grundstücksverkäufe (ImmoESt) */
  immobilienverkaeufe: z
    .array(
      z.object({
        id: z.string().max(64),
        bezeichnung: z.string().max(200).default(""),
        erloes: optMoney,
        anschaffungskosten: optMoney,
        /** Herstellungs- und Instandsetzungskosten seit dem Erwerb */
        herstellungskosten: optMoney,
        /** Bei Vermietung bereits geltend gemachte AfA (erhöht den Gewinn) */
        afaGeltend: optMoney,
        anschaffungsjahr: z.number().int().min(1900).max(2100).default(2010),
        /** Altvermögen: letzter Erwerb vor dem 31.3.2002 */
        altvermoegen: z.boolean().default(false),
        /** Umwidmung in Bauland nach 1987 (nur Altvermögen) */
        umgewidmet: z.boolean().default(false),
        /** Hauptwohnsitzbefreiung erfüllt (2 Jahre seit Erwerb durchgehend oder 5 der letzten 10 Jahre Hauptwohnsitz) */
        hauptwohnsitz: z.boolean().default(false),
        /** Herstellerbefreiung: selbst errichtetes Gebäude (Grund bleibt steuerpflichtig) – Gebäudeanteil in % */
        herstellerGebaeudeanteil: z.number().min(0).max(100).default(0),
        /** ImmoESt wurde vom Notar bzw. Rechtsanwalt selbst berechnet und abgeführt */
        abgefuehrt: optMoney,
      }),
    )
    .max(10)
    .default([]),
  /** Umsatzsteuer: auf die Kleinunternehmerbefreiung verzichten (Regelbesteuerung, Vorsteuerabzug) */
  ustVerzicht: z.boolean().default(false),
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
  formular: "L1" | "L1k" | "L1i" | "E1" | "E1a" | "E1b" | "E1kv" | "U1";
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
  /** Einkünfte aus Vermietung (E1b) und selbständiger/gewerblicher Tätigkeit (E1a) */
  weitereEinkuenfte: Line[];
  /** Freibetrag für Nebeneinkünfte bis 730 € (§41 Abs 3 EStG) */
  veranlagungsfreibetrag: number;
  /** Gesamtbetrag der Einkünfte */
  gesamtbetragDerEinkuenfte: number;
  /** Statt L1 ist die Einkommensteuererklärung E1 abzugeben */
  e1Erforderlich: boolean;
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
  /** Umsatzsteuer (eigene Erklärung U1, nicht Teil der Einkommensteuer) */
  umsatzsteuer: {
    umsatz: number;
    grenze: number;
    kleinunternehmer: boolean;
    zahllast: number;
    lines: Line[];
  } | null;
  /** Immobilienertragsteuer aus privaten Grundstücksverkäufen */
  immoESt: { lines: Line[]; steuer: number; abgefuehrt: number; regelGuenstiger: boolean } | null;
  /** Hochrechnung wegen AMS-Bezügen: fiktiver Betrag, ob die Kontrollrechnung greift, Mehrsteuer gegenüber ohne Hochrechnung */
  ams: { hochrechnung: number; kontrollrechnung: boolean; mehrsteuer: number } | null;
  /** Ergebnis der Günstigerprüfung für Kapitalerträge */
  kapitalOption: { empfohlen: boolean; erstattung: number; mehrsteuer: number; verlustausgleich: number } | null;
  hinweise: string[];
  pflichtveranlagung: string[];
}
