import { describe, expect, it } from "vitest";
import { calculate, tarifsteuer } from "./calculate";
import { YEAR_PARAMS } from "./constants";
import { betrieb, gebaeudeAfa, vermietung, veranlagungsfreibetrag } from "./einkuenfte";
import { BetriebSchema, MietobjektSchema, TaxCaseSchema } from "./types";

const lz = { id: "lz1", kz210: 50_000, kz220: 7143, kz225: 1226, kz230: 7744, kz245: 35_113, kz260: 5502 };
const obj = (over: Record<string, unknown> = {}) =>
  MietobjektSchema.parse({ id: "o", bezeichnung: "Wohnung Graz", einnahmen: 9600, anschaffungskosten: 250_000, grundanteil: 20, anschaffungsjahr: 2015, ...over });

describe("Vermietung (E1b)", () => {
  it("normale AfA 1,5 % vom Gebäudeanteil", () => {
    expect(gebaeudeAfa(obj(), 2025).afa).toBe(3000); // 200.000 × 1,5 %
  });
  it("beschleunigte AfA nach dem 30.6.2020: 4,5 % / 3 % / 1,5 %", () => {
    const o = obj({ anschaffungsjahr: 2024, anschaffungsmonat: 3 });
    expect(gebaeudeAfa(o, 2024).afa).toBe(9000);
    expect(gebaeudeAfa(o, 2025).afa).toBe(6000);
    expect(gebaeudeAfa(o, 2026).afa).toBe(3000);
  });
  it("Neubau 2024–2026: dreifache AfA drei Jahre lang", () => {
    const o = obj({ anschaffungsjahr: 2024, neubau2024bis2026: true });
    expect(gebaeudeAfa(o, 2026).afa).toBe(9000);
  });
  it("Halbjahres-AfA bei Anschaffung im 2. Halbjahr (vor Juli 2020)", () => {
    expect(gebaeudeAfa(obj({ anschaffungsjahr: 2019, anschaffungsmonat: 9 }), 2019).afa).toBe(1500);
  });
  it("Instandsetzung wird auf 15 Jahre verteilt", () => {
    const r = vermietung(obj({ instandsetzungen: [{ id: "i", jahr: 2024, betrag: 15_000 }] }), 2025);
    expect(r.lines.find((l) => l.label.includes("Instandsetzung"))?.amount).toBe(-1000);
    expect(r.ergebnis).toBe(9600 - 3000 - 1000);
  });
  it("Überschuss erhöht die Steuer, Verlust senkt sie", () => {
    const ohne = calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [lz] }));
    const plus = calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [lz], mietobjekte: [obj()] }));
    const minus = calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [lz], mietobjekte: [obj({ einnahmen: 1000, zinsen: 4000 })] }));
    const mehr = tarifsteuer(ohne.einkommen + 6600, YEAR_PARAMS[2025]) - tarifsteuer(ohne.einkommen, YEAR_PARAMS[2025]);
    expect(plus.erstattung).toBeCloseTo(ohne.erstattung - mehr, 0);
    expect(minus.erstattung).toBeGreaterThan(ohne.erstattung);
    expect(plus.e1Erforderlich).toBe(true);
    expect(plus.pflichtveranlagung.some((t) => t.includes("730"))).toBe(true);
  });
});

describe("Veranlagungsfreibetrag", () => {
  it("bis 730 € steuerfrei, eingeschliffen bis 1.460 €", () => {
    expect(veranlagungsfreibetrag(500, 730)).toBe(500);
    expect(veranlagungsfreibetrag(1000, 730)).toBe(460);
    expect(veranlagungsfreibetrag(1500, 730)).toBe(0);
  });
  it("kleine Vermietung neben dem Gehalt bleibt steuerfrei", () => {
    const ohne = calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [lz] }));
    const klein = calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [lz], mietobjekte: [obj({ einnahmen: 3600 })] }));
    expect(klein.erstattung).toBeCloseTo(ohne.erstattung, 2);
  });
});

describe("Selbständige & Gewerbe (E1a)", () => {
  const p = YEAR_PARAMS[2025];
  it("Einnahmen-Ausgaben-Rechnung mit SVS und Gewinnfreibetrag", () => {
    const r = betrieb(BetriebSchema.parse({ id: "b", einnahmen: 40_000, ausgaben: 8000, sozialversicherung: 6000 }), p);
    expect(r.gewinn).toBeCloseTo(26_000 - 26_000 * 0.15, 2);
  });
  it("Gewinnfreibetrag max. 15 % von 33.000 €", () => {
    const r = betrieb(BetriebSchema.parse({ id: "b", einnahmen: 100_000 }), p);
    expect(r.gewinn).toBeCloseTo(100_000 - 4950, 2);
  });
  it("Basispauschalierung 2025: 13,5 %", () => {
    const r = betrieb(BetriebSchema.parse({ id: "b", einnahmen: 50_000, gewinnermittlung: "basis" }), p);
    expect(r.lines.find((l) => l.label.includes("Basispauschalierung"))?.amount).toBe(-6750);
  });
  it("Kleinunternehmerpauschalierung 45 % bzw. 20 %", () => {
    expect(betrieb(BetriebSchema.parse({ id: "b", einnahmen: 30_000, gewinnermittlung: "klein" }), p).lines[1]!.amount).toBe(-13_500);
    expect(betrieb(BetriebSchema.parse({ id: "b", einnahmen: 30_000, gewinnermittlung: "klein", dienstleistung: true }), p).lines[1]!.amount).toBe(-6000);
  });
  it("nur selbständig: kein Verkehrsabsetzbetrag, Steuer nach Tarif", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2025, betriebe: [{ id: "b", einnahmen: 40_000, ausgaben: 10_000 }] }));
    expect(r.absetzbetraege.some((a) => a.label === "Verkehrsabsetzbetrag")).toBe(false);
    expect(r.einkommen).toBeCloseTo(30_000 * 0.85, 2);
    expect(r.erstattung).toBeLessThan(0);
  });
});

describe("Teuerungsabsetzbetrag 2022", () => {
  it("bis 500 € bei niedrigem Einkommen, mit erhöhter SV-Rückerstattung", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2022, lohnzettel: [{ id: "a", kz210: 18_000, kz230: 3200, kz245: 14_800, kz260: 250 }] }));
    expect(r.absetzbetraege.find((a) => a.label === "Teuerungsabsetzbetrag 2022")?.amount).toBe(500);
    expect(r.erstattung).toBeGreaterThan(250);
  });
  it("eingeschliffen ab 18.200 € Einkommen", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2022, lohnzettel: [{ id: "a", kz210: 28_000, kz230: 5000, kz245: 21_482, kz260: 1500 }] }));
    const t = r.absetzbetraege.find((a) => a.label === "Teuerungsabsetzbetrag 2022")!.amount;
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(500);
  });
});
