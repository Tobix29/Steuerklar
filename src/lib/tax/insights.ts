/**
 * Spar-Check: zeigt, wie viel jeder Abzug konkret bringt, und gibt Optimierungshinweise.
 * Rein rechnerisch auf Basis der Steuer-Engine (jede Variante = eine Neuberechnung ohne den Posten).
 */
import { calculate } from "./calculate";
import { YEAR_PARAMS, type TaxYear } from "./constants";
import type { TaxCase, TaxResult } from "./types";

export interface Contribution {
  key: string;
  label: string;
  /** Mehr Gutschrift bzw. weniger Nachforderung durch diesen Posten, in € */
  effect: number;
}

export interface Tip {
  key: string;
  icon: string;
  title: string;
  text: string;
  /** Mögliche Wirkung in € (falls bezifferbar) */
  effect?: number;
  /** Seite, auf der man es ändert */
  href?: string;
}

export interface Insights {
  contributions: Contribution[];
  tips: Tip[];
  /** Wirkung eines zusätzlichen Euros Werbungskosten (Grenzsteuersatz), 0–0.55 */
  perEuro: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) => `€ ${n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function insights(c: TaxCase, base: TaxResult = calculate(c)): Insights {
  const p = YEAR_PARAMS[c.year as TaxYear];
  const variants: [string, string, Partial<TaxCase>][] = [
    ["pendler", "Pendlerpauschale & Pendlereuro", { pendlerKm: 0 }],
    ["telearbeit", "Homeoffice (Telearbeit & Mobiliar)", { telearbeitstage: 0, mobiliar: 0 }],
    ["werbungskosten", "Werbungskosten (Arbeitsmittel, Fortbildung …)", { werbungskosten: [], doppelteHaushaltsfuehrung: 0, familienheimfahrten: 0 }],
    ["kinder", "Kinder (Familienbonus Plus & Absetzbeträge)", { children: [], familienstatus: "keine" }],
    ["sonderausgaben", "Sonderausgaben (Kirchenbeitrag, Spenden, Steuerberatung)", { kirchenbeitrag: 0, spenden: [], steuerberatung: [] }],
    ["krankheit", "Krankheitskosten", { krankheitskosten: [] }],
    ["behinderung", "Behinderung (Pauschbeträge)", { behinderungGrad: 0, behinderungKfz: false }],
    ["unterhalt", "Unterhaltsabsetzbetrag", { unterhaltKinder: [] }],
    ["pension", "Erhöhter Pensionistenabsetzbetrag", { pensionErhoeht: false }],
    ["kapital", "KESt-Gutschrift (Regelbesteuerung)", { kapital: { ertraege275: 0, ertraege25: 0, kestBezahlt: 0, verluste275: 0, ohneKest275: 0 } }],
  ];
  const contributions: Contribution[] = [];
  for (const [key, label, patch] of variants) {
    const effect = r2(base.erstattung - calculate({ ...c, ...patch }).erstattung);
    if (effect >= 1) contributions.push({ key, label, effect });
  }
  contributions.sort((a, b) => b.effect - a.effect);

  const tips: Tip[] = [];
  const hasIncome = c.lohnzettel.length > 0;

  // Familienbonus verpufft, weil die Steuer zu niedrig ist
  const fbLine = base.absetzbetraege.find((l) => l.label === "Familienbonus Plus");
  const fbClaimed = c.children
    .filter((k) => k.months > 0)
    .reduce((a, k) => a + (c.year - k.birthYear < 18 ? p.familienbonus.under18 : p.familienbonus.over18) * (k.months / 12) * k.familienbonusShare, 0);
  const lost = r2(fbClaimed - (fbLine?.amount ?? 0));
  if (fbLine && lost >= 1) {
    tips.push({
      key: "familienbonus",
      icon: "👪",
      title: `${eur(lost)} Familienbonus verpuffen`,
      text:
        "Der Familienbonus kann deine Steuer nur bis 0 senken. Verdient der andere Elternteil mehr, holt ihr als Familie mehr heraus, " +
        "wenn er oder sie den Familienbonus ganz (oder einen größeren Teil) beantragt. Bei niedrigem Einkommen prüft das Finanzamt zusätzlich den Kindermehrbetrag.",
      effect: lost,
      href: "/app/profil",
    });
  }

  // Werbungskosten knapp unter der Pauschale
  const wkSonst = c.werbungskosten.reduce((a, w) => a + w.amount, 0) + c.doppelteHaushaltsfuehrung + Math.min(c.familienheimfahrten, p.pendlerGross.from60);
  if (hasIncome && wkSonst > 0 && wkSonst <= p.werbungskostenpauschale) {
    tips.push({
      key: "pauschale",
      icon: "🧾",
      title: `Noch ${eur(p.werbungskostenpauschale - wkSonst + 1)} bis deine Werbungskosten wirken`,
      text: `Bis ${p.werbungskostenpauschale} € gilt automatisch die Werbungskostenpauschale. Erst was darüber liegt, senkt deine Steuer – sammle Belege für Arbeitsmittel, Fachliteratur oder Kurse.`,
      href: "/app/belege",
    });
  }

  // Steuer schon bei 0: weitere Abzüge bringen nichts mehr
  if (hasIncome && base.tarifsteuer === 0) {
    tips.push({
      key: "nullsteuer",
      icon: "ℹ️",
      title: "Deine Steuer liegt bereits bei 0",
      text: "Weitere Werbungskosten oder Sonderausgaben wirken sich nicht mehr aus. Gutschriften entstehen jetzt nur noch über Negativsteuer (SV-Rückerstattung, Alleinverdiener-/Alleinerzieherabsetzbetrag, Kindermehrbetrag).",
    });
  }

  // Pendler knapp unter 20 km mit Öffis
  if (c.pendlerKm >= 2 && c.pendlerKm < 20 && c.oeffiZumutbar && c.fahrtenProMonat >= 4) {
    const gross = calculate({ ...c, oeffiZumutbar: false });
    const effect = r2(gross.erstattung - base.erstattung);
    tips.push({
      key: "pendler-gross",
      icon: "🚌",
      title: "Sind die Öffis wirklich zumutbar?",
      text: `Unter 20 km gibt es nur dann ein Pendlerpauschale, wenn öffentliche Verkehrsmittel unzumutbar sind (z. B. über 2 Stunden Fahrzeit oder keine Verbindung). Der Pendlerrechner des BMF entscheidet verbindlich${effect >= 1 ? ` – das große Pendlerpauschale brächte dir rund ${eur(effect)}` : ""}.`,
      effect: effect >= 1 ? effect : undefined,
      href: "/app/profil",
    });
  }

  // Aliquotierung: knapp unter der nächsten Stufe
  if (c.pendlerKm > 0 && (c.fahrtenProMonat === 10 || c.fahrtenProMonat === 7)) {
    const next = calculate({ ...c, fahrtenProMonat: c.fahrtenProMonat === 10 ? 11 : 8 });
    const effect = r2(next.erstattung - base.erstattung);
    if (effect >= 1)
      tips.push({
        key: "pendler-fahrten",
        icon: "🗓️",
        title: "Eine Fahrt pro Monat mehr zählt",
        text: `Ab ${c.fahrtenProMonat === 10 ? 11 : 8} Fahrten pro Monat steht dir ein höherer Anteil des Pendlerpauschales zu (rund ${eur(effect)} mehr). Trage die tatsächliche Zahl ein.`,
        effect,
        href: "/app/profil",
      });
  }

  // Homeoffice-Mobiliar ohne Telearbeitstage
  if (c.mobiliar > 0 && c.telearbeitstage < 26) {
    tips.push({
      key: "mobiliar",
      icon: "🪑",
      title: "Mobiliar wird noch nicht berücksichtigt",
      text: "Ergonomisches Mobiliar ist erst ab 26 Telearbeitstagen absetzbar. Stehen sie auf deinem Lohnzettel, trage sie unter „Über dich“ ein.",
      href: "/app/profil",
    });
  }

  if (hasIncome && base.grenzsteuersatz > 0) {
    tips.push({
      key: "grenz",
      icon: "💡",
      title: `Jeder weitere Euro Werbungskosten bringt dir ${Math.round(base.grenzsteuersatz * 100)} Cent`,
      text: `Dein Grenzsteuersatz liegt bei ${Math.round(base.grenzsteuersatz * 100)} %. Ein Laptop um 1.000 € (beruflich genutzt) senkt deine Steuer also um rund ${eur(1000 * base.grenzsteuersatz)} – sofern deine Werbungskosten insgesamt über der Pauschale liegen.`,
    });
  }

  return { contributions, tips, perEuro: base.grenzsteuersatz };
}
