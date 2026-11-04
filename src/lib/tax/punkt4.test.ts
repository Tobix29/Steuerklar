import { describe, expect, it } from "vitest";
import { calculate, tarifsteuer } from "./calculate";
import { YEAR_PARAMS } from "./constants";
import { TaxCaseSchema } from "./types";

const lz = { id: "lz1", kz210: 50_000, kz220: 7143, kz225: 1226, kz230: 7744, kz245: 35_113, kz260: 5502 };
const base = (over: Record<string, unknown> = {}) => TaxCaseSchema.parse({ year: 2025, lohnzettel: [lz], ...over });
const P = YEAR_PARAMS[2025];

describe("Kapital: Verlustausgleichsoption", () => {
  it("verrechnet Verluste aus einem anderen Depot und erstattet KESt", () => {
    const r = calculate(base({ kapital: { ertraege275: 2000, ertraege25: 0, kestBezahlt: 550, verluste275: 1200 } }));
    expect(r.kapitalOption?.verlustausgleich).toBe(1200);
    expect(r.kapitalOption?.erstattung).toBeCloseTo(1200 * 0.275, 2);
    expect(r.formular.some((f) => f.label.includes("Verlustausgleich"))).toBe(true);
  });
  it("Sparbuchzinsen sind nicht ausgleichsfähig", () => {
    const r = calculate(base({ kapital: { ertraege275: 0, ertraege25: 1000, kestBezahlt: 250, verluste275: 800 } }));
    expect(r.kapitalOption?.verlustausgleich).toBe(0);
    expect(r.kapitalOption?.empfohlen).toBe(false);
  });
});

describe("Auslandseinkünfte", () => {
  it("Befreiungsmethode: Einkünfte steuerfrei, aber höherer Steuersatz", () => {
    const ohne = calculate(base());
    const r = calculate(base({ ausland: [{ id: "a", land: "Deutschland", betrag: 20_000, methode: "befreiung" }] }));
    const e = ohne.einkommen;
    const erwartet = (tarifsteuer(e + 20_000, P) * e) / (e + 20_000);
    expect(r.tarifsteuer).toBeCloseTo(erwartet, 0);
    expect(r.tarifsteuer).toBeGreaterThan(ohne.tarifsteuer);
    expect(r.einkommen).toBe(ohne.einkommen);
    expect(r.formular.some((f) => f.formular === "L1i" && f.kz === "453")).toBe(true);
    expect(r.pflichtveranlagung.some((t) => t.includes("Auslandseinkünfte"))).toBe(true);
  });
  it("Anrechnungsmethode: ausländische Steuer bis zum Höchstbetrag angerechnet", () => {
    const r = calculate(base({ ausland: [{ id: "a", land: "Italien", betrag: 5000, methode: "anrechnung", steuerAusland: 5000 }] }));
    const anr = r.absetzbetraege.find((x) => x.label === "Anrechnung ausländischer Steuer")!;
    expect(anr.amount).toBeLessThan(5000);
    expect(anr.amount).toBeCloseTo((r.tarifsteuer * 5000) / r.einkommen, 0);
  });
});

describe("ImmoESt", () => {
  const verkauf = (over: Record<string, unknown>) => ({ id: "v", erloes: 400_000, anschaffungskosten: 250_000, ...over });
  it("Neuvermögen: 30 % vom Gewinn, vom Notar abgeführt → keine Nachzahlung", () => {
    const ohne = calculate(base());
    const r = calculate(base({ immobilienverkaeufe: [verkauf({ abgefuehrt: 45_000 })] }));
    expect(r.immoESt?.steuer).toBe(45_000);
    expect(r.erstattung).toBeCloseTo(ohne.erstattung, 2);
  });
  it("Altvermögen pauschal 4,2 % des Erlöses", () => {
    const r = calculate(base({ immobilienverkaeufe: [verkauf({ altvermoegen: true })] }));
    expect(r.immoESt?.steuer).toBeCloseTo(16_800, 2);
  });
  it("Hauptwohnsitzbefreiung", () => {
    expect(calculate(base({ immobilienverkaeufe: [verkauf({ hauptwohnsitz: true })] })).immoESt?.steuer).toBe(0);
  });
  it("bei niedrigem Einkommen ist die Regelbesteuerung günstiger", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2025, immobilienverkaeufe: [{ id: "v", erloes: 60_000, anschaffungskosten: 50_000, abgefuehrt: 3000 }] }));
    expect(r.immoESt?.regelGuenstiger).toBe(true);
    expect(r.erstattung).toBeGreaterThan(0);
  });
});

describe("Umsatzsteuer", () => {
  it("Kleinunternehmer bis 55.000 € brutto (2025)", () => {
    const r = calculate(base({ betriebe: [{ id: "b", einnahmen: 40_000 }] }));
    expect(r.umsatzsteuer?.kleinunternehmer).toBe(true);
    expect(r.umsatzsteuer?.zahllast).toBe(0);
  });
  it("Zahllast über der Grenze: 20 % minus Vorsteuer", () => {
    const r = calculate(base({ betriebe: [{ id: "b", einnahmen: 60_000, vorsteuer: 2000 }] }));
    expect(r.umsatzsteuer?.kleinunternehmer).toBe(false);
    expect(r.umsatzsteuer?.zahllast).toBe(10_000);
    expect(r.formular.some((f) => f.formular === "U1")).toBe(true);
  });
  it("2024: Netto-Grenze 35.000 €, Wohnungsvermietung 10 %", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2024, lohnzettel: [lz], mietobjekte: [{ id: "o", einnahmen: 36_000, anschaffungskosten: 0 }] }));
    expect(r.umsatzsteuer?.kleinunternehmer).toBe(false);
    expect(r.umsatzsteuer?.zahllast).toBe(3600);
  });
  it("Verzicht auf die Kleinunternehmerbefreiung", () => {
    const r = calculate(base({ betriebe: [{ id: "b", einnahmen: 20_000, vorsteuer: 5000 }], ustVerzicht: true }));
    expect(r.umsatzsteuer?.zahllast).toBe(-1000);
  });
});
