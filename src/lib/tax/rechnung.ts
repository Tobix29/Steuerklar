/**
 * Ausgangsrechnungen nach § 11 UStG: Summen, Pflichtangaben-Prüfung, fortlaufende Nummern
 * und automatische Buchung des Zahlungseingangs im Einnahmen-Ausgaben-Journal.
 */
import type { Betrieb } from "./types";

export type Rechnung = Betrieb["rechnungen"][number];
export type Firma = Betrieb["firma"];

const cents = (n: number) => Math.round(n * 100) / 100;

/** Kleinbetragsrechnung: bis 400 € brutto vereinfachte Angaben (§ 11 Abs 6 UStG) */
export const KLEINBETRAG = 400;
/** Ab 10.000 € brutto muss die UID des Empfängers auf die Rechnung (§ 11 Abs 1 Z 3 lit i UStG) */
export const UID_EMPFAENGER_AB = 10_000;

export interface RechnungSummen {
  netto: number;
  ust: number;
  brutto: number;
  /** je Steuersatz */
  saetze: { satz: number; netto: number; ust: number }[];
  ohneUst: boolean;
}

/** Ohne Umsatzsteuer, wenn Kleinunternehmer:in oder Reverse Charge. */
export function rechnungSummen(r: Rechnung, firma: Firma): RechnungSummen {
  const ohneUst = firma.kleinunternehmer || r.reverseCharge;
  const map = new Map<number, number>();
  for (const p of r.positionen) {
    const satz = ohneUst ? 0 : p.ustSatz;
    map.set(satz, (map.get(satz) ?? 0) + p.menge * p.preis);
  }
  const saetze = [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([satz, netto]) => ({ satz, netto: cents(netto), ust: cents((netto * satz) / 100) }));
  const netto = cents(saetze.reduce((a, s) => a + s.netto, 0));
  const ust = cents(saetze.reduce((a, s) => a + s.ust, 0));
  return { netto, ust, brutto: cents(netto + ust), saetze, ohneUst };
}

/** Prüft die Pflichtangaben nach § 11 UStG. Liefert fehlende bzw. problematische Punkte. */
export function pflichtangaben(r: Rechnung, firma: Firma): { fehler: string[]; hinweise: string[] } {
  const s = rechnungSummen(r, firma);
  const klein = s.brutto <= KLEINBETRAG && !r.reverseCharge;
  const fehler: string[] = [];
  const hinweise: string[] = [];
  if (!firma.name.trim() || !firma.adresse.trim()) fehler.push("Name und Anschrift von dir (Rechnungsaussteller:in)");
  if (!r.nummer.trim()) fehler.push("Fortlaufende Rechnungsnummer");
  if (!r.positionen.length || r.positionen.some((p) => !p.text.trim())) fehler.push("Menge und handelsübliche Bezeichnung jeder Leistung");
  if (!r.leistungVon) fehler.push("Tag bzw. Zeitraum der Leistung");
  if (!klein) {
    if (!r.kunde.name.trim() || !r.kunde.adresse.trim()) fehler.push("Name und Anschrift des Empfängers (über 400 € brutto)");
    if (!firma.kleinunternehmer && !firma.uid.trim()) fehler.push("Deine UID-Nummer (über 400 € brutto)");
  } else hinweise.push("Kleinbetragsrechnung bis 400 € brutto: Empfänger und UID sind nicht nötig.");
  if (s.brutto > UID_EMPFAENGER_AB && !r.kunde.uid.trim() && !firma.kleinunternehmer)
    hinweise.push("Über 10.000 € brutto: Ist der Empfänger ein Unternehmen, muss seine UID-Nummer auf die Rechnung.");
  if (r.reverseCharge) {
    if (!r.kunde.uid.trim()) fehler.push("UID des Empfängers (Reverse Charge)");
    if (!firma.uid.trim()) fehler.push("Deine UID-Nummer (Reverse Charge)");
    hinweise.push("Reverse Charge: Bei Leistungen an Unternehmen in anderen EU-Staaten bis zum 15. des Folgemonats in der Zusammenfassenden Meldung (ZM) angeben.");
  }
  if (firma.uid && !/^ATU\d{8}$/.test(firma.uid.replace(/\s+/g, "").toUpperCase()) && !r.reverseCharge)
    hinweise.push("Österreichische UID-Nummern haben das Format ATU12345678.");
  if (firma.iban && !ibanGueltig(firma.iban)) fehler.push("IBAN ist ungültig (Prüfziffer)");
  return { fehler, hinweise };
}

/** IBAN-Prüfziffer nach ISO 13616 (Modulo 97). */
export function ibanGueltig(iban: string): boolean {
  const s = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const r = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of r) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** Nächste fortlaufende Nummer im Format JJJJ-NNN (lückenlos je Jahr). */
export function naechsteNummer(rechnungen: Rechnung[], year: number): string {
  const prefix = `${year}-`;
  const max = rechnungen.filter((r) => r.nummer.startsWith(prefix)).reduce((m, r) => Math.max(m, Number(r.nummer.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** Fälligkeitsdatum */
export function faelligAm(r: Rechnung): string {
  const d = new Date(`${r.datum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + r.zahlungszielTage);
  return d.toISOString().slice(0, 10);
}

export const buchungIdFuer = (r: Rechnung) => `re-${r.id}`;

/**
 * Gleicht die Journal-Buchungen mit den Rechnungen ab: bezahlte (nicht stornierte) Rechnungen erzeugen
 * genau eine Buchung „Erlöse“ am Zahlungstag; offene oder stornierte Rechnungen haben keine.
 */
export function rechnungenBuchen(b: Betrieb): Betrieb["buchungen"] {
  const manuell = b.buchungen.filter((x) => !x.id.startsWith("re-"));
  const auto = b.rechnungen
    .filter((r) => r.ausgestelltAm && r.bezahltAm && !r.storniert && /^\d{4}-\d{2}-\d{2}$/.test(r.bezahltAm))
    .map((r) => {
      const s = rechnungSummen(r, b.firma);
      return {
        id: buchungIdFuer(r),
        datum: r.bezahltAm,
        kategorie: "erloese" as const,
        beschreibung: `Rechnung ${r.nummer}${r.kunde.name ? ` · ${r.kunde.name}` : ""}`.slice(0, 200),
        netto: s.netto,
        ust: s.ust,
        privatanteil: 0,
      };
    });
  return [...manuell, ...auto];
}

export interface Offen {
  rechnung: Rechnung;
  brutto: number;
  faellig: string;
  ueberfaellig: boolean;
}

/** Offene Posten (nicht bezahlt, nicht storniert), älteste zuerst. */
export function offenePosten(b: Betrieb, today = new Date()): Offen[] {
  const heute = today.toISOString().slice(0, 10);
  return b.rechnungen
    .filter((r) => r.ausgestelltAm && !r.bezahltAm && !r.storniert)
    .map((r) => {
      const faellig = faelligAm(r);
      return { rechnung: r, brutto: rechnungSummen(r, b.firma).brutto, faellig, ueberfaellig: faellig < heute };
    })
    .sort((a, b) => a.faellig.localeCompare(b.faellig));
}

/** Text für den Hinweis zur Steuer auf der Rechnung. */
export function steuerHinweis(r: Rechnung, firma: Firma): string | null {
  if (r.reverseCharge) return "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, Art. 196 MwSt-RL).";
  if (firma.kleinunternehmer) return "Umsatzsteuerbefreit – Kleinunternehmer gemäß § 6 Abs. 1 Z 27 UStG.";
  return null;
}

/** Status für die Anzeige. */
export function rechnungStatus(r: Rechnung, today = new Date()): "entwurf" | "offen" | "ueberfaellig" | "bezahlt" | "storniert" {
  if (r.storniert) return "storniert";
  if (!r.ausgestelltAm) return "entwurf";
  if (r.bezahltAm) return "bezahlt";
  return faelligAm(r) < today.toISOString().slice(0, 10) ? "ueberfaellig" : "offen";
}

/** Neuer Entwurf mit sinnvollen Vorgaben (Leistungsdatum = heute, letzter Kunde nicht vorbelegt). */
export function neueRechnung(id: string, today = new Date()): Rechnung {
  const d = today.toISOString().slice(0, 10);
  return {
    id, nummer: "", datum: d, leistungVon: d, leistungBis: "", kunde: { name: "", adresse: "", uid: "" },
    positionen: [{ text: "", menge: 1, einheit: "Std.", preis: 0, ustSatz: 20 }], zahlungszielTage: 14, reverseCharge: false, notiz: "",
    ausgestelltAm: "", bezahltAm: "", storniert: false, mahnungen: [],
  };
}

/** Bisherige Kund:innen (für Vorschläge), neueste zuerst, ohne Duplikate. */
export function kunden(rechnungen: Rechnung[]): Rechnung["kunde"][] {
  const seen = new Set<string>();
  const out: Rechnung["kunde"][] = [];
  for (const r of [...rechnungen].reverse()) {
    const k = r.kunde.name.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r.kunde);
  }
  return out;
}

/* ------------------------------ Mahnwesen ------------------------------ */

export type Mahnung = Rechnung["mahnungen"][number];

export const MAHNSTUFEN = {
  1: { titel: "Zahlungserinnerung", abstand: 3 },
  2: { titel: "1. Mahnung", abstand: 14 },
  3: { titel: "Letzte Mahnung", abstand: 14 },
} as const;

/** Verzugszinsen: Verbraucher:innen 4 % p. a. (§ 1000 Abs 1 ABGB); Unternehmen 9,2 Prozentpunkte über dem Basiszinssatz (§ 456 UGB). */
export const VERZUG = { verbraucher: 4, ueberBasiszins: 9.2, pauschaleB2B: 40 };

/** Unternehmen erkennt man an der UID (sonst als Verbraucher:in behandeln – der vorsichtigere Fall). */
export const istUnternehmen = (r: Rechnung) => r.kunde.uid.trim().length > 0;

const addDays = (iso: string, d: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};
const tageZwischen = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000));

/** Verzugszinsen auf den Bruttobetrag ab Fälligkeit bis zum Stichtag. */
export function verzugszinsen(r: Rechnung, firma: Firma, zinssatz: number, bis: string): number {
  const tage = tageZwischen(faelligAm(r), bis);
  return cents((rechnungSummen(r, firma).brutto * (zinssatz / 100) * tage) / 365);
}

export interface MahnVorschlag {
  stufe: 1 | 2 | 3;
  /** Ab wann die nächste Stufe sinnvoll ist */
  ab: string;
  faellig: boolean;
}

/** Nächste Mahnstufe für eine offene, überfällige Rechnung – oder null. */
export function naechsteMahnung(r: Rechnung, today = new Date()): MahnVorschlag | null {
  if (!r.ausgestelltAm || r.bezahltAm || r.storniert) return null;
  const heute = today.toISOString().slice(0, 10);
  const letzte = r.mahnungen.at(-1);
  if (letzte && letzte.stufe >= 3) return null;
  const stufe = ((letzte?.stufe ?? 0) + 1) as 1 | 2 | 3;
  const ab = letzte ? addDays(letzte.frist, 1) : addDays(faelligAm(r), MAHNSTUFEN[1].abstand);
  return { stufe, ab, faellig: heute >= ab };
}

/** Neue Mahnung mit Vorschlagswerten (Zinsen erst ab der 1. Mahnung, Pauschale nur bei Unternehmen). */
export function mahnungEntwurf(r: Rechnung, firma: Firma, stufe: 1 | 2 | 3, today = new Date(), zinssatz?: number): Mahnung {
  const datum = today.toISOString().slice(0, 10);
  const satz = stufe === 1 ? 0 : zinssatz ?? (istUnternehmen(r) ? 0 : VERZUG.verbraucher);
  const gebuehr = stufe >= 2 && istUnternehmen(r) && !r.mahnungen.some((m) => m.gebuehr > 0) ? VERZUG.pauschaleB2B : 0;
  return { stufe, datum, frist: addDays(datum, stufe === 3 ? 7 : 14), zinssatz: satz, zinsen: satz ? verzugszinsen(r, firma, satz, datum) : 0, gebuehr };
}

/** Offener Gesamtbetrag inkl. aller vermerkten Zinsen und Gebühren (Zinsen der letzten Mahnung, Gebühren summiert). */
export function mahnSumme(r: Rechnung, firma: Firma, m: Mahnung): { offen: number; zinsen: number; gebuehren: number; gesamt: number } {
  const offen = rechnungSummen(r, firma).brutto;
  const gebuehren = cents(r.mahnungen.filter((x) => x !== m && x.stufe < m.stufe).reduce((s, x) => s + x.gebuehr, 0) + m.gebuehr);
  return { offen, zinsen: m.zinsen, gebuehren, gesamt: cents(offen + m.zinsen + gebuehren) };
}

const deDatum = (iso: string) => iso.split("-").reverse().join(".");
const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/** Betreff und Text der Mahnung (für E-Mail und PDF). */
export function mahnText(r: Rechnung, firma: Firma, m: Mahnung): { betreff: string; text: string } {
  const s = mahnSumme(r, firma, m);
  const titel = MAHNSTUFEN[m.stufe].titel;
  const anrede = "Sehr geehrte Damen und Herren,";
  const posten = [
    `Rechnung ${r.nummer} vom ${deDatum(r.datum)}, fällig am ${deDatum(faelligAm(r))}: ${fmt(s.offen)}`,
    ...(s.zinsen ? [`Verzugszinsen ${m.zinssatz.toLocaleString("de-DE")} % p. a. bis ${deDatum(m.datum)}: ${fmt(s.zinsen)}`] : []),
    ...(s.gebuehren ? [`${istUnternehmen(r) ? "Pauschale für Betreibungskosten (§ 458 UGB)" : "Mahnspesen"}: ${fmt(s.gebuehren)}`] : []),
  ];
  const zahlung = `Bitte überweisen Sie ${fmt(s.gesamt)} bis ${deDatum(m.frist)}${firma.iban ? ` auf das Konto IBAN ${firma.iban}` : ""} (Verwendungszweck: ${r.nummer}).`;
  const koerper =
    m.stufe === 1
      ? [anrede, "", `vermutlich ist es im Alltag untergegangen: Zu unserer Rechnung ${r.nummer} ist bis heute keine Zahlung eingegangen.`, "", ...posten.map((p) => `• ${p}`), "", zahlung, "", "Sollte sich die Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos."]
      : m.stufe === 2
        ? [anrede, "", `trotz unserer Zahlungserinnerung ist die folgende Rechnung weiterhin offen:`, "", ...posten.map((p) => `• ${p}`), "", zahlung]
        : [anrede, "", `trotz Erinnerung und Mahnung ist die folgende Forderung noch immer offen:`, "", ...posten.map((p) => `• ${p}`), "", zahlung, "", `Sollte bis ${deDatum(m.frist)} keine Zahlung eingehen, werden wir die Forderung ohne weitere Ankündigung gerichtlich geltend machen bzw. an ein Inkassobüro übergeben. Die dadurch entstehenden Kosten gehen zu Ihren Lasten.`];
  const text = [...koerper, "", "Mit freundlichen Grüßen", firma.name || "[Name]", ...(firma.email ? [firma.email] : [])].join("\n");
  return { betreff: `${titel}: Rechnung ${r.nummer}`, text };
}
