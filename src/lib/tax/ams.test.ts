import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import { TaxCaseSchema } from "./types";

const fall = (ams: { betrag: number; monate: number }) =>
  TaxCaseSchema.parse({ year: 2025, ams, lohnzettel: [{ id: "l", kz210: 22_000, kz230: 4_000, kz245: 18_000, kz260: 1_200 }] });

describe("AMS-Bezüge: Hochrechnung § 3 Abs 2 EStG", () => {
  it("ohne AMS keine Hochrechnung", () => {
    expect(calculate(fall({ betrag: 0, monate: 0 })).ams).toBeNull();
  });
  it("hochgerechnet, Kontrollrechnung greift bei niedrigen AMS-Bezügen", () => {
    const r = calculate(fall({ betrag: 6_000, monate: 6 }));
    expect(r.ams?.hochrechnung).toBe(18_000);
    expect(r.ams?.kontrollrechnung).toBe(true);
    // Kontrollrechnung = Steuer, als wären die AMS-Bezüge steuerpflichtig
    const ohne = calculate(fall({ betrag: 0, monate: 0 }));
    expect(r.tarifsteuer).toBeGreaterThan(ohne.tarifsteuer);
    expect(r.ams!.mehrsteuer).toBeGreaterThan(1_000);
    expect(r.hinweise.some((h) => h.includes("freiwillig"))).toBe(true);
  });
  it("Hochrechnung günstiger als Kontrollrechnung bei hohen AMS-Bezügen", () => {
    const r = calculate(fall({ betrag: 15_000, monate: 3 }));
    expect(r.ams?.hochrechnung).toBe(6_000);
    expect(r.ams?.kontrollrechnung).toBe(false);
    const eink = r.einkommen;
    expect(r.ams!.mehrsteuer).toBeGreaterThan(0);
    expect(eink).toBeLessThan(18_000);
  });
  it("ganzes Jahr AMS: keine Hochrechnung (nichts hochzurechnen)", () => {
    expect(calculate(fall({ betrag: 12_000, monate: 12 })).ams).toBeNull();
  });
});
