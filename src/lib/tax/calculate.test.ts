import { describe, expect, it } from "vitest";
import { calculate, entfernungspauschale, grundtarif, solidaritaetszuschlag, tarif, zumutbareBelastung } from "./calculate";
import { SUPPORTED_YEARS, YEAR_PARAMS } from "./constants";
import { TaxCaseSchema } from "./types";

describe("Grundtarif §32a", () => {
  it.each(SUPPORTED_YEARS)("ist 0 bis zum Grundfreibetrag (%i)", (year) => {
    const p = YEAR_PARAMS[year];
    expect(grundtarif(p.tariff.gfb, p)).toBe(0);
    expect(grundtarif(p.tariff.gfb + 1, p)).toBe(0);
    expect(grundtarif(p.tariff.gfb + 100, p)).toBeGreaterThan(0);
  });

  it.each(SUPPORTED_YEARS)("ist an allen Zonengrenzen stetig (%i)", (year) => {
    const p = YEAR_PARAMS[year];
    for (const b of [p.tariff.z2End, p.tariff.z3End, p.tariff.z4End]) {
      const diff = grundtarif(b + 1, p) - grundtarif(b, p);
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(2); // max. Grenzsteuersatz 45 % + Rundung
    }
  });

  it("Eingangssteuersatz 14 %, Spitzensteuersatz 42 % / 45 %", () => {
    const p = YEAR_PARAMS[2025];
    const g = (x: number) => (grundtarif(x + 1000, p) - grundtarif(x, p)) / 1000;
    expect(g(p.tariff.gfb)).toBeCloseTo(0.14, 1);
    expect(g(100_000)).toBeCloseTo(0.42, 2);
    expect(g(300_000)).toBeCloseTo(0.45, 2);
  });

  it("berechnet Referenzwerte 2025", () => {
    const p = YEAR_PARAMS[2025];
    expect(grundtarif(40_000, p)).toBe(7320);
    expect(grundtarif(100_000, p)).toBe(Math.floor(0.42 * 100_000 - 10911.92));
  });

  it("Splitting = 2 × Grundtarif(zvE/2)", () => {
    const p = YEAR_PARAMS[2025];
    expect(tarif(80_000, true, p)).toBe(2 * grundtarif(40_000, p));
  });
});

describe("Solidaritätszuschlag", () => {
  const p = YEAR_PARAMS[2025];
  it("Freigrenze", () => expect(solidaritaetszuschlag(19_950, false, p)).toBe(0));
  it("Milderungszone", () => expect(solidaritaetszuschlag(25_000, false, p)).toBeCloseTo(600.95, 2));
  it("voller Satz", () => expect(solidaritaetszuschlag(60_000, false, p)).toBeCloseTo(3300, 2));
  it("doppelte Freigrenze bei Zusammenveranlagung", () => expect(solidaritaetszuschlag(39_900, true, p)).toBe(0));
});

describe("Werbungskosten & Belastungen", () => {
  it("Entfernungspauschale 2025: 30 km an 200 Tagen", () => {
    // 20 × 0,30 + 10 × 0,38 = 9,80 € je Tag
    expect(entfernungspauschale(30, 200, YEAR_PARAMS[2025])).toBe(1960);
  });
  it("Entfernungspauschale 2026: 0,38 € ab km 1", () => {
    expect(entfernungspauschale(30, 200, YEAR_PARAMS[2026])).toBeCloseTo(2280, 2);
  });
  it("zumutbare Belastung stufenweise", () => {
    // ledig, keine Kinder, GdE 40.000: 15.340×5 % + 24.660×6 % = 767 + 1.479,60
    expect(zumutbareBelastung(40_000, false, 0)).toBeCloseTo(2246.6, 2);
  });
});

const base = (over: Record<string, unknown> = {}) =>
  TaxCaseSchema.parse({
    year: 2025,
    bundesland: "NW",
    persons: [
      {
        firstName: "Alex",
        churchMember: true,
        commuteKm: 25,
        commuteDays: 180,
        homeofficeDays: 40,
        workExpenses: [{ id: "w1", label: "Laptop (anteilig)", amount: 600 }],
        employments: [
          {
            id: "e1",
            employer: "Muster GmbH",
            bruttoarbeitslohn: 52_000,
            lohnsteuer: 8_900,
            soli: 0,
            kirchensteuer: 801,
            rvArbeitgeber: 4_836,
            rvArbeitnehmer: 4_836,
            kvArbeitnehmer: 4_290,
            pvArbeitnehmer: 936,
            alvArbeitnehmer: 676,
          },
        ],
      },
    ],
    ...over,
  });

describe("calculate() – Gesamtberechnung", () => {
  it("typische Arbeitnehmerin, ledig", () => {
    const r = calculate(base());
    const pr = r.persons[0]!;
    // 180 × (20×0,30 + 5×0,38) = 1.422 + HO 240 + 16 + 600 = 2.278
    expect(pr.werbungskostenTatsaechlich).toBeCloseTo(2278, 2);
    expect(pr.einkuenfte).toBeCloseTo(52_000 - 2278, 2);
    expect(r.zuVersteuerndesEinkommen).toBeGreaterThan(35_000);
    expect(r.festzusetzen.soli).toBe(0);
    expect(r.festzusetzen.kirchensteuer).toBe(Math.floor(r.festzusetzen.einkommensteuer * 9) / 100);
    expect(r.erstattung).toBeCloseTo(r.bereitsGezahlt.summe - r.festzusetzen.summe, 2);
  });

  it("Arbeitnehmer-Pauschbetrag greift bei geringen Werbungskosten", () => {
    const c = base();
    c.persons[0]!.commuteDays = 0;
    c.persons[0]!.homeofficeDays = 0;
    c.persons[0]!.workExpenses = [];
    const r = calculate(c);
    expect(r.persons[0]!.werbungskostenAngesetzt).toBe(1230);
  });

  it("Zusammenveranlagung ist nicht teurer als zwei Einzelveranlagungen", () => {
    const single = calculate(base());
    const c = base({ filing: "joint" });
    c.persons.push(TaxCaseSchema.shape.persons.element.parse({}));
    const joint = calculate(c);
    expect(joint.festzusetzen.einkommensteuer).toBeLessThan(single.festzusetzen.einkommensteuer);
  });

  it("Kinder: Kindergeld i. d. R. günstiger bei mittlerem Einkommen", () => {
    const r = calculate(base({ children: [{ id: "k1", birthYear: 2020, months: 12, share: 0.5 }] }));
    expect(r.kinderfreibetraegeAngesetzt).toBe(false);
    // Kirchensteuer-Bemessung trotzdem mit Freibeträgen → niedriger als ohne Kind
    const ohne = calculate(base());
    expect(r.festzusetzen.kirchensteuer).toBeLessThan(ohne.festzusetzen.kirchensteuer);
  });

  it("§35a: Handwerkerleistungen mindern die Steuer um 20 % der Arbeitskosten", () => {
    const ohne = calculate(base());
    const mit = calculate(base({ handwerkerleistungen: [{ id: "h1", label: "Maler", amount: 1000 }] }));
    expect(ohne.festzusetzen.einkommensteuer - mit.festzusetzen.einkommensteuer).toBe(200);
  });

  it("Progressionsvorbehalt erhöht den Steuersatz", () => {
    const c = base();
    c.persons[0]!.weitereLohnersatzleistungen = 8000;
    const r = calculate(c);
    expect(r.steuersatzProgression).not.toBeNull();
    expect(r.festzusetzen.einkommensteuer).toBeGreaterThan(calculate(base()).festzusetzen.einkommensteuer);
    expect(r.pflichtveranlagung.length).toBeGreaterThan(0);
  });

  it("weist ungültige Eingaben zurück", () => {
    expect(() => TaxCaseSchema.parse({ year: 2019, persons: [{}] })).toThrow();
    expect(() => base({ bundesland: "XX" })).toThrow();
  });
});
