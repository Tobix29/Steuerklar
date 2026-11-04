/**
 * Laufende Buchhaltung für Selbständige: Einnahmen-Ausgaben-Journal (Zufluss-Abfluss-Prinzip, § 19 EStG).
 * Aus den Buchungen ergeben sich Betriebseinnahmen, Betriebsausgaben, Vorsteuer und SVS für die E1a bzw. U1.
 *
 * Kennzahlen: Nur die bestätigten E1a-Kennzahlen sind hinterlegt (9040, 9100, 9110, 9120). Für alle anderen Kategorien
 * ändert das BMF die Kennzahlen je nach Jahr – sie stehen im Formular E1a des jeweiligen Jahres.
 */
import { gwgGrenze, kleinunternehmerUst } from "./constants";
import type { Betrieb, TaxCase } from "./types";

export const E1A_KATEGORIEN = {
  erloese: { label: "Erlöse (Honorare, Verkäufe)", art: "einnahme", kz: "9040" },
  sonstigeEinnahmen: { label: "Sonstige Betriebseinnahmen", art: "einnahme" },
  waren: { label: "Waren, Rohstoffe, Material", art: "ausgabe", kz: "9100" },
  fremdleistungen: { label: "Fremdleistungen, Subunternehmer", art: "ausgabe", kz: "9110" },
  personal: { label: "Personal (Löhne, Lohnnebenkosten)", art: "ausgabe", kz: "9120" },
  reise: { label: "Reisekosten, Kilometergeld, Diäten", art: "ausgabe" },
  kfz: { label: "Kfz-Kosten (Treibstoff, Service, Versicherung)", art: "ausgabe" },
  miete: { label: "Miete, Pacht, Leasing", art: "ausgabe" },
  buero: { label: "Büro, Telefon, Internet, Software", art: "ausgabe" },
  werbung: { label: "Werbung, Website, Marketing", art: "ausgabe" },
  bewirtung: { label: "Geschäftsessen (Bewirtung, 50 %)", art: "ausgabe", anteil: 0.5 },
  fortbildung: { label: "Fortbildung, Fachliteratur", art: "ausgabe" },
  beratung: { label: "Steuer- und Rechtsberatung, Buchhaltung", art: "ausgabe" },
  versicherung: { label: "Betriebliche Versicherungen, Kammerumlage", art: "ausgabe" },
  zinsen: { label: "Zinsen, Bankspesen", art: "ausgabe" },
  gwg: { label: "Geringwertige Wirtschaftsgüter (sofort absetzbar)", art: "ausgabe" },
  svs: { label: "SVS-Beiträge", art: "ausgabe" },
  sonstige: { label: "Übrige Betriebsausgaben", art: "ausgabe" },
} as const satisfies Record<string, { label: string; art: "einnahme" | "ausgabe"; kz?: string; anteil?: number }>;
export type E1aKategorie = keyof typeof E1A_KATEGORIEN;
export const E1A_KEYS = Object.keys(E1A_KATEGORIEN) as [E1aKategorie, ...E1aKategorie[]];

export type Buchung = Betrieb["buchungen"][number];

const cents = (n: number) => Math.round(n * 100) / 100;
const info = (k: E1aKategorie): { label: string; art: "einnahme" | "ausgabe"; kz?: string; anteil?: number } => E1A_KATEGORIEN[k];

export interface JournalSummen {
  einnahmen: number;
  ustEinnahmen: number;
  ausgaben: number;
  vorsteuer: number;
  svs: number;
  /** Je Kategorie: absetzbarer Nettobetrag (nach Privatanteil und Bewirtungskürzung) */
  kategorien: { key: E1aKategorie; label: string; kz?: string; art: "einnahme" | "ausgabe"; betrag: number; anzahl: number }[];
  /** Buchungen außerhalb des Jahres (zählen nicht) */
  ausserhalb: number;
  hinweise: string[];
}

/** Summiert die Buchungen eines Jahres. `vorsteuerAbzug=false` (Kleinunternehmer): Vorsteuer wird zur Ausgabe. */
export function journalSummen(buchungen: Buchung[], year: number, vorsteuerAbzug = true): JournalSummen {
  const map = new Map<E1aKategorie, { betrag: number; anzahl: number }>();
  let einnahmen = 0, ustEinnahmen = 0, ausgaben = 0, vorsteuer = 0, svs = 0, ausserhalb = 0;
  const hinweise: string[] = [];
  let gwgZuGross = 0;
  for (const b of buchungen) {
    if (!b.datum.startsWith(`${year}-`)) {
      ausserhalb++;
      continue;
    }
    const k = info(b.kategorie);
    const betrieblich = 1 - b.privatanteil / 100;
    let betrag: number;
    if (k.art === "einnahme") {
      betrag = b.netto;
      einnahmen += b.netto;
      ustEinnahmen += b.ust;
    } else {
      const vst = vorsteuerAbzug ? b.ust * betrieblich : 0;
      const basis = vorsteuerAbzug ? b.netto : b.netto + b.ust;
      betrag = basis * betrieblich * (k.anteil ?? 1);
      vorsteuer += vst;
      if (b.kategorie === "svs") svs += betrag;
      else ausgaben += betrag;
      if (b.kategorie === "gwg" && basis > gwgGrenze(year)) gwgZuGross++;
    }
    const m = map.get(b.kategorie) ?? { betrag: 0, anzahl: 0 };
    m.betrag += betrag;
    m.anzahl++;
    map.set(b.kategorie, m);
  }
  if (gwgZuGross) hinweise.push(`${gwgZuGross} Anschaffung(en) über ${gwgGrenze(year).toLocaleString("de-DE")} € als GWG gebucht – diese gehören ins Anlagenverzeichnis und werden über die Nutzungsdauer abgeschrieben.`);
  if (ausserhalb) hinweise.push(`${ausserhalb} Buchung(en) mit Datum außerhalb von ${year} zählen nicht (Zufluss-Abfluss-Prinzip).`);
  const kategorien = E1A_KEYS.filter((k) => map.has(k)).map((k) => ({ key: k, label: info(k).label, kz: info(k).kz, art: info(k).art, betrag: cents(map.get(k)!.betrag), anzahl: map.get(k)!.anzahl }));
  return { einnahmen: cents(einnahmen), ustEinnahmen: cents(ustEinnahmen), ausgaben: cents(ausgaben), vorsteuer: cents(vorsteuer), svs: cents(svs), kategorien, ausserhalb, hinweise };
}

/** Kleinunternehmer-Prüfung wie in der Umsatzsteuer-Berechnung (vor der eigentlichen Berechnung, damit Vorsteuer richtig behandelt wird). */
function istKleinunternehmer(c: TaxCase, einnahmenJe: (b: Betrieb) => number): boolean {
  const ku = kleinunternehmerUst(c.year);
  const q = [
    ...c.betriebe.map((b) => ({ netto: einnahmenJe(b), satz: b.ustSatz })),
    ...c.mietobjekte.map((o) => ({ netto: o.einnahmen, satz: o.ustSatz })),
  ];
  const summe = q.reduce((a, x) => a + (ku.brutto ? x.netto * (1 + x.satz / 100) : x.netto), 0);
  return summe <= ku.grenze && !c.ustVerzicht;
}

/** Ersetzt bei Betrieben mit Journal die Summenfelder durch die Werte aus den Buchungen. */
export function mitJournal(c: TaxCase): TaxCase {
  if (!c.betriebe.some((b) => b.buchungen.length)) return c;
  const einnahmenJe = (b: Betrieb) => (b.buchungen.length ? journalSummen(b.buchungen, c.year).einnahmen : b.einnahmen);
  const klein = istKleinunternehmer(c, einnahmenJe);
  return {
    ...c,
    betriebe: c.betriebe.map((b) => {
      if (!b.buchungen.length) return b;
      const s = journalSummen(b.buchungen, c.year, !klein);
      return { ...b, einnahmen: s.einnahmen, ausgaben: s.ausgaben, vorsteuer: s.vorsteuer, sozialversicherung: s.svs };
    }),
  };
}

/** CSV-Export (Semikolon, deutsches Zahlenformat) – Aufbewahrungspflicht 7 Jahre (§ 132 BAO). */
export function journalCsv(buchungen: Buchung[]): string {
  const n = (x: number) => x.toFixed(2).replace(".", ",");
  const q = (s: string) => `"${s.replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;
  const rows = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum));
  const head = "Datum;Art;Kategorie;Beschreibung;Netto;USt;Brutto;Privatanteil %;Belegnummer";
  return [
    head,
    ...rows.map((b, i) => {
      const k = info(b.kategorie);
      return [b.datum, k.art === "einnahme" ? "Einnahme" : "Ausgabe", q(k.label), q(b.beschreibung), n(b.netto), n(b.ust), n(b.netto + b.ust), String(b.privatanteil), String(i + 1)].join(";");
    }),
  ].join("\r\n") + "\r\n";
}
