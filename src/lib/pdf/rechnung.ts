/** Rechnungs-PDF (A4) mit allen Angaben nach § 11 UStG. Läuft im Browser (Demo) und auf dem Server. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { faelligAm, rechnungSummen, steuerHinweis, type Firma, type Rechnung } from "@/lib/tax/rechnung";

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const clean = (s: string) => [...s].map((c) => (c.charCodeAt(0) < 256 || WIN_ANSI_EXTRA.includes(c) ? c : "")).join("");
const eur = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const num = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const de = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join(".") : iso);

const INK = rgb(0.11, 0.11, 0.12);
const MUTED = rgb(0.43, 0.43, 0.45);
const LINE = rgb(0.88, 0.88, 0.9);
const ACCENT = rgb(0, 0.443, 0.89);

export async function rechnungPdf(r: Rechnung, firma: Firma): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(`Rechnung ${r.nummer}`));
  doc.setAuthor(clean(firma.name));
  doc.setCreator("Steuerklar");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 56;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, yy: number, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const size = o.size ?? 10, f = o.f ?? font, t = clean(s);
    const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, { x: o.right ? x - w : x, y: yy, size, font: f, color: o.color ?? INK });
  };
  const wrap = (s: string, width: number, size = 10, f = font) => {
    const out: string[] = [];
    for (const para of clean(s).split("\n")) {
      let line = "";
      for (const w of para.split(/\s+/)) {
        const t = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(t, size) > width && line) {
          out.push(line);
          line = w;
        } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const ensure = (h: number) => {
    if (y - h < 90) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };

  // Kopf: Absender
  text(firma.name || "[Name]", M, y, { size: 16, f: bold });
  y -= 18;
  for (const l of wrap(firma.adresse, 260, 9)) { text(l, M, y, { size: 9, color: MUTED }); y -= 12; }
  if (firma.email) { text(firma.email, M, y, { size: 9, color: MUTED }); y -= 12; }
  if (firma.uid) { text(`UID: ${firma.uid}`, M, y, { size: 9, color: MUTED }); y -= 12; }

  // Empfänger
  y -= 24;
  const top = y;
  if (r.kunde.name) {
    text(r.kunde.name, M, y, { size: 11, f: bold });
    y -= 14;
    for (const l of wrap(r.kunde.adresse, 260)) { text(l, M, y); y -= 13; }
    if (r.kunde.uid) { text(`UID: ${r.kunde.uid}`, M, y, { size: 9, color: MUTED }); y -= 12; }
  }
  // Rechnungsdaten rechts
  let ry = top;
  const meta: [string, string][] = [
    ["Rechnungsnummer", r.nummer],
    ["Rechnungsdatum", de(r.datum)],
    ["Leistung", r.leistungBis && r.leistungBis !== r.leistungVon ? `${de(r.leistungVon)} – ${de(r.leistungBis)}` : de(r.leistungVon)],
    ["Fällig am", de(faelligAm(r))],
  ];
  for (const [k, v] of meta) {
    text(k, W - M - 150, ry, { size: 9, color: MUTED });
    text(v, W - M, ry, { size: 9, f: bold, right: true });
    ry -= 13;
  }
  y = Math.min(y, ry) - 30;

  text(r.storniert ? `STORNO – Rechnung ${r.nummer}` : `Rechnung ${r.nummer}`, M, y, { size: 20, f: bold, color: r.storniert ? rgb(0.8, 0.1, 0.1) : INK });
  y -= 30;

  // Positionen
  const cols = { pos: M, text: M + 24, menge: W - M - 230, ep: W - M - 140, ust: W - M - 70, sum: W - M };
  text("Pos.", cols.pos, y, { size: 8.5, color: MUTED });
  text("Bezeichnung", cols.text, y, { size: 8.5, color: MUTED });
  text("Menge", cols.menge, y, { size: 8.5, color: MUTED, right: true });
  text("Einzelpreis", cols.ep, y, { size: 8.5, color: MUTED, right: true });
  text("USt", cols.ust, y, { size: 8.5, color: MUTED, right: true });
  text("Netto", cols.sum, y, { size: 8.5, color: MUTED, right: true });
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: LINE });
  y -= 14;
  const s = rechnungSummen(r, firma);
  r.positionen.forEach((p, i) => {
    const lines = wrap(p.text, cols.menge - cols.text - 60, 10);
    ensure(lines.length * 13 + 8);
    text(String(i + 1), cols.pos, y);
    lines.forEach((l, j) => text(l, cols.text, y - j * 13));
    text(`${num(p.menge)} ${p.einheit}`, cols.menge, y, { right: true });
    text(eur(p.preis), cols.ep, y, { right: true });
    text(s.ohneUst ? "–" : `${p.ustSatz} %`, cols.ust, y, { right: true });
    text(eur(p.menge * p.preis), cols.sum, y, { right: true });
    y -= lines.length * 13 + 6;
  });
  page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.8, color: LINE });
  y -= 12;

  // Summen
  ensure(90);
  const sumRow = (k: string, v: string, strong = false) => {
    text(k, W - M - 150, y, { size: strong ? 11 : 10, f: strong ? bold : font, color: strong ? INK : MUTED });
    text(v, W - M, y, { size: strong ? 11 : 10, f: strong ? bold : font, right: true });
    y -= strong ? 18 : 14;
  };
  sumRow("Summe netto", eur(s.netto));
  if (!s.ohneUst) for (const x of s.saetze) sumRow(`${x.satz} % USt von ${eur(x.netto)}`, eur(x.ust));
  y -= 2;
  sumRow("Gesamtbetrag", eur(s.brutto), true);

  const hinweis = steuerHinweis(r, firma);
  y -= 10;
  const foot = [
    ...(hinweis ? [hinweis] : []),
    `Zahlbar bis ${de(faelligAm(r))} ohne Abzug${firma.iban ? ` auf das Konto IBAN ${firma.iban}${firma.bic ? `, BIC ${firma.bic}` : ""}` : ""}. Bitte Rechnungsnummer ${r.nummer} als Verwendungszweck angeben.`,
    ...(r.notiz ? [r.notiz] : []),
  ];
  for (const f of foot)
    for (const l of wrap(f, W - 2 * M, 9.5)) {
      ensure(14);
      text(l, M, y, { size: 9.5, color: f === hinweis ? INK : MUTED, f: f === hinweis ? bold : font });
      y -= 13;
    }

  // Fußzeile
  for (const p of doc.getPages()) {
    p.drawLine({ start: { x: M, y: 56 }, end: { x: W - M, y: 56 }, thickness: 0.5, color: LINE });
    const f = clean([firma.name, firma.adresse.replace(/\n/g, ", "), firma.uid && `UID ${firma.uid}`, firma.iban && `IBAN ${firma.iban}`].filter(Boolean).join(" · "));
    p.drawText(f.slice(0, 140), { x: M, y: 42, size: 7.5, font, color: MUTED });
    p.drawText("Erstellt mit Steuerklar", { x: W - M - font.widthOfTextAtSize("Erstellt mit Steuerklar", 7) , y: 30, size: 7, font, color: ACCENT });
  }
  return doc.save();
}
