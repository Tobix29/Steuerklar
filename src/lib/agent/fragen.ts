/**
 * Steuer-Check: der jährliche Abzugs-Agent.
 * Findet Lücken im Fall (auch im Vergleich zum Vorjahr), stellt gezielte Fragen, schätzt, was jede Antwort bringt,
 * und übernimmt die Antworten in den Fall. Rein und deterministisch – Web, Demo und App nutzen dasselbe Modul.
 */
import { calculate } from "@/lib/tax/calculate";
import { fristen, YEAR_PARAMS, type TaxYear } from "@/lib/tax/constants";
import type { TaxCase, TaxResult } from "@/lib/tax/types";

export type Antwort = { typ: "janein"; wert: boolean } | { typ: "zahl"; wert: number } | { typ: "auswahl"; wert: string };

export type Eingabe =
  | { typ: "janein"; ja?: string; nein?: string }
  | { typ: "betrag"; label: string }
  | { typ: "zahl"; label: string; max: number; einheit: string }
  | { typ: "auswahl"; optionen: { wert: string; label: string }[] }
  | { typ: "info"; aktion: string };

export type Gruppe = "vollstaendig" | "vorjahr" | "arbeit" | "familie" | "privat" | "einkuenfte";

export interface Frage {
  id: string;
  gruppe: Gruppe;
  titel: string;
  text: string;
  hilfe?: string;
  eingabe: Eingabe;
  /** Typische Antwort für die Schätzung „bringt dir ca. …“ */
  beispiel?: Antwort;
  /** Weiterführender Link, z. B. zum Profil, wenn die Antwort mehr Angaben braucht */
  link?: { href: string; label: string; beiJa?: boolean };
  anwenden: (c: TaxCase, a: Antwort) => TaxCase;
}

export interface FrageMitWert extends Frage {
  /** Geschätzte Änderung der Gutschrift bei der Beispielantwort (positiv = mehr Geld) */
  ersparnis: number;
}

const clone = (c: TaxCase): TaxCase => JSON.parse(JSON.stringify(c)) as TaxCase;
const mut = (fn: (d: TaxCase, a: Antwort) => void) => (c: TaxCase, a: Antwort) => {
  const d = clone(c);
  fn(d, a);
  return d;
};
const zahl = (a: Antwort) => (a.typ === "zahl" ? Math.max(0, a.wert) : 0);
const ja = (a: Antwort) => a.typ === "janein" && a.wert;
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 64);
const eur = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;
const wkSumme = (c: TaxCase, kat: string) => c.werbungskosten.filter((w) => w.category === kat).reduce((s, w) => s + w.amount, 0);
const wkDazu = (kat: TaxCase["werbungskosten"][number]["category"], label: string) =>
  mut((d, a) => {
    const v = zahl(a);
    if (v > 0) d.werbungskosten.push({ id: uid(), label, amount: v, category: kat });
  });
const noop = (c: TaxCase) => c;

/** Alle Fragen, die für diesen Fall relevant und noch nicht erledigt sind. */
export function fragen(c: TaxCase, r: TaxResult, opts: { vorjahr?: TaxCase | null; offeneBelege?: number; today?: Date } = {}): Frage[] {
  const v = opts.vorjahr ?? null;
  const out: Frage[] = [];
  const arbeit = c.lohnzettel.some((l) => l.art !== "pension");
  const hatEinkuenfte = c.lohnzettel.length > 0 || c.betriebe.length > 0 || c.mietobjekte.length > 0;
  const today = opts.today ?? new Date();

  /* ---------------- Vollständigkeit ---------------- */
  if (!fristen(c.year, today).yearEnded)
    out.push({ id: "jahr-laeuft", gruppe: "vollstaendig", titel: `${c.year} läuft noch`, text: `Die Werte sind eine Prognose. Abgeben kannst du ab 1. Jänner ${c.year + 1} – die Lohnzettel liegen meist Ende Februar in FinanzOnline.`, eingabe: { typ: "info", aktion: "Verstanden" }, anwenden: noop });
  if (!hatEinkuenfte)
    out.push({ id: "lohnzettel", gruppe: "vollstaendig", titel: "Lohnzettel fehlt", text: "Lade deinen Jahreslohnzettel (L16) hoch – du findest ihn in FinanzOnline unter „Abfragen → Lohnzettel“ oder bekommst ihn vom Arbeitgeber.", eingabe: { typ: "info", aktion: "Zu den Belegen" }, link: { href: "/app/belege", label: "Lohnzettel hochladen" }, anwenden: noop });
  if ((opts.offeneBelege ?? 0) > 0)
    out.push({ id: "belege-offen", gruppe: "vollstaendig", titel: `${opts.offeneBelege} Beleg(e) warten auf dich`, text: "Die KI hat sie erkannt – bestätige die Werte, damit sie zählen.", eingabe: { typ: "info", aktion: "Jetzt bestätigen" }, link: { href: "/app/belege", label: "Belege prüfen" }, anwenden: noop });

  /* ---------------- Vorjahr übernehmen ---------------- */
  if (v) {
    if (v.children.length && !c.children.length)
      out.push({
        id: "vj-kinder", gruppe: "vorjahr", titel: "Kinder aus dem Vorjahr",
        text: `${v.year} hattest du ${v.children.length} Kind(er) eingetragen (${v.children.map((k) => k.firstName || k.birthYear).join(", ")}). Gilt das für ${c.year} auch – mit Familienbeihilfe das ganze Jahr?`,
        eingabe: { typ: "janein" }, beispiel: { typ: "janein", wert: true },
        link: { href: "/app/profil", label: "Kinder anpassen", beiJa: false },
        anwenden: mut((d, a) => { if (ja(a)) d.children = v.children.map((k) => ({ ...k, months: 12 })); if (ja(a) && v.familienstatus !== "keine") d.familienstatus = v.familienstatus; }),
      });
    if (v.unterhaltKinder.length && !c.unterhaltKinder.length)
      out.push({ id: "vj-unterhalt", gruppe: "vorjahr", titel: "Unterhalt weiterhin bezahlt?", text: `${v.year} hast du für ${v.unterhaltKinder.length} Kind(er) Unterhalt bezahlt. Auch ${c.year}, das ganze Jahr?`, eingabe: { typ: "janein" }, beispiel: { typ: "janein", wert: true }, anwenden: mut((d, a) => { if (ja(a)) d.unterhaltKinder = v.unterhaltKinder.map((k) => ({ ...k, months: 12 })); }) });
    if (v.behinderungGrad > 0 && c.behinderungGrad === 0)
      out.push({ id: "vj-behinderung", gruppe: "vorjahr", titel: "Behinderung", text: `${v.year}: Grad der Behinderung ${v.behinderungGrad} %. Unverändert?`, eingabe: { typ: "janein" }, beispiel: { typ: "janein", wert: true }, anwenden: mut((d, a) => { if (ja(a)) { d.behinderungGrad = v.behinderungGrad; d.behinderungKfz = v.behinderungKfz; } }) });
    if (v.mietobjekte.length && !c.mietobjekte.length)
      out.push({
        id: "vj-vermietung", gruppe: "vorjahr", titel: "Vermietung weiterhin?", text: `${v.year} hast du ${v.mietobjekte.map((o) => o.bezeichnung || "ein Objekt").join(", ")} vermietet. Übernehmen? Gebäudedaten und AfA laufen weiter, Einnahmen und Kosten trägst du danach aktuell ein.`,
        eingabe: { typ: "janein" }, link: { href: "/app/profil", label: "Beträge aktualisieren", beiJa: true },
        anwenden: mut((d, a) => { if (ja(a)) d.mietobjekte = v.mietobjekte.map((o) => ({ ...o, id: uid() })); }),
      });
    if (v.betriebe.length && !c.betriebe.length)
      out.push({
        id: "vj-betrieb", gruppe: "vorjahr", titel: "Selbständig weiterhin?", text: `${v.year}: ${v.betriebe.map((b) => b.bezeichnung || "Selbständige Tätigkeit").join(", ")}. Übernehmen? Anlagenverzeichnis und Rechnungsdaten laufen weiter, das Journal startet leer.`,
        eingabe: { typ: "janein" }, link: { href: "/app/buchhaltung", label: "Zur Buchhaltung", beiJa: true },
        anwenden: mut((d, a) => { if (ja(a)) d.betriebe = v.betriebe.map((b) => ({ ...b, id: uid(), einnahmen: 0, ausgaben: 0, vorsteuer: 0, sozialversicherung: 0, investitionen: 0, buchungen: [], rechnungen: [] })); }),
      });
    if (v.kapital.ertraege275 + v.kapital.ertraege25 + v.kapital.ohneKest275 > 0 && c.kapital.ertraege275 + c.kapital.ertraege25 + c.kapital.ohneKest275 === 0)
      out.push({ id: "vj-kapital", gruppe: "vorjahr", titel: "Depot oder Sparbuch", text: `${v.year} hattest du Kapitalerträge. Trag die Werte aus dem Steuerreport ${c.year} deiner Bank ein – bei niedrigem Einkommen gibt es KESt zurück.`, eingabe: { typ: "info", aktion: "Eintragen" }, link: { href: "/app/profil", label: "Kapitalerträge eintragen" }, anwenden: noop });
  }

  /* ---------------- Arbeit ---------------- */
  if (arbeit) {
    if (c.pendlerKm === 0)
      out.push({
        id: "pendler", gruppe: "arbeit", titel: "Wie weit ist dein Arbeitsweg?",
        text: "Einfache Strecke Wohnung – Arbeitsplatz in km (laut BMF-Pendlerrechner). Ab 2 km ohne zumutbare Öffis bzw. ab 20 km gibt es die Pendlerpauschale plus Pendlereuro.",
        hilfe: v?.pendlerKm ? `${v.year}: ${v.pendlerKm} km` : undefined,
        eingabe: { typ: "zahl", label: "Kilometer", max: 1000, einheit: "km" }, beispiel: { typ: "zahl", wert: v?.pendlerKm || 25 },
        anwenden: mut((d, a) => { d.pendlerKm = zahl(a); if (d.pendlerKm > 0 && d.fahrtenProMonat === 0) d.fahrtenProMonat = v?.fahrtenProMonat || 20; if (v && d.pendlerKm === v.pendlerKm) d.oeffiZumutbar = v.oeffiZumutbar; }),
      });
    if (c.pendlerKm > 0 && !c.agent.erledigt.includes("pendler-oeffi"))
      out.push({ id: "pendler-oeffi", gruppe: "arbeit", titel: "Öffis zumutbar?", text: "Gibt es zumindest für die halbe Strecke öffentliche Verkehrsmittel, und ist die Fahrzeit damit zumutbar (laut Pendlerrechner)? Wenn nein, steht dir das höhere große Pendlerpauschale zu.", eingabe: { typ: "janein", ja: "Ja, zumutbar", nein: "Nein" }, beispiel: { typ: "janein", wert: false }, anwenden: mut((d, a) => { d.oeffiZumutbar = ja(a); }) });
    if (c.telearbeitstage === 0)
      out.push({ id: "homeoffice", gruppe: "arbeit", titel: "Homeoffice-Tage", text: "An wie vielen Tagen hast du ausschließlich von zu Hause gearbeitet? Pro Tag 3 € (max. 100 Tage), abzüglich der Pauschale des Arbeitgebers – steht meist am Lohnzettel.", hilfe: v?.telearbeitstage ? `${v.year}: ${v.telearbeitstage} Tage` : undefined, eingabe: { typ: "zahl", label: "Tage", max: 366, einheit: "Tage" }, beispiel: { typ: "zahl", wert: v?.telearbeitstage || 60 }, anwenden: mut((d, a) => { d.telearbeitstage = Math.min(366, Math.round(zahl(a))); }) });
    if (c.telearbeitstage >= 26 && c.mobiliar === 0)
      out.push({ id: "mobiliar", gruppe: "arbeit", titel: "Schreibtisch oder Bürosessel gekauft?", text: "Ergonomisches Mobiliar fürs Homeoffice ist bis 300 € im Jahr absetzbar (ab 26 Homeoffice-Tagen).", eingabe: { typ: "betrag", label: "Kaufpreis" }, beispiel: { typ: "zahl", wert: 300 }, anwenden: mut((d, a) => { d.mobiliar = zahl(a); }) });
    if (!wkSumme(c, "digitale_arbeitsmittel"))
      out.push({ id: "wk-digital", gruppe: "arbeit", titel: "Laptop, Handy oder Internet beruflich?", text: "Beruflich genutzte Geräte und Internet: trag den beruflichen Anteil ein (z. B. Laptop 1.200 € × 60 % = 720 €; über 1.000 € auf mehrere Jahre verteilt).", hilfe: v && wkSumme(v, "digitale_arbeitsmittel") ? `${v.year}: ${eur(wkSumme(v, "digitale_arbeitsmittel"))}` : undefined, eingabe: { typ: "betrag", label: "Beruflicher Anteil" }, beispiel: { typ: "zahl", wert: 400 }, anwenden: wkDazu("digitale_arbeitsmittel", "Digitale Arbeitsmittel (Steuer-Check)") });
    if (!wkSumme(c, "fortbildung"))
      out.push({ id: "wk-fortbildung", gruppe: "arbeit", titel: "Kurse oder Weiterbildung bezahlt?", text: "Fortbildung, Sprachkurse, Fachprüfungen, Studiengebühren für den Beruf – inklusive Fahrtkosten und Unterlagen.", eingabe: { typ: "betrag", label: "Kosten" }, beispiel: { typ: "zahl", wert: 500 }, anwenden: wkDazu("fortbildung", "Fortbildung (Steuer-Check)") });
    if (!wkSumme(c, "arbeitsmittel") && !wkSumme(c, "fachliteratur"))
      out.push({ id: "wk-arbeitsmittel", gruppe: "arbeit", titel: "Werkzeug, Berufskleidung, Fachbücher?", text: "Typische Berufskleidung (keine Alltagskleidung), Werkzeug, Fachliteratur.", eingabe: { typ: "betrag", label: "Kosten" }, beispiel: { typ: "zahl", wert: 200 }, anwenden: wkDazu("arbeitsmittel", "Arbeitsmittel (Steuer-Check)") });
    if (!c.lohnzettel.some((l) => l.kz717 > 0) && !wkSumme(c, "gewerkschaft"))
      out.push({ id: "wk-gewerkschaft", gruppe: "arbeit", titel: "Gewerkschaftsbeitrag selbst bezahlt?", text: "Nur wenn er nicht schon vom Gehalt abgezogen wurde (sonst steht er am Lohnzettel).", eingabe: { typ: "betrag", label: "Jahresbeitrag" }, beispiel: { typ: "zahl", wert: 250 }, anwenden: wkDazu("gewerkschaft", "Gewerkschaftsbeitrag (Steuer-Check)") });
    if (!c.ams.betrag)
      out.push({ id: "ams", gruppe: "vollstaendig", titel: "Arbeitslos oder in Bildungskarenz?", text: "Hast du im Jahr Geld vom AMS bekommen (Arbeitslosengeld, Notstandshilfe, Weiterbildungsgeld)? Das muss angegeben werden – es ist steuerfrei, erhöht aber den Steuersatz.", eingabe: { typ: "janein", ja: "Ja", nein: "Nein" }, link: { href: "/app/profil", label: "AMS-Bezüge eintragen", beiJa: true }, anwenden: noop });
  }

  /* ---------------- Familie ---------------- */
  if (!c.children.length && !(v && v.children.length))
    out.push({ id: "kinder", gruppe: "familie", titel: "Kinder mit Familienbeihilfe?", text: "Pro Kind bis zu 2.000 € Familienbonus Plus im Jahr – direkt von der Steuer abgezogen.", eingabe: { typ: "janein" }, link: { href: "/app/profil", label: "Kinder eintragen", beiJa: true }, anwenden: noop });
  if (c.children.length && c.familienstatus === "keine" && !c.agent.erledigt.includes("familienstatus"))
    out.push({
      id: "familienstatus", gruppe: "familie", titel: "Alleinverdienend oder alleinerziehend?", text: `Alleinerziehend: mehr als 6 Monate ohne Partner:in. Alleinverdienend: verheiratet bzw. in Partnerschaft, Partner:in mit Einkünften bis ${eur(YEAR_PARAMS[c.year as TaxYear].avabPartnerIncomeLimit)}.`,
      eingabe: { typ: "auswahl", optionen: [{ wert: "keine", label: "Nein, beides nicht" }, { wert: "alleinerzieher", label: "Alleinerziehend" }, { wert: "alleinverdiener", label: "Alleinverdienend" }] },
      beispiel: { typ: "auswahl", wert: "alleinerzieher" },
      anwenden: mut((d, a) => { if (a.typ === "auswahl" && ["keine", "alleinverdiener", "alleinerzieher"].includes(a.wert)) d.familienstatus = a.wert as TaxCase["familienstatus"]; }),
    });

  /* ---------------- Privat ---------------- */
  if (c.kirchenbeitrag === 0)
    out.push({ id: "kirche", gruppe: "privat", titel: "Kirchenbeitrag bezahlt?", text: "Bis 600 € im Jahr absetzbar. Die Kirche meldet ihn meist automatisch – trag ihn trotzdem ein, damit die Berechnung stimmt.", hilfe: v?.kirchenbeitrag ? `${v.year}: ${eur(v.kirchenbeitrag)}` : undefined, eingabe: { typ: "betrag", label: "Betrag" }, beispiel: { typ: "zahl", wert: v?.kirchenbeitrag || 300 }, anwenden: mut((d, a) => { d.kirchenbeitrag = zahl(a); }) });
  if (!c.spenden.length)
    out.push({ id: "spenden", gruppe: "privat", titel: "Gespendet?", text: "Spenden an begünstigte Organisationen (Liste des BMF) sind bis 10 % deines Einkommens absetzbar und werden automatisch gemeldet, wenn du Vor- und Zuname plus Geburtsdatum angegeben hast.", hilfe: v?.spenden.length ? `${v.year}: ${eur(v.spenden.reduce((s, x) => s + x.amount, 0))}` : undefined, eingabe: { typ: "betrag", label: "Summe" }, beispiel: { typ: "zahl", wert: 150 }, anwenden: mut((d, a) => { if (zahl(a) > 0) d.spenden.push({ id: uid(), label: "Spenden (Steuer-Check)", amount: zahl(a) }); }) });
  if (!c.krankheitskosten.length)
    out.push({ id: "krankheit", gruppe: "privat", titel: "Arzt, Zahnarzt, Brille, Medikamente?", text: "Selbst bezahlte Krankheitskosten (inkl. Selbstbehalte, Fahrtkosten zum Arzt) zählen als außergewöhnliche Belastung – allerdings erst über einem Selbstbehalt von 6–12 % des Einkommens.", eingabe: { typ: "betrag", label: "Summe" }, beispiel: { typ: "zahl", wert: 1_500 }, anwenden: mut((d, a) => { if (zahl(a) > 0) d.krankheitskosten.push({ id: uid(), label: "Krankheitskosten (Steuer-Check)", amount: zahl(a) }); }) });
  if (!c.steuerberatung.length)
    out.push({ id: "steuerberatung", gruppe: "privat", titel: "Steuerberatung bezahlt?", text: "Kosten für Steuerberatung (auch Steuer-Apps und Kanzleihonorare) sind als Sonderausgabe voll absetzbar.", eingabe: { typ: "betrag", label: "Kosten" }, beispiel: { typ: "zahl", wert: 100 }, anwenden: mut((d, a) => { if (zahl(a) > 0) d.steuerberatung.push({ id: uid(), label: "Steuerberatung (Steuer-Check)", amount: zahl(a) }); }) });
  if (c.behinderungGrad === 0 && !(v && v.behinderungGrad))
    out.push({ id: "behinderung", gruppe: "privat", titel: "Behinderung ab 25 %?", text: "Mit Bescheid (Sozialministeriumservice) gibt es einen jährlichen Pauschbetrag ohne Selbstbehalt.", eingabe: { typ: "janein" }, link: { href: "/app/profil", label: "Grad eintragen", beiJa: true }, anwenden: noop });

  /* ---------------- Weitere Einkünfte ---------------- */
  if (!c.mietobjekte.length && !(v && v.mietobjekte.length))
    out.push({ id: "vermietung", gruppe: "einkuenfte", titel: "Wohnung vermietet?", text: "Mieteinnahmen müssen erklärt werden – Zinsen, AfA und Reparaturen senken die Steuer.", eingabe: { typ: "janein" }, link: { href: "/app/profil", label: "Vermietung eintragen", beiJa: true }, anwenden: noop });
  if (!c.betriebe.length && !(v && v.betriebe.length))
    out.push({ id: "nebenbei", gruppe: "einkuenfte", titel: "Nebenbei selbständig?", text: "Honorare, Werkverträge, Verkäufe über Plattformen – bis 730 € neben dem Gehalt steuerfrei, darüber in der Erklärung.", eingabe: { typ: "janein" }, link: { href: "/app/profil", label: "Tätigkeit eintragen", beiJa: true }, anwenden: noop });
  if (c.kapital.ohneKest275 === 0 && !(v && v.kapital.ohneKest275))
    out.push({ id: "krypto", gruppe: "einkuenfte", titel: "Krypto oder ausländisches Depot?", text: "Gewinne ohne österreichischen KESt-Abzug (Krypto-Börsen, ausländische Broker) müssen erklärt werden – Verluste lassen sich verrechnen.", eingabe: { typ: "janein" }, link: { href: "/app/profil", label: "Erträge eintragen", beiJa: true }, anwenden: noop });

  return out.filter((f) => !c.agent.erledigt.includes(f.id));
}

/** Schätzt für jede Frage die Änderung der Gutschrift (Beispielantwort) und sortiert: Pflichtpunkte zuerst, dann nach Ersparnis. */
export function mitErsparnis(c: TaxCase, r: TaxResult, list: Frage[]): FrageMitWert[] {
  const rang: Record<Gruppe, number> = { vollstaendig: 0, vorjahr: 1, arbeit: 2, familie: 2, privat: 2, einkuenfte: 3 };
  return list
    .map((f) => {
      let ersparnis = 0;
      if (f.beispiel) {
        try {
          ersparnis = Math.round((calculate(f.anwenden(c, f.beispiel)).erstattung - r.erstattung) * 100) / 100;
        } catch {
          ersparnis = 0;
        }
      }
      return { ...f, ersparnis };
    })
    .sort((a, b) => rang[a.gruppe] - rang[b.gruppe] || b.ersparnis - a.ersparnis);
}

/** Antwort übernehmen und Frage als erledigt markieren. */
export function beantworten(c: TaxCase, f: Frage, a: Antwort | null): TaxCase {
  const next = a ? f.anwenden(c, a) : clone(c);
  if (!next.agent.erledigt.includes(f.id)) next.agent.erledigt = [...next.agent.erledigt, f.id].slice(-200);
  return next;
}

/** Normalisiert eine Betragseingabe (Betrag wird als Zahl gespeichert). */
export const alsAntwort = (f: Frage, wert: number | boolean | string): Antwort =>
  f.eingabe.typ === "janein" ? { typ: "janein", wert: !!wert } : f.eingabe.typ === "auswahl" ? { typ: "auswahl", wert: String(wert) } : { typ: "zahl", wert: Number(wert) || 0 };
