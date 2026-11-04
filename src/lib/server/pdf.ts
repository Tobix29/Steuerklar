import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BUNDESLAENDER } from "@/lib/tax/constants";
import type { TaxCase, TaxResult } from "@/lib/tax/types";

const eur = (n: number) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(n);
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
    this.page.drawText(clean("Ausfüllhilfe – kein amtliches Formular. Abgabe über FinanzOnline bzw. Formular L1."), {
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
  doc.setTitle(`Arbeitnehmerveranlagung ${c.year} – Ausfüllhilfe`);
  doc.setProducer("Steuerklar");
  doc.setCreator("Steuerklar");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold, `Steuerklar · Arbeitnehmerveranlagung ${c.year} · erstellt am ${new Date().toLocaleDateString("de-AT")}`);

  w.h1(r.e1Erforderlich ? `Einkommensteuererklärung ${c.year}` : `Arbeitnehmerveranlagung ${c.year}`);
  w.text(
    "Diese Ausfüllhilfe fasst deine Angaben und die erkannten Belegwerte zusammen und ordnet sie den Kennzahlen der Formulare L1 " +
      "und L1k in FinanzOnline zu. Die Daten deines Lohnzettels (L16) liegen dem Finanzamt bereits vor und müssen nicht eingetragen werden. " +
      "Bitte prüfe alle Angaben vor der Abgabe. Die Berechnung ist eine Prognose – maßgeblich ist der Einkommensteuerbescheid des Finanzamts.",
  );

  w.h2("Voraussichtliches Ergebnis");
  w.row(r.erstattung >= 0 ? "Voraussichtliche Gutschrift" : "Voraussichtliche Nachforderung", eur(Math.abs(r.erstattung)), { strong: true });
  w.row("Einkommensteuer laut Berechnung (inkl. sonstige Bezüge)", eur(r.einkommensteuer));
  w.row("Bereits einbehaltene Lohnsteuer (KZ 260)", eur(r.anrechenbareLohnsteuer));

  w.h2("In FinanzOnline eintragen", "Formular L1 (Arbeitnehmerveranlagung) bzw. L1k (Familienbonus Plus) – Kennzahlen vor Abgabe prüfen");
  if (r.formular.length === 0) w.text("Keine zusätzlichen Eintragungen nötig – Pauschalen werden automatisch berücksichtigt.");
  for (const f of r.formular) w.row(f.label, f.value, { ref: f.kz === "—" ? f.formular : `${f.formular} · KZ ${f.kz}` });

  w.h2("Persönliche Angaben");
  w.row("Name", [c.firstName, c.lastName].filter(Boolean).join(" ") || "–");
  w.row("Bundesland", BUNDESLAENDER.find((b) => b.code === c.bundesland)?.name ?? c.bundesland);
  w.row("Familienstatus", c.familienstatus === "alleinverdiener" ? "Alleinverdiener:in" : c.familienstatus === "alleinerzieher" ? "Alleinerzieher:in" : "–");

  w.h2("Lohnzettel (L16)", "Zur Kontrolle – diese Werte übermittelt der Arbeitgeber direkt an das Finanzamt");
  for (const l of c.lohnzettel) {
    w.text(l.arbeitgeber ? `Arbeitgeber: ${l.arbeitgeber}` : "Arbeitgeber", 9.5, INK);
    w.row("Bruttobezüge", eur(l.kz210), { ref: "KZ 210" });
    w.row("Sonstige Bezüge (13./14.)", eur(l.kz220), { ref: "KZ 220" });
    w.row("SV-Beiträge laufende Bezüge", eur(l.kz230), { ref: "KZ 230" });
    w.row("Steuerpflichtige Bezüge", eur(l.kz245), { ref: "KZ 245" });
    w.row("Einbehaltene Lohnsteuer", eur(l.kz260), { ref: "KZ 260" });
    if (l.kz718) w.row("Berücksichtigte Pendlerpauschale", eur(l.kz718), { ref: "KZ 718" });
  }

  w.h2("Werbungskosten");
  for (const l of r.werbungskosten) w.row(l.hint ? `${l.label} (${l.hint})` : l.label, eur(l.amount), { ref: l.kz ? `KZ ${l.kz}` : undefined });
  w.row("Summe Werbungskosten", eur(r.werbungskostenSumme), { strong: true });
  for (const x of c.werbungskosten) w.row(`Beleg: ${x.label}`, eur(x.amount));

  if (r.weitereEinkuenfte.length) {
    w.h2("Weitere Einkünfte", "Einkommensteuererklärung E1 mit Beilage E1b (Vermietung) bzw. E1a (Selbständig/Gewerbe)");
    for (const l of r.weitereEinkuenfte) w.row(l.hint ? `${l.label} (${l.hint})` : l.label, eur(l.amount), { strong: l.label.startsWith("Einkünfte") });
    if (r.veranlagungsfreibetrag) w.row("Veranlagungsfreibetrag", `− ${eur(r.veranlagungsfreibetrag)}`);
    w.row("Gesamtbetrag der Einkünfte", eur(r.gesamtbetragDerEinkuenfte), { strong: true });
  }

  if (r.immoESt) {
    w.h2("Immobilienertragsteuer");
    for (const l of r.immoESt.lines) w.row(l.label, eur(l.amount));
    w.row("ImmoESt gesamt", eur(r.immoESt.steuer), { strong: true });
    w.row("Vom Notar abgeführt", eur(r.immoESt.abgefuehrt));
  }
  if (r.umsatzsteuer) {
    w.h2("Umsatzsteuer", "Eigene Erklärung U1 bzw. Umsatzsteuervoranmeldungen – nicht Teil der Einkommensteuer");
    w.row(r.umsatzsteuer.kleinunternehmer ? "Kleinunternehmer:in (keine USt)" : "Umsatzsteuerpflichtig", `${eur(r.umsatzsteuer.umsatz)} Umsatz`);
    if (!r.umsatzsteuer.kleinunternehmer) {
      for (const l of r.umsatzsteuer.lines) w.row(l.hint ? `${l.label} (${l.hint})` : l.label, eur(l.amount));
      w.row(r.umsatzsteuer.zahllast >= 0 ? "Zahllast" : "Gutschrift", eur(Math.abs(r.umsatzsteuer.zahllast)), { strong: true });
    }
  }

  if (r.sonderausgaben.length) {
    w.h2("Sonderausgaben");
    for (const l of r.sonderausgaben) w.row(l.hint ? `${l.label} (${l.hint})` : l.label, eur(l.amount), { ref: l.kz ? `KZ ${l.kz}` : undefined });
  }
  if (r.aussergewoehnlicheBelastungen.length) {
    w.h2("Außergewöhnliche Belastungen");
    for (const k of c.krankheitskosten) w.row(k.label, eur(k.amount));
    for (const l of r.aussergewoehnlicheBelastungen) w.row(l.hint ? `${l.label} (${l.hint})` : l.label, eur(l.amount), { strong: true });
  }
  if (c.children.length) {
    w.h2("Kinder (L1k)");
    for (const k of c.children)
      w.row(`${k.firstName || "Kind"} (geb. ${k.birthYear}), ${k.months} Monate Familienbeihilfe`, k.familienbonusShare === 1 ? "Familienbonus ganz" : "Familienbonus halb");
  }

  w.h2("Steuerberechnung (Prognose)");
  w.row("Laufende Bezüge (steuerpflichtig)", eur(r.laufendeBezuege));
  w.row("Werbungskosten", `− ${eur(r.werbungskostenSumme)}`);
  w.row("Einkünfte aus nichtselbständiger Arbeit", eur(r.einkuenfte));
  if (r.sonderausgabenSumme) w.row("Sonderausgaben", `− ${eur(r.sonderausgabenSumme)}`);
  if (r.aussergewoehnlicheBelastungenSumme) w.row("Außergewöhnliche Belastungen", `− ${eur(r.aussergewoehnlicheBelastungenSumme)}`);
  w.row("Einkommen", eur(r.einkommen), { strong: true });
  w.row("Steuer laut Tarif", eur(r.tarifsteuer));
  for (const a of r.absetzbetraege) w.row(a.label, `− ${eur(a.amount)}`);
  for (const a of r.negativsteuer) w.row(`${a.label} (Gutschrift)`, `− ${eur(a.amount)}`);
  w.row("Steuer auf sonstige Bezüge (Jahressechstel)", `+ ${eur(r.steuerSonstigeBezuege)}`);
  w.row("Einkommensteuer", eur(r.einkommensteuer), { strong: true });
  w.row("Grenzsteuersatz", `${(r.grenzsteuersatz * 100).toFixed(0)} %`);

  if (r.hinweise.length || r.pflichtveranlagung.length) {
    w.h2("Hinweise");
    for (const h of [...r.pflichtveranlagung, ...r.hinweise]) w.text(`• ${h}`);
  }
  return doc.save();
}
