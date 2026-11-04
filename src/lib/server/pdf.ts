import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BUNDESLAENDER } from "@/lib/tax/constants";
import type { TaxCase, TaxResult } from "@/lib/tax/types";

const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
/** Standard-PDF-Schriften kennen nur WinAnsi – alles andere ersetzen. */
const clean = (s: string) =>
  [...s.replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=")]
    .map((c) => (c.charCodeAt(0) < 256 || WIN_ANSI_EXTRA.includes(c) ? c : ""))
    .join("");

const INK = rgb(0.11, 0.11, 0.12);
const MUTED = rgb(0.43, 0.43, 0.45);
const ACCENT = rgb(0, 0.443, 0.89);
const LINE = rgb(0.9, 0.9, 0.92);

class Writer {
  page!: PDFPage;
  y = 0;
  readonly margin = 48;
  readonly width = 595.28;
  readonly height = 841.89;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont, private title: string) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
    this.page.drawText(clean(this.title), { x: this.margin, y: this.height - 28, size: 8, font: this.font, color: MUTED });
    const n = this.doc.getPageCount();
    this.page.drawText(`Seite ${n}`, { x: this.width - this.margin - 30, y: 24, size: 8, font: this.font, color: MUTED });
    this.page.drawText(clean("Ausfüllhilfe – kein amtlicher Vordruck. Übertragung über ELSTER oder amtliche Formulare."), {
      x: this.margin, y: 24, size: 8, font: this.font, color: MUTED,
    });
  }
  ensure(h: number) {
    if (this.y - h < 56) this.newPage();
  }
  h1(text: string) {
    this.ensure(40);
    this.page.drawText(clean(text), { x: this.margin, y: this.y - 22, size: 22, font: this.bold, color: INK });
    this.y -= 34;
  }
  h2(text: string, sub?: string) {
    this.ensure(48);
    this.y -= 14;
    this.page.drawText(clean(text), { x: this.margin, y: this.y - 14, size: 13, font: this.bold, color: INK });
    if (sub) this.page.drawText(clean(sub), { x: this.margin, y: this.y - 28, size: 8.5, font: this.font, color: MUTED });
    this.y -= sub ? 36 : 22;
  }
  text(text: string, size = 9.5, color = MUTED) {
    for (const line of this.wrap(clean(text), size, this.width - 2 * this.margin)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x: this.margin, y: this.y - size, size, font: this.font, color });
      this.y -= size + 4;
    }
  }
  row(label: string, value: string, opts: { ref?: string; strong?: boolean } = {}) {
    this.ensure(20);
    const f = opts.strong ? this.bold : this.font;
    const labelLines = this.wrap(clean(label), 9.5, 330);
    const vx = this.width - this.margin - f.widthOfTextAtSize(clean(value), 10);
    labelLines.forEach((l, i) => this.page.drawText(l, { x: this.margin, y: this.y - 11 - i * 12, size: 9.5, font: f, color: INK }));
    if (opts.ref) this.page.drawText(clean(opts.ref), { x: 400, y: this.y - 11, size: 8, font: this.font, color: ACCENT });
    this.page.drawText(clean(value), { x: vx, y: this.y - 11, size: 10, font: f, color: INK });
    const h = Math.max(1, labelLines.length) * 12 + 6;
    this.page.drawLine({ start: { x: this.margin, y: this.y - h }, end: { x: this.width - this.margin, y: this.y - h }, thickness: 0.5, color: LINE });
    this.y -= h + 2;
  }
  private wrap(text: string, size: number, max: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (this.font.widthOfTextAtSize(next, size) > max && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }
}

export async function buildPdf(c: TaxCase, r: TaxResult): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Einkommensteuererklärung ${c.year} – Ausfüllhilfe`);
  doc.setProducer("Steuerklar");
  doc.setCreator("Steuerklar");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold, `Steuerklar · Einkommensteuererklärung ${c.year} · erstellt am ${new Date().toLocaleDateString("de-DE")}`);

  w.h1(`Einkommensteuererklärung ${c.year}`);
  w.text(
    "Diese Ausfüllhilfe fasst Ihre Angaben und die erkannten Belegwerte zusammen. Die Werte sind den amtlichen Vordrucken bzw. den " +
      "Eingabefeldern in Mein ELSTER zugeordnet. Bitte prüfen Sie alle Angaben vor der Abgabe. Die Steuerberechnung ist eine Prognose – " +
      "maßgeblich ist der Steuerbescheid des Finanzamts.",
  );

  /* Ergebnis */
  w.h2("Voraussichtliches Ergebnis");
  w.row(r.erstattung >= 0 ? "Voraussichtliche Erstattung" : "Voraussichtliche Nachzahlung", eur(Math.abs(r.erstattung)), { strong: true });
  w.row("Festzusetzende Einkommensteuer", eur(r.festzusetzen.einkommensteuer));
  w.row("Solidaritätszuschlag", eur(r.festzusetzen.soli));
  w.row("Kirchensteuer", eur(r.festzusetzen.kirchensteuer));
  w.row("Bereits gezahlt (Lohnsteuer, Soli, Kirchensteuer)", eur(r.bereitsGezahlt.summe));

  /* Hauptvordruck */
  w.h2("Hauptvordruck (ESt 1 A)", "Allgemeine Angaben");
  w.row("Veranlagungsart", c.filing === "joint" ? "Zusammenveranlagung" : "Einzelveranlagung");
  w.row("Bundesland", BUNDESLAENDER.find((b) => b.code === c.bundesland)?.name ?? c.bundesland);
  c.persons.slice(0, c.filing === "joint" ? 2 : 1).forEach((p, i) => {
    w.row(`${i === 0 ? "Steuerpflichtige Person" : "Ehegatte/Lebenspartner:in"}`, [p.firstName, p.lastName].filter(Boolean).join(" ") || "–");
    w.row("Kirchenmitglied", p.churchMember ? "ja" : "nein");
  });
  if (c.alleinerziehend) w.row("Alleinerziehend (Entlastungsbetrag)", eur(r.entlastungsbetragAlleinerziehend));

  /* Anlage N */
  c.persons.slice(0, c.filing === "joint" ? 2 : 1).forEach((p, i) => {
    const pr = r.persons[i]!;
    w.h2(`Anlage N – ${pr.name}`, "Einkünfte aus nichtselbständiger Arbeit (Werte aus der Lohnsteuerbescheinigung)");
    for (const e of p.employments) {
      w.text(e.employer ? `Arbeitgeber: ${e.employer}` : "Arbeitgeber", 9.5, INK);
      w.row("Bruttoarbeitslohn", eur(e.bruttoarbeitslohn), { ref: "LStB Zeile 3" });
      w.row("Lohnsteuer", eur(e.lohnsteuer), { ref: "LStB Zeile 4" });
      w.row("Solidaritätszuschlag", eur(e.soli), { ref: "LStB Zeile 5" });
      w.row("Kirchensteuer", eur(e.kirchensteuer), { ref: "LStB Zeile 6" });
      if (e.kirchensteuerEhegatte) w.row("Kirchensteuer Ehegatte", eur(e.kirchensteuerEhegatte), { ref: "LStB Zeile 7" });
      if (e.lohnersatzleistungen) w.row("Lohnersatzleistungen", eur(e.lohnersatzleistungen), { ref: "LStB Zeile 15" });
      if (e.steuerfreieFahrtkosten) w.row("Steuerfreie Fahrtkostenerstattung", eur(e.steuerfreieFahrtkosten), { ref: "LStB Zeile 17/18" });
    }
    if (p.weitereLohnersatzleistungen) w.row("Elterngeld/ALG I u. a. (Progressionsvorbehalt)", eur(p.weitereLohnersatzleistungen));
    w.text("Werbungskosten", 9.5, INK);
    for (const d of pr.werbungskostenDetails) w.row(d.hint ? `${d.label} (${d.hint})` : d.label, eur(d.amount));
    w.row("Angesetzte Werbungskosten", eur(pr.werbungskostenAngesetzt), {
      strong: true,
      ref: pr.werbungskostenAngesetzt > pr.werbungskostenTatsaechlich ? "Pauschbetrag" : undefined,
    });
    if (p.commuteKm > 0) w.row("Erste Tätigkeitsstätte: Entfernung / Arbeitstage", `${Math.floor(p.commuteKm)} km / ${p.commuteDays} Tage`);
    if (p.homeofficeDays > 0) w.row("Tage mit Tätigkeit überwiegend in der Wohnung", `${p.homeofficeDays}`);
  });

  /* Vorsorge */
  const emps = c.persons.slice(0, c.filing === "joint" ? 2 : 1).flatMap((p) => p.employments);
  const s = (k: keyof (typeof emps)[number]) => emps.reduce((a, e) => a + (e[k] as number), 0);
  w.h2("Anlage Vorsorgeaufwand", "Werte werden in ELSTER weitgehend automatisch aus der Lohnsteuerbescheinigung übernommen");
  w.row("Arbeitnehmeranteil Rentenversicherung", eur(s("rvArbeitnehmer")), { ref: "LStB Zeile 23a" });
  w.row("Arbeitgeberanteil Rentenversicherung", eur(s("rvArbeitgeber")), { ref: "LStB Zeile 22a" });
  w.row("Krankenversicherung (Arbeitnehmer)", eur(s("kvArbeitnehmer")), { ref: "LStB Zeile 25" });
  w.row("Pflegeversicherung (Arbeitnehmer)", eur(s("pvArbeitnehmer")), { ref: "LStB Zeile 26" });
  w.row("Arbeitslosenversicherung (Arbeitnehmer)", eur(s("alvArbeitnehmer")), { ref: "LStB Zeile 27" });
  if (s("pkvBasis")) w.row("Private Kranken-/Pflegeversicherung (Basis)", eur(s("pkvBasis")), { ref: "LStB Zeile 28" });

  /* Sonderausgaben */
  w.h2("Sonderausgaben");
  for (const l of r.sonderausgaben) w.row(l.hint ? `${l.label} (${l.hint})` : l.label, eur(l.amount));
  for (const sp of c.spenden) w.row(`Spende: ${sp.label}`, eur(sp.amount), { ref: "Anlage Sonderausgaben" });

  /* Kinder */
  if (c.children.length) {
    w.h2("Anlage Kind");
    for (const k of c.children) {
      w.row(`${k.firstName || "Kind"} (geb. ${k.birthYear}), ${k.months} Monate`, k.share === 1 ? "voller Freibetrag" : "halber Freibetrag");
      if (k.betreuungskosten) w.row("Kinderbetreuungskosten", eur(k.betreuungskosten));
    }
    w.row("Günstigerprüfung", r.kinderfreibetraegeAngesetzt ? "Freibeträge günstiger" : "Kindergeld günstiger");
  }

  /* §35a & agB */
  if (r.steuerermaessigung35a.length || c.handwerkerleistungen.length || c.haushaltsnaheDienstleistungen.length) {
    w.h2("Haushaltsnahe Aufwendungen (§35a EStG)", "Hauptvordruck – Steuerermäßigungen; nur unbar gezahlte Arbeitskosten");
    for (const h of c.haushaltsnaheDienstleistungen) w.row(`Dienstleistung: ${h.label}`, eur(h.amount));
    for (const h of c.handwerkerleistungen) w.row(`Handwerker: ${h.label}`, eur(h.amount));
    for (const l of r.steuerermaessigung35a) w.row(`Ermäßigung: ${l.label}`, eur(l.amount), { strong: true });
  }
  if (c.krankheitskosten.length) {
    w.h2("Außergewöhnliche Belastungen", "Anlage Außergewöhnliche Belastungen");
    for (const k of c.krankheitskosten) w.row(k.label, eur(k.amount));
    for (const l of r.aussergewoehnlicheBelastungen) w.row(l.hint ? `${l.label} (${l.hint})` : l.label, eur(l.amount), { strong: true });
  }

  /* Berechnung */
  w.h2("Steuerberechnung (Prognose)");
  r.persons.forEach((p) => w.row(`Einkünfte nichtselbständige Arbeit – ${p.name}`, eur(p.einkuenfte)));
  w.row("Gesamtbetrag der Einkünfte", eur(r.gesamtbetragDerEinkuenfte));
  w.row("Sonderausgaben", `− ${eur(r.sonderausgabenSumme)}`);
  if (r.aussergewoehnlicheBelastungenSumme) w.row("Außergewöhnliche Belastungen", `− ${eur(r.aussergewoehnlicheBelastungenSumme)}`);
  if (r.kinderfreibetraegeAngesetzt) w.row("Freibeträge für Kinder", `− ${eur(r.kinderfreibetraege)}`);
  w.row("Zu versteuerndes Einkommen", eur(r.zuVersteuerndesEinkommen), { strong: true });
  w.row(c.filing === "joint" ? "Tarifliche Einkommensteuer (Splittingtarif)" : "Tarifliche Einkommensteuer (Grundtarif)", eur(r.tariflicheEinkommensteuer));
  if (r.steuersatzProgression !== null) w.row("Besonderer Steuersatz (Progressionsvorbehalt)", `${(r.steuersatzProgression * 100).toFixed(2)} %`);
  if (r.kindergeldHinzurechnung) w.row("Hinzurechnung Kindergeld", `+ ${eur(r.kindergeldHinzurechnung)}`);
  w.row("Grenzsteuersatz", `${(r.grenzsteuersatz * 100).toFixed(1)} %`);

  if (r.hinweise.length || r.pflichtveranlagung.length) {
    w.h2("Hinweise");
    for (const h of [...r.pflichtveranlagung, ...r.hinweise]) w.text(`• ${h}`);
  }
  return doc.save();
}
