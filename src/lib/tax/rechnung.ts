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
    ausgestelltAm: "", bezahltAm: "", storniert: false,
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
