/**
 * Abgabe über eine Partner-Kanzlei (Steuerberatung mit FinanzOnline-Zugang als Parteienvertreter):
 *  - Status-Ablauf einer Abgabe
 *  - Prüfliste: was die Kanzlei vor der Übermittlung ansehen sollte
 *  - Übermittlungsdatei (Kennzahlen je Formular) als Grundlage für FinanzOnline
 *
 * Rein, ohne Server-Abhängigkeiten – Web, Demo und App verwenden dasselbe Modul.
 */
import { fristen } from "@/lib/tax/constants";
import type { FormEntry, TaxCase, TaxResult } from "@/lib/tax/types";

export const STATUS = {
  freigegeben: { label: "Freigegeben – wartet auf Kanzlei", ton: "blue" },
  in_pruefung: { label: "In Prüfung durch die Kanzlei", ton: "blue" },
  rueckfrage: { label: "Rückfrage der Kanzlei", ton: "orange" },
  uebermittelt: { label: "An das Finanzamt übermittelt", ton: "green" },
  bescheid: { label: "Bescheid eingelangt", ton: "green" },
  abgelehnt: { label: "Von der Kanzlei abgelehnt", ton: "red" },
  zurueckgezogen: { label: "Zurückgezogen", ton: "gray" },
} as const;
export type AbgabeStatus = keyof typeof STATUS;

export type Rolle = "mandant" | "kanzlei";
export type Aktion =
  | "freigeben" // Mandant: (erneut) zur Abgabe freigeben
  | "zurueckziehen" // Mandant
  | "pruefen" // Kanzlei: Prüfung beginnen
  | "rueckfrage" // Kanzlei: Rückfrage stellen
  | "uebermitteln" // Kanzlei: übermittelt (mit FinanzOnline-Referenz)
  | "bescheid" // Kanzlei: Bescheid eingelangt
  | "ablehnen"; // Kanzlei: Mandat abgelehnt

const UEBERGAENGE: Record<Aktion, { rolle: Rolle; von: AbgabeStatus[]; nach: AbgabeStatus }> = {
  freigeben: { rolle: "mandant", von: ["rueckfrage", "zurueckgezogen", "freigegeben", "in_pruefung"], nach: "freigegeben" },
  zurueckziehen: { rolle: "mandant", von: ["freigegeben", "in_pruefung", "rueckfrage"], nach: "zurueckgezogen" },
  pruefen: { rolle: "kanzlei", von: ["freigegeben"], nach: "in_pruefung" },
  rueckfrage: { rolle: "kanzlei", von: ["freigegeben", "in_pruefung"], nach: "rueckfrage" },
  uebermitteln: { rolle: "kanzlei", von: ["in_pruefung"], nach: "uebermittelt" },
  bescheid: { rolle: "kanzlei", von: ["uebermittelt"], nach: "bescheid" },
  ablehnen: { rolle: "kanzlei", von: ["freigegeben", "in_pruefung", "rueckfrage"], nach: "abgelehnt" },
};

export class AbgabeFehler extends Error {}

/** Prüft einen Statuswechsel. Wirft bei unzulässigen Übergängen. */
export function uebergang(status: AbgabeStatus | null, aktion: Aktion, rolle: Rolle): AbgabeStatus {
  const u = UEBERGAENGE[aktion];
  if (u.rolle !== rolle) throw new AbgabeFehler("Diese Aktion ist für dich nicht vorgesehen.");
  if (status === null) {
    if (aktion !== "freigeben") throw new AbgabeFehler("Die Abgabe existiert noch nicht.");
    return "freigegeben";
  }
  if (!u.von.includes(status)) throw new AbgabeFehler(`Im Status „${STATUS[status].label}“ nicht möglich.`);
  return u.nach;
}

/** Abgeschlossen = keine Änderungen mehr durch die Mandantin bzw. den Mandanten. */
export const abgeschlossen = (s: AbgabeStatus) => s === "uebermittelt" || s === "bescheid" || s === "abgelehnt";

export interface Ereignis {
  at: number;
  von: Rolle | "system";
  text: string;
}
export interface Nachricht {
  at: number;
  von: Rolle;
  text: string;
}
export interface PruefPunkt {
  stufe: "kritisch" | "pruefen" | "info";
  text: string;
}

export interface Snapshot {
  version: number;
  erstelltAt: number;
  /** SHA-256 über Fall und Ergebnis – bindet die Freigabe an genau diese Daten */
  hash: string;
  case: TaxCase;
  result: TaxResult;
  belege: { id: string; fileName: string; typ: string; betrag: number | null; uebernommen: boolean }[];
  pruefliste: PruefPunkt[];
  formulare: string[];
}

/** Inhalt einer Abgabe (wird verschlüsselt gespeichert). */
export interface AbgabeDaten {
  id: string;
  year: number;
  kanzleiId: string;
  kanzleiName: string;
  mandant: { name: string; email: string };
  status: AbgabeStatus;
  snapshot: Snapshot;
  /** Freigabe-Erklärung der Mandantin/des Mandanten */
  freigabe: { at: number; text: string; hash: string };
  uebermittlung: { at: number; referenz: string } | null;
  ereignisse: Ereignis[];
  nachrichten: Nachricht[];
  createdAt: number;
  updatedAt: number;
}

export const FREIGABE_TEXT = (year: number, kanzlei: string) =>
  `Ich beauftrage ${kanzlei}, meine Steuererklärung ${year} auf Grundlage der freigegebenen Daten zu prüfen und über FinanzOnline beim Finanzamt einzubringen. ` +
  "Ich bestätige, dass meine Angaben nach bestem Wissen vollständig und richtig sind, und lege Belege auf Verlangen vor.";

export const VOLLMACHT_TEXT = (kanzlei: string) =>
  `Ich erteile ${kanzlei} Vollmacht zur Vertretung in Abgabenangelegenheiten (Einkommensteuer, Arbeitnehmerveranlagung und Umsatzsteuer) ` +
  "einschließlich Akteneinsicht, Abfrage meiner Lohnzettel- und Sonderausgabendaten in FinanzOnline und Empfang von Bescheiden. Die Vollmacht kann ich jederzeit in der App widerrufen.";

/** Welche Formulare abzugeben sind. */
export function formulare(r: TaxResult): string[] {
  const set = new Set<string>([r.e1Erforderlich ? "E1" : "L1"]);
  for (const f of r.formular) if (f.formular !== "L1" && f.formular !== "E1") set.add(f.formular);
  return [...set];
}

const eur = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/** Was die Kanzlei vor der Übermittlung ansehen sollte – kritisch zuerst. */
export function pruefliste(c: TaxCase, r: TaxResult, belege: Snapshot["belege"], today = new Date()): PruefPunkt[] {
  const p: PruefPunkt[] = [];
  const f = fristen(c.year, today);
  if (!f.yearEnded) p.push({ stufe: "kritisch", text: `Das Jahr ${c.year} ist noch nicht abgeschlossen – die Erklärung kann erst ab 1. Jänner ${c.year + 1} eingebracht werden.` });
  if (f.expired) p.push({ stufe: "kritisch", text: `Die Frist für ${c.year} ist abgelaufen.` });
  const hatEinkuenfte = c.lohnzettel.length > 0 || c.betriebe.length > 0 || c.mietobjekte.length > 0;
  if (!hatEinkuenfte) p.push({ stufe: "kritisch", text: "Keine Einkünfte erfasst (kein Lohnzettel, kein Betrieb, keine Vermietung)." });
  if (r.erstattung < 0 && r.pflichtveranlagung.length === 0)
    p.push({ stufe: "pruefen", text: `Ergebnis ist eine Nachzahlung von ${eur(-r.erstattung)} ohne Pflichtveranlagung – eine Abgabe ist freiwillig und nicht ratsam.` });
  if (!c.firstName.trim() || !c.lastName.trim()) p.push({ stufe: "pruefen", text: "Vor- und Nachname fehlen im Profil." });
  for (const x of r.pflichtveranlagung) p.push({ stufe: "info", text: `Pflichtveranlagung: ${x}` });

  const offen = belege.filter((b) => !b.uebernommen).length;
  if (offen) p.push({ stufe: "pruefen", text: `${offen} hochgeladene(r) Beleg(e) wurden nicht übernommen.` });
  const ohneBeleg = c.werbungskosten.filter((w) => !w.documentId && w.amount >= 300);
  if (ohneBeleg.length)
    p.push({ stufe: "pruefen", text: `Werbungskosten ohne Beleg in der App: ${ohneBeleg.map((w) => `${w.label || "ohne Bezeichnung"} (${eur(w.amount)})`).join(", ")}.` });
  const bezuege = r.laufendeBezuege + r.sonstigeBezuege;
  if (bezuege > 0 && r.werbungskostenSumme > bezuege * 0.2)
    p.push({ stufe: "pruefen", text: `Werbungskosten (${eur(r.werbungskostenSumme)}) über 20 % der Bezüge – Finanzamt fragt hier häufig nach (Ergänzungsersuchen).` });
  if (c.pendlerKm > 0) p.push({ stufe: "pruefen", text: `Pendlerpauschale mit ${c.pendlerKm} km: Ausdruck des BMF-Pendlerrechners (L 34 EDV) anfordern.` });
  if (r.aussergewoehnlicheBelastungenSumme > 0) p.push({ stufe: "pruefen", text: `Außergewöhnliche Belastungen ${eur(r.aussergewoehnlicheBelastungenSumme)}: Rechnungen und Zahlungsnachweise prüfen.` });
  if (c.doppelteHaushaltsfuehrung > 0 || c.familienheimfahrten > 0) p.push({ stufe: "pruefen", text: "Doppelte Haushaltsführung/Familienheimfahrten: Unzumutbarkeit der Verlegung des Familienwohnsitzes dokumentieren." });
  if (c.children.some((k) => k.familienbonusShare === 1)) p.push({ stufe: "info", text: "Familienbonus Plus zur Gänze beantragt – sicherstellen, dass der andere Elternteil ihn nicht ebenfalls beantragt." });
  if (c.ams.betrag > 0) p.push({ stufe: "info", text: `AMS-Bezüge ${eur(c.ams.betrag)}: Hochrechnung nach § 3 Abs. 2 EStG${r.ams?.mehrsteuer ? ` (kostet ${eur(r.ams.mehrsteuer)})` : ""}.` });
  if (c.ausland.length) p.push({ stufe: "pruefen", text: "Auslandseinkünfte: DBA-Methode, ausländische Steuerbescheinigung und Beilage L1i prüfen." });
  if (c.kapital.ohneKest275 > 0) p.push({ stufe: "pruefen", text: `Kapitalerträge ohne KESt-Abzug ${eur(c.kapital.ohneKest275)}: Steuerreport bzw. Krypto-Aufstellung (Anschaffungskosten, Altbestand) anfordern.` });
  if (c.immobilienverkaeufe.length) p.push({ stufe: "pruefen", text: "Grundstücksverkauf: ImmoESt-Mitteilung des Notars/Parteienvertreters und Befreiungen prüfen." });
  for (const o of c.mietobjekte)
    p.push({ stufe: "pruefen", text: `Vermietung ${o.bezeichnung || ""}: AfA-Basis, Grundanteil (${o.grundanteil} %) und Instandsetzungen prüfen.`.replace(/\s+:/, ":") });
  for (const b of c.betriebe) {
    const name = b.bezeichnung || (b.art === "gewerbe" ? "Gewerbebetrieb" : "Selbständige Tätigkeit");
    if (b.buchungen.length === 0 && b.rechnungen.length === 0 && b.gewinnermittlung === "ear" && b.ausgaben > 0)
      p.push({ stufe: "pruefen", text: `${name}: Ausgaben nur als Summe erfasst – Einnahmen-Ausgaben-Rechnung bzw. Journal anfordern.` });
    if (b.investitionen > 0) p.push({ stufe: "pruefen", text: `${name}: Investitionsbedingter Gewinnfreibetrag – Anschaffungen bzw. Wertpapiere (§ 14 EStG) belegen lassen.` });
  }
  if (r.umsatzsteuer && !r.umsatzsteuer.kleinunternehmer) p.push({ stufe: "pruefen", text: `Umsatzsteuerpflichtig (Umsatz ${eur(r.umsatzsteuer.umsatz)}): U1 und abgegebene UVAs abstimmen.` });
  if (r.provisional) p.push({ stufe: "info", text: `Einige Steuerwerte für ${c.year} sind als vorläufig markiert: ${r.unverified.slice(0, 4).join(", ")}${r.unverified.length > 4 ? " …" : ""}.` });
  const rang = { kritisch: 0, pruefen: 1, info: 2 } as const;
  return p.sort((a, b) => rang[a.stufe] - rang[b.stufe]);
}

/** Kennzahlen je Formular für die Übertragung nach FinanzOnline. */
export function kennzahlen(r: TaxResult): Record<string, FormEntry[]> {
  const out: Record<string, FormEntry[]> = {};
  for (const f of r.formular) (out[f.formular] ??= []).push(f);
  return out;
}

const xmlEsc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/**
 * Übermittlungsdatei im Steuerklar-Format (Version 1): Kennzahlen je Formular mit Prüfsumme.
 * Hinweis: Das ist NICHT das amtliche FinanzOnline-XML. Für die automatische Übermittlung wird ein Adapter auf Basis
 * der aktuellen BMF-Schemata (Datei-Upload/Webservice) benötigt; bis dahin überträgt die Kanzlei die Kennzahlen.
 */
export function uebermittlungsdatei(a: Pick<AbgabeDaten, "id" | "year" | "mandant" | "snapshot" | "freigabe">): string {
  const r = a.snapshot.result;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<steuerklar-erklaerung version="1" abgabe="${xmlEsc(a.id)}" jahr="${a.year}" hash="${a.snapshot.hash}">`,
    `  <steuerpflichtig name="${xmlEsc(a.mandant.name)}" email="${xmlEsc(a.mandant.email)}"/>`,
    `  <freigabe zeitpunkt="${new Date(a.freigabe.at).toISOString()}" hash="${a.freigabe.hash}"/>`,
    `  <ergebnis einkommen="${r.einkommen.toFixed(2)}" einkommensteuer="${r.einkommensteuer.toFixed(2)}" gutschrift="${r.erstattung.toFixed(2)}"/>`,
  ];
  for (const [formular, eintraege] of Object.entries(kennzahlen(r))) {
    lines.push(`  <formular typ="${xmlEsc(formular)}">`);
    for (const e of eintraege) lines.push(`    <kennzahl kz="${xmlEsc(e.kz)}" bezeichnung="${xmlEsc(e.label)}">${xmlEsc(e.value)}</kennzahl>`);
    lines.push("  </formular>");
  }
  lines.push("</steuerklar-erklaerung>");
  return lines.join("\n") + "\n";
}

/** Stabile JSON-Darstellung (sortierte Schlüssel) für die Prüfsumme. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Erstellt den unveränderlichen Stand, den die Mandantin/der Mandant freigibt. */
export async function erstelleSnapshot(c: TaxCase, r: TaxResult, belege: Snapshot["belege"], version: number, now = new Date()): Promise<Snapshot> {
  return {
    version,
    erstelltAt: now.getTime(),
    hash: await sha256Hex(stable({ case: c, result: r })),
    case: c,
    result: r,
    belege,
    pruefliste: pruefliste(c, r, belege, now),
    formulare: formulare(r),
  };
}

/** Freigabe ist nur ohne kritische Punkte möglich. */
export const freigabeMoeglich = (s: Snapshot) => !s.pruefliste.some((p) => p.stufe === "kritisch");
