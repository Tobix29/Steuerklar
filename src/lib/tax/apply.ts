import type { Extraction } from "@/lib/ai/schema";
import type { TaxCase } from "./types";

export interface ApplyTarget {
  id: string;
  extraction: Extraction;
  personIndex: number;
  childId?: string;
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Übernimmt einen bestätigten Beleg in den Steuerfall. Gibt den verbuchten Betrag zurück. */
export function applyDocument(c: TaxCase, doc: ApplyTarget): { case: TaxCase; amount: number } {
  const next = structuredClone(c);
  unapplyDocument(next, doc, 0); // idempotent für Listeneinträge
  const person = next.persons[Math.min(doc.personIndex, next.persons.length - 1)]!;
  const e = doc.extraction;
  const b = e.beleg;
  const label = (fallback: string) => (b?.beschreibung || b?.empfaenger || fallback).slice(0, 200);

  switch (e.documentType) {
    case "lohnsteuerbescheinigung": {
      const l = e.lohnsteuerbescheinigung;
      if (!l) throw new Error("Keine Werte der Lohnsteuerbescheinigung vorhanden.");
      person.employments.push({
        id: doc.id,
        employer: l.arbeitgeber ?? "",
        bruttoarbeitslohn: n(l.bruttoarbeitslohn),
        lohnsteuer: n(l.lohnsteuer),
        soli: n(l.soli),
        kirchensteuer: n(l.kirchensteuer),
        kirchensteuerEhegatte: n(l.kirchensteuerEhegatte),
        lohnersatzleistungen: n(l.lohnersatzleistungen),
        steuerfreieFahrtkosten: n(l.steuerfreieFahrtkosten),
        rvArbeitgeber: n(l.rvArbeitgeber),
        rvArbeitnehmer: n(l.rvArbeitnehmer),
        zuschuesseKvPv: n(l.zuschuesseKvPv),
        kvArbeitnehmer: n(l.kvArbeitnehmer),
        pvArbeitnehmer: n(l.pvArbeitnehmer),
        alvArbeitnehmer: n(l.alvArbeitnehmer),
        pkvBasis: n(l.pkvBasis),
      });
      if (n(l.kirchensteuer) > 0) person.churchMember = true;
      return { case: next, amount: n(l.bruttoarbeitslohn) };
    }
    case "arbeitsmittel": {
      const amount = n(b?.betrag);
      person.workExpenses.push({ id: doc.id, documentId: doc.id, label: label("Arbeitsmittel"), amount });
      return { case: next, amount };
    }
    case "spendenbescheinigung": {
      const amount = n(b?.betrag);
      next.spenden.push({ id: doc.id, documentId: doc.id, label: label("Spende"), amount });
      return { case: next, amount };
    }
    case "handwerkerleistung": {
      const amount = n(b?.arbeitskosten);
      next.handwerkerleistungen.push({ id: doc.id, documentId: doc.id, label: label("Handwerkerleistung"), amount });
      return { case: next, amount };
    }
    case "haushaltsnahe_dienstleistung": {
      const amount = n(b?.arbeitskosten);
      next.haushaltsnaheDienstleistungen.push({ id: doc.id, documentId: doc.id, label: label("Haushaltsnahe Dienstleistung"), amount });
      return { case: next, amount };
    }
    case "krankheitskosten": {
      const amount = n(b?.betrag);
      next.krankheitskosten.push({ id: doc.id, documentId: doc.id, label: label("Krankheitskosten"), amount });
      return { case: next, amount };
    }
    case "kinderbetreuung": {
      const child = next.children.find((k) => k.id === doc.childId) ?? next.children[0];
      if (!child) throw new Error("Bitte lege zuerst unter „Über dich“ ein Kind an.");
      const amount = n(b?.betrag);
      child.betreuungskosten += amount;
      return { case: next, amount };
    }
    case "lohnersatzleistung": {
      const amount = n(b?.betrag);
      person.weitereLohnersatzleistungen += amount;
      return { case: next, amount };
    }
    default:
      throw new Error("Dieser Belegtyp kann nicht automatisch übernommen werden.");
  }
}

/** Entfernt alle Buchungen eines Belegs aus dem Steuerfall (mutiert `c`). */
export function unapplyDocument(c: TaxCase, doc: ApplyTarget & { appliedAmount?: number }, appliedAmount = doc.appliedAmount ?? 0): TaxCase {
  const drop = <T extends { id: string; documentId?: string }>(xs: T[]) => xs.filter((x) => x.id !== doc.id && x.documentId !== doc.id);
  for (const p of c.persons) {
    p.employments = drop(p.employments);
    p.workExpenses = drop(p.workExpenses);
  }
  c.spenden = drop(c.spenden);
  c.handwerkerleistungen = drop(c.handwerkerleistungen);
  c.haushaltsnaheDienstleistungen = drop(c.haushaltsnaheDienstleistungen);
  c.krankheitskosten = drop(c.krankheitskosten);
  if (appliedAmount > 0) {
    if (doc.extraction.documentType === "kinderbetreuung") {
      const child = c.children.find((k) => k.id === doc.childId) ?? c.children[0];
      if (child) child.betreuungskosten = Math.max(0, child.betreuungskosten - appliedAmount);
    }
    if (doc.extraction.documentType === "lohnersatzleistung") {
      const p = c.persons[Math.min(doc.personIndex, c.persons.length - 1)];
      if (p) p.weitereLohnersatzleistungen = Math.max(0, p.weitereLohnersatzleistungen - appliedAmount);
    }
  }
  return c;
}
