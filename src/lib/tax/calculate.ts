/**
 * Einkommensteuer-Berechnung für Arbeitnehmer:innen (Veranlagung nach §25 EStG).
 *
 * Abgedeckt: Einkünfte aus nichtselbständiger Arbeit, Werbungskosten
 * (Entfernungspauschale, Homeoffice, Arbeitsmittel …), Vorsorgeaufwendungen,
 * Kirchensteuer, Spenden, Kinderbetreuung, Krankheitskosten (§33),
 * §35a-Ermäßigungen, Kinderfreibeträge mit Günstigerprüfung, Entlastungsbetrag
 * für Alleinerziehende, Progressionsvorbehalt, Splittingtarif, Soli, Kirchensteuer.
 *
 * Nicht abgedeckt (→ Hinweis an Nutzer:innen): Selbständige/Gewerbe, Vermietung,
 * Kapitalerträge über dem Sparer-Pauschbetrag, Renten, Verlustvorträge,
 * Auslandseinkünfte, doppelte Haushaltsführung.
 */
import { BUNDESLAENDER, KONTOFUEHRUNG_PAUSCHALE, PARA35A, YEAR_PARAMS, type TaxYear, type YearParams } from "./constants";
import type { Line, Person, PersonResult, TaxCase, TaxResult } from "./types";

const cents = (n: number) => Math.round(n * 100) / 100;
const floorCents = (n: number) => Math.floor(Number((n * 100).toFixed(6))) / 100;
const sum = (xs: { amount: number }[]) => cents(xs.reduce((a, x) => a + x.amount, 0));

/** Grundtarif §32a Abs. 1 EStG. Ergebnis auf volle Euro abgerundet. */
export function grundtarif(zvE: number, p: YearParams): number {
  const x = Math.floor(Math.max(0, zvE));
  const t = p.tariff;
  let tax: number;
  if (x <= t.gfb) tax = 0;
  else if (x <= t.z2End) {
    const y = (x - t.gfb) / 10000;
    tax = (t.z2a * y + 1400) * y;
  } else if (x <= t.z3End) {
    const z = (x - t.z2End) / 10000;
    tax = (t.z3a * z + 2397) * z + t.z3c;
  } else if (x <= t.z4End) tax = 0.42 * x - t.z4c;
  else tax = 0.45 * x - t.z5c;
  return Math.floor(tax + 1e-9);
}

/** Tarifliche ESt, bei Zusammenveranlagung Splittingverfahren (§32a Abs. 5 EStG). */
export function tarif(zvE: number, joint: boolean, p: YearParams): number {
  if (!joint) return grundtarif(zvE, p);
  return 2 * grundtarif(Math.floor(Math.max(0, zvE)) / 2, p);
}

/** Tarifliche ESt inkl. Progressionsvorbehalt (§32b EStG). */
export function tarifMitProgression(zvE: number, progression: number, joint: boolean, p: YearParams) {
  const base = Math.floor(Math.max(0, zvE));
  if (progression <= 0 || base <= 0) return { tax: tarif(base, joint, p), rate: null as number | null };
  const extended = Math.floor(Math.max(0, base + progression));
  if (extended <= 0) return { tax: 0, rate: 0 };
  const rate = Math.floor((tarif(extended, joint, p) / extended) * 10000) / 10000; // auf 4 Nachkommastellen
  return { tax: Math.floor(base * rate), rate };
}

/** Solidaritätszuschlag inkl. Freigrenze und Milderungszone (§§3, 4 SolZG). */
export function solidaritaetszuschlag(bmg: number, joint: boolean, p: YearParams): number {
  const fg = p.soliFreigrenzeSingle * (joint ? 2 : 1);
  if (bmg <= fg) return 0;
  return floorCents(Math.min(0.055 * bmg, 0.119 * (bmg - fg)));
}

export function entfernungspauschale(km: number, days: number, p: YearParams): number {
  const k = Math.floor(Math.max(0, km)); // nur volle Kilometer
  const perDay = Math.min(k, 20) * p.entfernung.first20 + Math.max(k - 20, 0) * p.entfernung.from21;
  return cents(perDay * Math.max(0, days));
}

/** Zumutbare Belastung §33 Abs. 3 EStG – stufenweise Berechnung (BFH VI R 75/14). */
export function zumutbareBelastung(gde: number, joint: boolean, kids: number): number {
  const rates =
    kids >= 3 ? [0.01, 0.01, 0.02] : kids >= 1 ? [0.02, 0.03, 0.04] : joint ? [0.04, 0.05, 0.06] : [0.05, 0.06, 0.07];
  const bounds = [15340, 51130, Infinity];
  let prev = 0;
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const upper = bounds[i]!;
    const portion = Math.max(0, Math.min(gde, upper) - prev);
    total += portion * rates[i]!;
    prev = upper;
    if (gde <= upper) break;
  }
  return cents(total);
}

function personResult(person: Person, index: number, p: YearParams): PersonResult {
  const e = person.employments;
  const brutto = cents(e.reduce((a, x) => a + x.bruttoarbeitslohn, 0));
  const fahrtErstattung = e.reduce((a, x) => a + x.steuerfreieFahrtkosten, 0);

  const details: Line[] = [];
  const fahrt = entfernungspauschale(person.commuteKm, person.commuteDays, p);
  if (fahrt > 0) {
    const net = cents(Math.max(0, fahrt - fahrtErstattung));
    details.push({
      label: `Entfernungspauschale (${person.commuteDays} Tage × ${Math.floor(person.commuteKm)} km)`,
      amount: net,
      hint: fahrtErstattung > 0 ? `abzgl. ${fahrtErstattung.toFixed(2)} € steuerfreie Arbeitgebererstattung` : undefined,
    });
  }
  const hoDays = Math.min(person.homeofficeDays, p.homeofficeMaxDays);
  if (hoDays > 0) {
    details.push({
      label: `Homeoffice-Pauschale (${hoDays} Tage × ${p.homeofficePerDay} €)`,
      amount: cents(hoDays * p.homeofficePerDay),
      hint: person.homeofficeDays > p.homeofficeMaxDays ? `begrenzt auf ${p.homeofficeMaxDays} Tage` : undefined,
    });
  }
  if (person.kontofuehrung && e.length > 0) details.push({ label: "Kontoführungsgebühren (Pauschale)", amount: KONTOFUEHRUNG_PAUSCHALE });
  for (const w of person.workExpenses) details.push({ label: w.label || "Werbungskosten", amount: cents(w.amount) });

  const tatsaechlich = sum(details);
  const pausch = brutto > 0 ? Math.min(p.arbeitnehmerPauschbetrag, brutto) : 0;
  const angesetzt = tatsaechlich > pausch ? tatsaechlich : pausch;

  return {
    name: [person.firstName, person.lastName].filter(Boolean).join(" ") || (index === 0 ? "Person 1" : "Person 2"),
    bruttoarbeitslohn: brutto,
    werbungskostenTatsaechlich: tatsaechlich,
    werbungskostenAngesetzt: cents(angesetzt),
    werbungskostenDetails: details,
    einkuenfte: cents(brutto - angesetzt),
    progressionsvorbehalt: cents(e.reduce((a, x) => a + x.lohnersatzleistungen, 0) + person.weitereLohnersatzleistungen),
    withheld: {
      lohnsteuer: cents(e.reduce((a, x) => a + x.lohnsteuer, 0)),
      soli: cents(e.reduce((a, x) => a + x.soli, 0)),
      kirchensteuer: cents(e.reduce((a, x) => a + x.kirchensteuer + x.kirchensteuerEhegatte, 0)),
    },
  };
}

export function calculate(input: TaxCase): TaxResult {
  const year = input.year as TaxYear;
  const p = YEAR_PARAMS[year];
  const joint = input.filing === "joint" && input.persons.length === 2;
  const persons = (joint ? input.persons : input.persons.slice(0, 1)).map((x, i) => personResult(x, i, p));
  const factor = joint ? 2 : 1;
  const hinweise: string[] = [];
  const pflicht: string[] = [];

  const gde = cents(persons.reduce((a, x) => a + x.einkuenfte, 0));
  const progression = cents(persons.reduce((a, x) => a + x.progressionsvorbehalt, 0));
  const kids = input.children.filter((c) => c.months > 0);

  /* ---- Entlastungsbetrag für Alleinerziehende (§24b) ---- */
  let entlastung = 0;
  if (!joint && input.alleinerziehend && kids.length > 0) {
    entlastung = p.entlastungAlleinerziehend.base + p.entlastungAlleinerziehend.perAdditionalChild * (kids.length - 1);
  }

  /* ---- Sonderausgaben ---- */
  const all = (joint ? input.persons : input.persons.slice(0, 1)).flatMap((x) => x.employments);
  const sa: Line[] = [];

  const rvAG = all.reduce((a, x) => a + x.rvArbeitgeber, 0);
  const rvAN = all.reduce((a, x) => a + x.rvArbeitnehmer, 0);
  const altersvorsorge = cents(Math.max(0, Math.min(rvAG + rvAN, p.altersvorsorgeHoechstbetrag * factor) - rvAG));
  if (altersvorsorge > 0) sa.push({ label: "Altersvorsorge (Rentenversicherung, Arbeitnehmeranteil)", amount: altersvorsorge });

  const kvGesetzlich = all.reduce((a, x) => a + x.kvArbeitnehmer, 0) * 0.96; // −4 % wegen Krankengeldanspruch
  const pv = all.reduce((a, x) => a + x.pvArbeitnehmer, 0);
  const pkv = Math.max(0, all.reduce((a, x) => a + x.pkvBasis - x.zuschuesseKvPv, 0));
  const basis = cents(kvGesetzlich + pv + pkv);
  const alv = all.reduce((a, x) => a + x.alvArbeitnehmer, 0);
  const sonstige = cents(Math.max(basis, Math.min(basis + alv, p.sonstigeVorsorgeMax * factor)));
  if (sonstige > 0)
    sa.push({
      label: "Kranken-, Pflege- & Arbeitslosenversicherung",
      amount: sonstige,
      hint: sonstige < basis + alv ? "Arbeitslosenversicherung durch Höchstbetrag begrenzt" : undefined,
    });

  const pauschfaehig: Line[] = [];
  const kist = cents(persons.reduce((a, x) => a + x.withheld.kirchensteuer, 0));
  if (kist > 0) pauschfaehig.push({ label: "Gezahlte Kirchensteuer", amount: kist });

  let betreuung = 0;
  for (const c of input.children) {
    if (c.betreuungskosten <= 0) continue;
    if (year - c.birthYear >= 14) {
      hinweise.push(`Kinderbetreuungskosten für ${c.firstName || "ein Kind"} nicht berücksichtigt (Kind ist 14 oder älter).`);
      continue;
    }
    betreuung += Math.min(c.betreuungskosten * p.kinderbetreuung.share, p.kinderbetreuung.max);
  }
  if (betreuung > 0) pauschfaehig.push({ label: "Kinderbetreuungskosten", amount: cents(betreuung) });

  const spenden = sum(input.spenden);
  if (spenden > 0) {
    const cap = cents(Math.max(0, gde) * 0.2);
    pauschfaehig.push({
      label: "Spenden und Mitgliedsbeiträge",
      amount: Math.min(spenden, cap),
      hint: spenden > cap ? "auf 20 % des Gesamtbetrags der Einkünfte begrenzt" : undefined,
    });
  }
  const pauschbetrag = p.sonderausgabenPauschbetrag * factor;
  if (sum(pauschfaehig) < pauschbetrag) sa.push({ label: "Sonderausgaben-Pauschbetrag", amount: pauschbetrag });
  else sa.push(...pauschfaehig);
  const saSumme = sum(sa);

  /* ---- Außergewöhnliche Belastungen (§33) ---- */
  const agb: Line[] = [];
  const krank = sum(input.krankheitskosten);
  if (krank > 0) {
    const zumutbar = zumutbareBelastung(Math.max(0, gde), joint, kids.length);
    const abziehbar = cents(Math.max(0, krank - zumutbar));
    agb.push({ label: "Krankheitskosten nach Abzug der zumutbaren Belastung", amount: abziehbar, hint: `zumutbare Belastung: ${zumutbar.toFixed(2)} €` });
    if (abziehbar === 0) hinweise.push("Ihre Krankheitskosten liegen unter der zumutbaren Belastung und wirken sich nicht aus.");
  }
  const agbSumme = sum(agb);

  /* ---- zu versteuerndes Einkommen & Kinder-Günstigerprüfung ---- */
  const einkommen = Math.floor(gde - entlastung - saSumme - agbSumme);
  const kfb = Math.floor(kids.reduce((a, c) => a + p.kinderfreibetragGesamt * c.share * (c.months / 12), 0));
  const kindergeld = cents(kids.reduce((a, c) => a + p.kindergeldMonat * c.months * c.share, 0));

  const ohneKfb = tarifMitProgression(einkommen, progression, joint, p);
  const mitKfb = tarifMitProgression(einkommen - kfb, progression, joint, p);
  const kfbGuenstiger = kfb > 0 && ohneKfb.tax - mitKfb.tax > kindergeld;
  const zvE = Math.max(0, kfbGuenstiger ? einkommen - kfb : einkommen);
  const tariflich = kfbGuenstiger ? mitKfb : ohneKfb;

  /* ---- §35a Steuerermäßigungen ---- */
  const erm: Line[] = [];
  const hd = sum(input.haushaltsnaheDienstleistungen);
  const hw = sum(input.handwerkerleistungen);
  if (input.minijobImHaushalt > 0) erm.push({ label: "Minijob im Haushalt (20 %)", amount: cents(Math.min(input.minijobImHaushalt * PARA35A.minijobShare, PARA35A.minijobMax)) });
  if (hd > 0) erm.push({ label: "Haushaltsnahe Dienstleistungen (20 % der Arbeitskosten)", amount: cents(Math.min(hd * PARA35A.dienstleistungShare, PARA35A.dienstleistungMax)) });
  if (hw > 0) erm.push({ label: "Handwerkerleistungen (20 % der Arbeitskosten)", amount: cents(Math.min(hw * PARA35A.handwerkerShare, PARA35A.handwerkerMax)) });
  const ermSumme = sum(erm);

  const estNachErm = Math.max(0, Math.floor(tariflich.tax - ermSumme));
  const hinzurechnung = kfbGuenstiger ? kindergeld : 0;
  const est = cents(estNachErm + hinzurechnung);

  /* ---- Zuschlagsteuern: Bemessungsgrundlage immer mit Kinderfreibeträgen (§51a EStG) ---- */
  const bmg = Math.max(0, Math.floor(mitKfb.tax - ermSumme));
  const soli = solidaritaetszuschlag(bmg, joint, p);
  const rate = BUNDESLAENDER.find((b) => b.code === input.bundesland)?.kist ?? 0.09;
  const members = (joint ? input.persons : input.persons.slice(0, 1)).map((x) => x.churchMember);
  let kistShare = 0;
  if (members.every(Boolean)) kistShare = 1;
  else if (members.some(Boolean)) {
    // Konfessionsverschiedene/glaubensverschiedene Ehe: Aufteilung im Verhältnis der Einzel-ESt (vereinfacht)
    const single = persons.map((x) => grundtarif(Math.max(0, x.einkuenfte), p));
    const total = single.reduce((a, b) => a + b, 0);
    kistShare = total > 0 ? members.reduce((a, m, i) => a + (m ? single[i]! / total : 0), 0) : 0.5;
  }
  const kirchensteuer = floorCents(bmg * kistShare * rate);

  const festSumme = cents(est + soli + kirchensteuer);
  const gezahlt = {
    lohnsteuer: cents(persons.reduce((a, x) => a + x.withheld.lohnsteuer, 0)),
    soli: cents(persons.reduce((a, x) => a + x.withheld.soli, 0)),
    kirchensteuer: kist,
  };
  const gezahltSumme = cents(gezahlt.lohnsteuer + gezahlt.soli + gezahlt.kirchensteuer);

  /* ---- Steuersätze ---- */
  const grenz = zvE > 0 ? (tarif(zvE + 100, joint, p) - tarif(zvE, joint, p)) / 100 : 0;
  const brutto = persons.reduce((a, x) => a + x.bruttoarbeitslohn, 0);

  /* ---- Hinweise & Pflichtveranlagung (§46 EStG) ---- */
  if (!p.verified) hinweise.push(`Die Parameter für ${year} sind vorläufig. Die Berechnung ist eine Prognose.`);
  if (progression > 410) pflicht.push("Lohnersatzleistungen (z. B. Elterngeld, Kurzarbeitergeld) über 410 € – Abgabe ist Pflicht.");
  if (input.persons.some((x) => x.employments.length > 1)) pflicht.push("Mehrere Arbeitsverhältnisse – bei Steuerklasse VI ist die Abgabe Pflicht.");
  if (joint) pflicht.push("Bei Steuerklassenkombination III/V oder IV mit Faktor ist die Abgabe Pflicht.");
  if (kfbGuenstiger) hinweise.push("Die Kinderfreibeträge sind günstiger als das Kindergeld; das Kindergeld wird der Steuer hinzugerechnet.");
  if (persons.some((x) => x.werbungskostenAngesetzt > x.werbungskostenTatsaechlich))
    hinweise.push("Ihre Werbungskosten liegen unter dem Arbeitnehmer-Pauschbetrag – der Pauschbetrag wird automatisch angesetzt.");
  if (gde < 0) hinweise.push("Negativer Gesamtbetrag der Einkünfte: Ein Verlustvortrag wird in dieser Version nicht berechnet.");

  return {
    year,
    filing: joint ? "joint" : "single",
    provisional: !p.verified,
    persons,
    gesamtbetragDerEinkuenfte: gde,
    sonderausgaben: sa,
    sonderausgabenSumme: saSumme,
    aussergewoehnlicheBelastungen: agb,
    aussergewoehnlicheBelastungenSumme: agbSumme,
    kinderfreibetraegeAngesetzt: kfbGuenstiger,
    kinderfreibetraege: kfb,
    entlastungsbetragAlleinerziehend: entlastung,
    zuVersteuerndesEinkommen: zvE,
    tariflicheEinkommensteuer: tariflich.tax,
    steuersatzProgression: tariflich.rate,
    steuerermaessigung35a: erm,
    kindergeldHinzurechnung: hinzurechnung,
    festzusetzen: { einkommensteuer: est, soli, kirchensteuer, summe: festSumme },
    bereitsGezahlt: { ...gezahlt, summe: gezahltSumme },
    erstattung: cents(gezahltSumme - festSumme),
    grenzsteuersatz: Math.round(grenz * 1000) / 1000,
    durchschnittssteuersatz: brutto > 0 ? Math.round((festSumme / brutto) * 1000) / 1000 : 0,
    hinweise,
    pflichtveranlagung: pflicht,
  };
}
