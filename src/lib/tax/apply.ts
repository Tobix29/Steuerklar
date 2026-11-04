import type { Extraction } from "@/lib/ai/schema";
import type { TaxCase } from "./types";

export interface ApplyTarget {
  id: string;
  extraction: Extraction;
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Betrag, der aus einem Beleg verbucht wird (Werbungskosten ggf. mit beruflichem Anteil). */
export function belegAmount(e: Extraction): number {
  const b = e.beleg;
  if (!b) return 0;
  if (e.documentType === "werbungskosten") return r2(n(b.betrag) * (b.beruflicherAnteil ?? 1));
  return n(b.betrag);
}

/** Übernimmt einen bestätigten Beleg in den Steuerfall. Gibt den verbuchten Betrag zurück. */
export function applyDocument(c: TaxCase, doc: ApplyTarget): { case: TaxCase; amount: number } {
  const next = structuredClone(c);
  unapplyDocument(next, doc);
  const e = doc.extraction;
  const b = e.beleg;
  const label = (fallback: string) => (b?.beschreibung || b?.empfaenger || fallback).slice(0, 200);
  const amount = belegAmount(e);

  switch (e.documentType) {
    case "lohnzettel": {
      const l = e.lohnzettel;
      if (!l) throw new Error("Keine Werte des Lohnzettels vorhanden.");
      next.lohnzettel.push({
        id: doc.id,
        arbeitgeber: l.arbeitgeber ?? "",
        art: l.istPension ? "pension" : "aktiv",
        kz210: n(l.kz210), kz215: n(l.kz215), kz220: n(l.kz220), kz225: n(l.kz225), kz230: n(l.kz230),
        kz245: n(l.kz245), kz260: n(l.kz260), kz717: n(l.kz717), kz718: n(l.kz718), kz916: n(l.kz916),
      });
      next.telearbeitstage = Math.min(366, next.telearbeitstage + n(l.telearbeitstage));
      next.telearbeitspauschaleArbeitgeber = r2(next.telearbeitspauschaleArbeitgeber + n(l.telearbeitspauschale));
      return { case: next, amount: n(l.kz210) };
    }
    case "werbungskosten":
      next.werbungskosten.push({ id: doc.id, documentId: doc.id, label: label("Werbungskosten"), amount, category: b?.wkKategorie ?? "sonstige" });
      return { case: next, amount };
    case "ergonomisches_mobiliar":
      next.mobiliar = r2(next.mobiliar + amount);
      return { case: next, amount };
    case "spendenbestaetigung":
      next.spenden.push({ id: doc.id, documentId: doc.id, label: label("Spende"), amount });
      return { case: next, amount };
    case "kirchenbeitrag":
      next.kirchenbeitrag = r2(next.kirchenbeitrag + amount);
      return { case: next, amount };
    case "krankheitskosten":
      next.krankheitskosten.push({ id: doc.id, documentId: doc.id, label: label("Krankheitskosten"), amount });
      return { case: next, amount };
    case "steuerberatung":
      next.steuerberatung.push({ id: doc.id, documentId: doc.id, label: label("Steuerberatung"), amount });
      return { case: next, amount };
    default:
      throw new Error("Bitte wähle eine Belegart, damit der Beleg übernommen werden kann.");
  }
}

/** Entfernt alle Buchungen eines Belegs aus dem Steuerfall (mutiert `c`). */
export function unapplyDocument(c: TaxCase, doc: ApplyTarget & { applied?: boolean }): TaxCase {
  const drop = <T extends { id: string; documentId?: string }>(xs: T[]) => xs.filter((x) => x.id !== doc.id && x.documentId !== doc.id);
  const hadLz = c.lohnzettel.some((x) => x.id === doc.id);
  c.lohnzettel = drop(c.lohnzettel);
  c.werbungskosten = drop(c.werbungskosten);
  c.spenden = drop(c.spenden);
  c.krankheitskosten = drop(c.krankheitskosten);
  c.steuerberatung = drop(c.steuerberatung);
  const e = doc.extraction;
  if (doc.applied) {
    if (e.documentType === "ergonomisches_mobiliar") c.mobiliar = Math.max(0, r2(c.mobiliar - belegAmount(e)));
    if (e.documentType === "kirchenbeitrag") c.kirchenbeitrag = Math.max(0, r2(c.kirchenbeitrag - belegAmount(e)));
  }
  if (hadLz && e.lohnzettel) {
    c.telearbeitstage = Math.max(0, c.telearbeitstage - n(e.lohnzettel.telearbeitstage));
    c.telearbeitspauschaleArbeitgeber = Math.max(0, r2(c.telearbeitspauschaleArbeitgeber - n(e.lohnzettel.telearbeitspauschale)));
  }
  return c;
}
