/**
 * Anträge an das Finanzamt, die sonst die Steuerberatung schreibt:
 *  - Herabsetzung der Einkommensteuer-Vorauszahlungen (§ 45 Abs 4 EStG)
 *  - Verlängerung der Beschwerdefrist (§ 245 Abs 3 BAO)
 *  - Zahlungserleichterung: Stundung oder Ratenzahlung (§ 212 BAO)
 *  - Verlängerung der Frist für die Steuererklärung (§ 134 Abs 2 BAO)
 *  - Rückzahlung eines Guthabens am Abgabenkonto (§ 239 BAO)
 */
import { planung } from "./planer";
import type { TaxCase, TaxResult } from "./types";

export const ANTRAEGE = {
  herabsetzung: { titel: "Vorauszahlungen herabsetzen", info: "Wenn dein Gewinn heuer niedriger ist als im Vorauszahlungsbescheid angenommen. Möglich bis 30. September." },
  beschwerdefrist: { titel: "Beschwerdefrist verlängern", info: "Wenn du für die Beschwerde gegen einen Bescheid mehr Zeit brauchst. Muss vor Ablauf der Frist beim Finanzamt sein." },
  zahlungserleichterung: { titel: "Ratenzahlung oder Stundung", info: "Wenn du eine Nachzahlung nicht auf einmal zahlen kannst. Vor dem Fälligkeitstag stellen, sonst droht ein Säumniszuschlag." },
  erklaerungsfrist: { titel: "Frist für die Steuererklärung verlängern", info: "Wenn Unterlagen fehlen und du die Erklärung nicht bis 30. Juni (FinanzOnline) abgeben kannst." },
  rueckzahlung: { titel: "Guthaben zurückfordern", info: "Wenn auf deinem Abgabenkonto ein Guthaben liegt, das nicht automatisch überwiesen wurde." },
} as const;
export type AntragArt = keyof typeof ANTRAEGE;

export interface AntragInput {
  art: AntragArt;
  /** Bisher festgesetzte Vorauszahlung (Jahresbetrag) bzw. Betrag der Nachforderung/des Guthabens */
  betrag: number;
  /** Beantragte Vorauszahlung (Jahresbetrag) */
  beantragt: number;
  /** Anzahl der Monatsraten (0 = Stundung in einem Betrag) */
  raten: number;
  /** Bescheiddatum bzw. Datum, bis zu dem verlängert werden soll (JJJJ-MM-TT) */
  datum: string;
  begruendung: string;
  iban: string;
}

const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const de = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join(".") : "[Datum]");
const ph = (s: string, fallback: string) => s.trim() || fallback;

/** Sinnvolle Vorbelegung aus dem Fall. */
export function antragVorschlag(art: AntragArt, c: TaxCase, r: TaxResult, today = new Date()): AntragInput {
  const base: AntragInput = { art, betrag: 0, beantragt: 0, raten: 6, datum: "", begruendung: "", iban: "" };
  if (art === "herabsetzung") {
    const p = planung(c, r);
    return { ...base, beantragt: Math.round(p.estAufNebeneinkuenfte), begruendung: "Mein Gewinn wird im laufenden Jahr voraussichtlich deutlich niedriger ausfallen als im Vorauszahlungsbescheid angenommen." };
  }
  if (art === "zahlungserleichterung") return { ...base, betrag: Math.max(0, Math.round(-r.erstattung)) };
  if (art === "rueckzahlung") return { ...base, betrag: Math.max(0, Math.round(r.erstattung)) };
  if (art === "erklaerungsfrist") return { ...base, datum: `${today.getUTCFullYear()}-09-30` };
  return base;
}

/** Erzeugt den Antragstext. Platzhalter stehen in [eckigen Klammern]. */
export function antragText(a: AntragInput, c: TaxCase): string {
  const kopf = [
    "An das",
    "Finanzamt Österreich",
    "",
    c.firstName ? `${c.firstName} [Nachname]` : "[Vor- und Nachname]",
    "[Adresse]",
    "Steuernummer: [Steuernummer]",
    "",
  ];
  const fuss = ["", "Mit freundlichen Grüßen", "", "[Unterschrift / Name]"];
  const jahr = new Date().getUTCFullYear();
  let body: string[];
  switch (a.art) {
    case "herabsetzung":
      body = [
        `Antrag auf Herabsetzung der Einkommensteuer-Vorauszahlungen ${jahr} gemäß § 45 Abs. 4 EStG`,
        "",
        "Sehr geehrte Damen und Herren,",
        "",
        `ich beantrage, die Einkommensteuer-Vorauszahlungen für ${jahr} von bisher ${a.betrag ? fmt(a.betrag) : "[bisheriger Jahresbetrag]"} auf ${fmt(a.beantragt)} herabzusetzen.`,
        "",
        "Begründung:",
        ph(a.begruendung, "[Begründung, z. B. Auftragsrückgang, Elternkarenz, Aufgabe der Tätigkeit]"),
        `Nach meiner Prognose beträgt die Einkommensteuer für ${jahr} voraussichtlich ${fmt(a.beantragt)}. Eine Prognoserechnung (Einnahmen und Ausgaben bis [Monat]) lege ich bei.`,
      ];
      break;
    case "beschwerdefrist":
      body = [
        `Antrag auf Verlängerung der Beschwerdefrist gemäß § 245 Abs. 3 BAO`,
        "",
        "Sehr geehrte Damen und Herren,",
        "",
        `betreffend den Bescheid vom ${de(a.datum)} beantrage ich, die Frist zur Einbringung einer Beschwerde bis [neues Datum] zu verlängern.`,
        "",
        "Begründung:",
        ph(a.begruendung, "Zur Begründung der Beschwerde benötige ich noch Unterlagen, die mir derzeit nicht vorliegen ([z. B. Bestätigung des Arbeitgebers, Rechnungen])."),
      ];
      break;
    case "zahlungserleichterung":
      body = [
        `Ansuchen um Zahlungserleichterung gemäß § 212 BAO`,
        "",
        "Sehr geehrte Damen und Herren,",
        "",
        a.raten > 0
          ? `für den Abgabenrückstand von ${a.betrag ? fmt(a.betrag) : "[Betrag]"} ersuche ich um Bewilligung von ${a.raten} Monatsraten zu je ${a.betrag ? fmt(Math.ceil((a.betrag / a.raten) * 100) / 100) : "[Betrag]"}, beginnend mit [Datum der ersten Rate].`
          : `für den Abgabenrückstand von ${a.betrag ? fmt(a.betrag) : "[Betrag]"} ersuche ich um Stundung bis [Datum].`,
        "",
        "Begründung:",
        ph(a.begruendung, "Die sofortige Entrichtung in einem Betrag wäre für mich mit erheblichen Härten verbunden, da [Grund, z. B. Einkommensrückgang, unerwartete Ausgaben]."),
        "Die Einbringlichkeit der Abgaben ist durch die Zahlungserleichterung nicht gefährdet: Ich verfüge über ein regelmäßiges Einkommen von [Betrag] € monatlich.",
        "",
        "Mir ist bekannt, dass für gestundete Beträge über 750 € Stundungszinsen anfallen können.",
      ];
      break;
    case "erklaerungsfrist":
      body = [
        `Antrag auf Verlängerung der Frist zur Einreichung der Steuererklärung ${c.year} gemäß § 134 Abs. 2 BAO`,
        "",
        "Sehr geehrte Damen und Herren,",
        "",
        `ich beantrage, die Frist zur Einreichung der Einkommensteuererklärung ${c.year} bis ${de(a.datum)} zu verlängern.`,
        "",
        "Begründung:",
        ph(a.begruendung, "Mir liegen noch nicht alle für die Erklärung erforderlichen Unterlagen vor ([z. B. Lohnzettel aus dem Ausland, Jahresabrechnung der Hausverwaltung])."),
      ];
      break;
    case "rueckzahlung":
      body = [
        `Antrag auf Rückzahlung eines Guthabens gemäß § 239 BAO`,
        "",
        "Sehr geehrte Damen und Herren,",
        "",
        `ich beantrage, das Guthaben auf meinem Abgabenkonto${a.betrag ? ` in Höhe von ${fmt(a.betrag)}` : ""} auf folgendes Konto zu überweisen:`,
        "",
        `Kontoinhaber:in: [Name]`,
        `IBAN: ${ph(a.iban.replace(/\s+/g, " ").toUpperCase(), "[IBAN]")}`,
      ];
      break;
  }
  return [...kopf, ...body, ...fuss].join("\n");
}
