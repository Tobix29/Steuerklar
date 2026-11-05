/**
 * Rücklagen- und Fristenplaner für Selbständige und Vermieter:innen:
 *  - SVS-Beiträge (GSVG) aus dem Gewinn schätzen
 *  - Einkommensteuer-Vorauszahlungen für das Folgejahr (§45 EStG) schätzen
 *  - Umsatzsteuervoranmeldungen: Zeitraum, Zahllast je Zeitraum, Fälligkeiten
 *  - Alle Fristen und Zahlungstermine als Liste
 */
import { calculate } from "./calculate";
import { fristen, SVS, UVA } from "./constants";
import type { TaxCase, TaxResult } from "./types";

const cents = (n: number) => Math.round(n * 100) / 100;

export interface SvsSchaetzung {
  beitragsgrundlage: number;
  pv: number;
  kv: number;
  vorsorge: number;
  uv: number;
  summe: number;
  quartal: number;
  mindest: boolean;
  hoechst: boolean;
}

/** GSVG-Beiträge: Beitragsgrundlage = Gewinn + darin abgezogene SVS-Beiträge, begrenzt durch Mindest-/Höchstbeitragsgrundlage. */
export function svsSchaetzung(gewinnVorSv: number, monate = 12): SvsSchaetzung {
  const min = SVS.mindestMonat * monate;
  const max = SVS.hoechstMonat * monate;
  const bg = Math.min(max, Math.max(min, gewinnVorSv));
  const pv = cents(bg * SVS.pv);
  const kv = cents(bg * SVS.kv);
  const vorsorge = cents(bg * SVS.vorsorge);
  const uv = cents(SVS.uvMonat * monate);
  const summe = cents(pv + kv + vorsorge + uv);
  return { beitragsgrundlage: cents(bg), pv, kv, vorsorge, uv, summe, quartal: cents(summe / 4), mindest: gewinnVorSv < min, hoechst: gewinnVorSv > max };
}

export interface Planung {
  svs: SvsSchaetzung | null;
  /** Einkommensteuer, die auf die betrieblichen Einkünfte und Vermietung entfällt */
  estAufNebeneinkuenfte: number;
  /** Geschätzte vierteljährliche Einkommensteuer-Vorauszahlung im Folgejahr */
  vorauszahlungQuartal: number;
  uva: { zeitraum: "monatlich" | "vierteljährlich"; abgabepflicht: boolean; zahllastJeZeitraum: number } | null;
  /** Empfohlene monatliche Rücklage */
  ruecklageMonat: number;
}

export function planung(c: TaxCase, r: TaxResult = calculate(c)): Planung {
  const ohne = calculate({ ...c, betriebe: [], mietobjekte: [] });
  const estAufNeben = cents(Math.max(0, ohne.erstattung - r.erstattung));
  let svs: SvsSchaetzung | null = null;
  if (c.betriebe.length) {
    // Gewinn vor SVS: Einkünfte aus dem Betrieb zuzüglich bereits abgezogener SVS-Beiträge
    const gewinne = r.weitereEinkuenfte.filter((l) => l.label.startsWith("Einkünfte aus selbständiger") || l.label.startsWith("Einkünfte aus Gewerbe"));
    const gewinn = gewinne.reduce((a, l) => a + l.amount, 0) + c.betriebe.reduce((a, b) => a + b.sozialversicherung, 0);
    svs = svsSchaetzung(gewinn);
  }
  let uva: Planung["uva"] = null;
  if (r.umsatzsteuer && !r.umsatzsteuer.kleinunternehmer) {
    const monatlich = r.umsatzsteuer.umsatz > UVA.monatlichAb;
    uva = {
      zeitraum: monatlich ? "monatlich" : "vierteljährlich",
      abgabepflicht: r.umsatzsteuer.umsatz > UVA.abgabepflichtAb(c.year),
      zahllastJeZeitraum: cents(r.umsatzsteuer.zahllast / (monatlich ? 12 : 4)),
    };
  }
  const vorauszahlungQuartal = cents(estAufNeben / 4);
  const svsMehr = svs ? Math.max(0, svs.summe - c.betriebe.reduce((a, b) => a + b.sozialversicherung, 0)) : 0;
  const ruecklageMonat = cents((estAufNeben + svsMehr + Math.max(0, uva ? r.umsatzsteuer!.zahllast : 0)) / 12);
  return { svs, estAufNebeneinkuenfte: estAufNeben, vorauszahlungQuartal, uva, ruecklageMonat };
}

export interface Termin {
  datum: string; // JJJJ-MM-TT
  titel: string;
  art: "erklaerung" | "zahlung" | "uva" | "svs" | "frist";
  betrag?: number;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Alle relevanten Termine ab `today` (12 Monate Vorschau), sortiert. */
export function termine(c: TaxCase, r: TaxResult, today = new Date()): Termin[] {
  const out: Termin[] = [];
  const y = today.getUTCFullYear();
  const vj = c.year;
  const p = planung(c, r);
  const e1 = r.e1Erforderlich || r.pflichtveranlagung.length > 0;

  // Erklärung für das gewählte Jahr
  if (e1) {
    out.push({ datum: iso(vj + 1, 4, 30), titel: `Steuererklärung ${vj} in Papierform`, art: "erklaerung" });
    out.push({ datum: iso(vj + 1, 6, 30), titel: `Steuererklärung ${vj} über FinanzOnline (Pflicht)`, art: "erklaerung" });
  }
  if (r.pflichtveranlagung.length && !r.e1Erforderlich) out.push({ datum: iso(vj + 1, 9, 30), titel: `Pflichtveranlagung ${vj} (L1)`, art: "erklaerung" });
  out.push({ datum: iso(vj + 1, 3, 1), titel: `Steuer-Check ${vj} starten – die Lohnzettel liegen jetzt in FinanzOnline`, art: "erklaerung" });
  const f = fristen(vj, today);
  if (!f.expired) out.push({ datum: iso(vj + 5, 12, 31), titel: `Letzter Tag: Arbeitnehmerveranlagung ${vj}`, art: "frist" });
  if (r.umsatzsteuer && !r.umsatzsteuer.kleinunternehmer) out.push({ datum: iso(vj + 1, 6, 30), titel: `Umsatzsteuer-Jahreserklärung ${vj} (U1)`, art: "erklaerung" });

  // Vorauszahlungen und SVS im laufenden/nächsten Jahr
  for (const jahr of [y, y + 1]) {
    if (p.vorauszahlungQuartal > 0)
      for (const [m, d] of [[2, 15], [5, 15], [8, 15], [11, 15]] as const)
        out.push({ datum: iso(jahr, m, d), titel: "Einkommensteuer-Vorauszahlung", art: "zahlung", betrag: p.vorauszahlungQuartal });
    if (p.svs)
      for (const [m, d] of [[2, 28], [5, 31], [8, 31], [11, 30]] as const)
        out.push({ datum: iso(jahr, m, d), titel: "SVS-Beiträge (Quartal)", art: "svs", betrag: p.svs.quartal });
    if (p.uva) {
      if (p.uva.zeitraum === "monatlich")
        for (let m = 1; m <= 12; m++) {
          const due = m + 2 > 12 ? iso(jahr + 1, m + 2 - 12, 15) : iso(jahr, m + 2, 15);
          out.push({ datum: due, titel: `UVA ${String(m).padStart(2, "0")}/${jahr}${p.uva.abgabepflicht ? "" : " (nur Zahlung)"}`, art: "uva", betrag: p.uva.zahllastJeZeitraum });
        }
      else
        for (const [q, due] of [[1, iso(jahr, 5, 15)], [2, iso(jahr, 8, 15)], [3, iso(jahr, 11, 15)], [4, iso(jahr + 1, 2, 15)]] as const)
          out.push({ datum: due, titel: `UVA ${q}. Quartal ${jahr}${p.uva.abgabepflicht ? "" : " (nur Zahlung)"}`, art: "uva", betrag: p.uva.zahllastJeZeitraum });
    }
  }
  const heute = today.toISOString().slice(0, 10);
  const bis = iso(y + 1, today.getUTCMonth() + 1, Math.min(28, today.getUTCDate()));
  return out
    .filter((t) => t.datum >= heute && (t.art === "frist" || t.datum <= bis))
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .filter((t, i, xs) => i === 0 || !(t.datum === xs[i - 1]!.datum && t.titel === xs[i - 1]!.titel));
}
