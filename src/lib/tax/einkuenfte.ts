/**
 * Weitere Einkunftsarten für die Einkommensteuererklärung E1:
 *  - Vermietung und Verpachtung (Beilage E1b): Überschuss der Einnahmen über die Werbungskosten
 *  - Selbständige Arbeit / Gewerbebetrieb (Beilage E1a): Gewinn aus Einnahmen-Ausgaben-Rechnung oder Pauschalierung
 */
import { gwgGrenze, PKW, VERMIETUNG, type YearParams } from "./constants";
import type { Betrieb, Line, Mietobjekt } from "./types";

type Anlage = Betrieb["anlagen"][number];

/** AfA eines Wirtschaftsguts im Jahr `year` (linear, Halbjahresregel, GWG-Sofortabschreibung, Pkw-Luxustangente). */
export function anlageAfa(a: Anlage, year: number): { afa: number; restwert: number; gwg: boolean } {
  const basis = a.pkw ? Math.min(a.kosten, PKW.luxusgrenze) : a.kosten;
  const nd = a.pkw ? Math.max(a.nutzungsdauer, PKW.mindestNutzungsdauer) : a.nutzungsdauer;
  if (year < a.anschaffungsjahr || basis <= 0) return { afa: 0, restwert: basis, gwg: false };
  if (!a.pkw && a.kosten <= gwgGrenze(a.anschaffungsjahr)) {
    return { afa: year === a.anschaffungsjahr ? cents(a.kosten) : 0, restwert: 0, gwg: true };
  }
  const jahres = basis / nd;
  let rest = basis;
  let afa = 0;
  for (let y = a.anschaffungsjahr; y <= year && rest > 0.005; y++) {
    const betrag = Math.min(rest, y === a.anschaffungsjahr && a.anschaffungsmonat > 6 ? jahres / 2 : jahres);
    rest -= betrag;
    if (y === year) afa = betrag;
  }
  return { afa: cents(afa), restwert: cents(Math.max(0, rest)), gwg: false };
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Jahres-AfA eines Gebäudes inkl. beschleunigter AfA (§8 Abs 1a, §16 Abs 1 Z 8 lit d EStG). */
export function gebaeudeAfa(o: Mietobjekt, year: number): { afa: number; satz: number; hinweis?: string } {
  if (o.afaManuell > 0) return { afa: cents(o.afaManuell), satz: 0, hinweis: "manuell" };
  const basis = o.anschaffungskosten * (1 - o.grundanteil / 100);
  if (basis <= 0) return { afa: 0, satz: 0 };
  const jahrIndex = year - o.anschaffungsjahr + 1; // 1 = Jahr der Anschaffung
  if (jahrIndex < 1) return { afa: 0, satz: 0, hinweis: "Anschaffung nach dem Veranlagungsjahr" };
  const base = VERMIETUNG.afa;
  const beschleunigt =
    o.anschaffungsjahr > VERMIETUNG.beschleunigtAb.jahr ||
    (o.anschaffungsjahr === VERMIETUNG.beschleunigtAb.jahr && o.anschaffungsmonat >= VERMIETUNG.beschleunigtAb.monat);
  let satz = base;
  let hinweis: string | undefined;
  if (o.neubau2024bis2026 && jahrIndex <= 3) {
    satz = base * VERMIETUNG.neubauFaktor;
    hinweis = "dreifache AfA für Neubau (fertiggestellt 2024–2026)";
  } else if (beschleunigt && jahrIndex === 1) {
    satz = base * 3;
    hinweis = "beschleunigte AfA (1. Jahr)";
  } else if (beschleunigt && jahrIndex === 2) {
    satz = base * 2;
    hinweis = "beschleunigte AfA (2. Jahr)";
  } else if (!beschleunigt && jahrIndex === 1 && o.anschaffungsmonat > 6) {
    satz = base / 2;
    hinweis = "Halbjahres-AfA";
  }
  // AfA endet, wenn die Bemessungsgrundlage verbraucht ist (vereinfacht: max. Restwert)
  return { afa: cents(Math.min(basis * satz, basis)), satz, hinweis };
}

export function vermietung(o: Mietobjekt, year: number): { ergebnis: number; lines: Line[] } {
  const lines: Line[] = [];
  const afa = gebaeudeAfa(o, year);
  const inst = o.instandsetzungen
    .filter((i) => year >= i.jahr && year < i.jahr + VERMIETUNG.instandsetzungJahre)
    .reduce((a, i) => a + i.betrag / VERMIETUNG.instandsetzungJahre, 0);
  const wk: [string, number, string?][] = [
    ["AfA Gebäude", afa.afa, afa.satz ? `${(afa.satz * 100).toLocaleString("de-DE")} %${afa.hinweis ? ` – ${afa.hinweis}` : ""}` : afa.hinweis],
    ["Fremdfinanzierungszinsen", o.zinsen],
    ["Instandhaltung", o.instandhaltung],
    ["Instandsetzung (1/15)", cents(inst)],
    ["Betriebskosten", o.betriebskosten],
    ["Sonstige Werbungskosten", o.sonstigeWerbungskosten],
  ];
  const wkSumme = cents(wk.reduce((a, [, v]) => a + v, 0));
  const ergebnis = cents(o.einnahmen - wkSumme);
  lines.push({ label: `Vermietung ${o.bezeichnung || "Objekt"}: Einnahmen`, amount: o.einnahmen });
  for (const [label, amount, hint] of wk) if (amount > 0) lines.push({ label: `– ${label}`, amount: -amount, hint });
  return { ergebnis, lines };
}

export function betrieb(b: Betrieb, p: YearParams): { gewinn: number; lines: Line[]; hinweise: string[] } {
  const hinweise: string[] = [];
  const lines: Line[] = [{ label: `${b.art === "gewerbe" ? "Gewerbebetrieb" : "Selbständige Arbeit"} ${b.bezeichnung}: Betriebseinnahmen`.replace(/\s+:/, ":"), amount: b.einnahmen }];
  let ausgaben = b.ausgaben;
  let methode = "Einnahmen-Ausgaben-Rechnung";
  if (b.gewinnermittlung === "basis") {
    if (b.einnahmen > p.basispauschalierung.umsatzgrenze)
      hinweise.push(`Basispauschalierung nur bis ${p.basispauschalierung.umsatzgrenze.toLocaleString("de-DE")} € Umsatz möglich.`);
    const rate = b.reduzierterSatz ? p.basispauschalierung.reduziert : p.basispauschalierung.rate;
    ausgaben = cents(b.einnahmen * rate);
    methode = `Basispauschalierung ${(rate * 100).toLocaleString("de-DE")} %`;
  } else if (b.gewinnermittlung === "klein") {
    if (b.einnahmen > p.kleinunternehmerGrenze)
      hinweise.push(`Kleinunternehmerpauschalierung nur bis ${p.kleinunternehmerGrenze.toLocaleString("de-DE")} € Umsatz möglich.`);
    const rate = b.dienstleistung ? 0.2 : 0.45;
    ausgaben = cents(Math.min(b.einnahmen, p.kleinunternehmerGrenze) * rate);
    methode = `Kleinunternehmerpauschalierung ${rate * 100} %`;
  }
  lines.push({ label: `– Betriebsausgaben (${methode})`, amount: -ausgaben });
  // Abschreibung laut Anlagenverzeichnis – bei Pauschalierung bereits abgegolten
  if (b.anlagen.length) {
    if (b.gewinnermittlung === "ear") {
      const year = p.year;
      const summe = cents(b.anlagen.reduce((s, a) => s + anlageAfa(a, year).afa * (1 - a.privatanteil / 100), 0));
      if (summe > 0) {
        ausgaben = cents(ausgaben + summe);
        const gwg = b.anlagen.filter((a) => anlageAfa(a, year).gwg && a.anschaffungsjahr === year).length;
        lines.push({ label: "– Abschreibung (AfA) laut Anlagenverzeichnis", amount: -summe, hint: gwg ? `inkl. ${gwg} geringwertige(s) Wirtschaftsgut/-güter sofort abgeschrieben` : undefined });
      }
    } else hinweise.push("Bei Pauschalierung ist die Abschreibung in der Pauschale enthalten – das Anlagenverzeichnis wirkt sich nicht aus.");
  }
  if (b.sozialversicherung > 0) lines.push({ label: "– Sozialversicherung (SVS)", amount: -b.sozialversicherung });
  const vorGfb = cents(b.einnahmen - ausgaben - b.sozialversicherung);
  const gfb = vorGfb > 0 ? cents(Math.min(vorGfb, p.gewinnfreibetrag.bis) * p.gewinnfreibetrag.rate) : 0;
  if (gfb > 0) lines.push({ label: "– Gewinnfreibetrag (Grundfreibetrag)", amount: -gfb, hint: `${p.gewinnfreibetrag.rate * 100} % bis ${p.gewinnfreibetrag.bis.toLocaleString("de-DE")} € Gewinn` });

  // Investitionsbedingter Gewinnfreibetrag: nur bei Einnahmen-Ausgaben-Rechnung, gedeckt durch begünstigte Investitionen
  let inv = 0;
  if (vorGfb > p.gewinnfreibetrag.bis) {
    let prev = p.gewinnfreibetrag.bis;
    let moeglich = 0;
    for (const [bis, satz] of p.gewinnfreibetrag.stufen) {
      if (vorGfb <= prev) break;
      moeglich += (Math.min(vorGfb, bis) - prev) * satz;
      prev = bis;
    }
    moeglich = cents(moeglich);
    if (b.gewinnermittlung !== "ear") {
      if (moeglich > 0) hinweise.push("Den investitionsbedingten Gewinnfreibetrag gibt es nur ohne Pauschalierung.");
    } else {
      inv = cents(Math.min(moeglich, b.investitionen));
      if (inv > 0) lines.push({ label: "– Investitionsbedingter Gewinnfreibetrag", amount: -inv, hint: `gedeckt durch Investitionen von ${b.investitionen.toLocaleString("de-DE")} €` });
      if (moeglich - inv >= 100)
        hinweise.push(`Mit weiteren begünstigten Investitionen (z. B. Wertpapiere laut §14 EStG) von bis zu ${Math.round(moeglich - inv).toLocaleString("de-DE")} € könntest du den Gewinnfreibetrag voll nutzen.`);
    }
  }
  return { gewinn: cents(vorGfb - gfb - inv), lines, hinweise };
}

/** Freibetrag für Nebeneinkünfte bis 730 €, eingeschliffen bis 1.460 € (§41 Abs 3 EStG). */
export function veranlagungsfreibetrag(neben: number, grenze: number): number {
  if (neben <= 0) return 0;
  if (neben <= grenze) return cents(neben);
  if (neben < 2 * grenze) return cents(2 * grenze - neben);
  return 0;
}
