import { describe, expect, it } from "vitest";
import { calculate, pendlerpauschale, tarifsteuer } from "./calculate";
import { fristen, YEAR_PARAMS } from "./constants";
import { TaxCaseSchema } from "./types";

const lz = { id: "lz1", kz210: 50_000, kz220: 7143, kz225: 1226, kz230: 7744, kz245: 35_113, kz260: 5502 };

describe("Vorjahre 2021–2023", () => {
  it("Tarif 2021: 35 % in der dritten Stufe", () => {
    const p = YEAR_PARAMS[2021];
    expect(tarifsteuer(31_000, p)).toBeCloseTo(7000 * 0.2 + 13000 * 0.35, 2);
  });
  it("Tarif 2022: Mischsatz 32,5 %", () => {
    expect(tarifsteuer(31_000, YEAR_PARAMS[2022])).toBeCloseTo(7000 * 0.2 + 13000 * 0.325, 2);
  });
  it("Tarif 2023: 41 % in der vierten Stufe", () => {
    const p = YEAR_PARAMS[2023];
    const diff = tarifsteuer(50_000, p) - tarifsteuer(49_000, p);
    expect(diff).toBeCloseTo(410, 2);
  });
  it("Pendlerpauschale 2022 und 2023 befristet erhöht", () => {
    expect(pendlerpauschale(25, true, 20, YEAR_PARAMS[2021])).toBe(696);
    expect(pendlerpauschale(25, true, 20, YEAR_PARAMS[2022])).toBeCloseTo(928, 2); // 696 × (4/12 + 8/12 × 1,5)
    expect(pendlerpauschale(25, true, 20, YEAR_PARAMS[2023])).toBeCloseTo(870, 2); // 696 × 1,25
  });
  it("Kirchenbeitrag bis 2023 max. 400 €", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2023, lohnzettel: [lz], kirchenbeitrag: 600 }));
    expect(r.sonderausgaben[0]!.amount).toBe(400);
  });
  it("Familienbonus 2021: 1.500,12 €", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2021, lohnzettel: [lz], children: [{ id: "k", birthYear: 2015 }] }));
    expect(r.absetzbetraege.find((a) => a.label === "Familienbonus Plus")?.amount).toBeCloseTo(1500.12, 2);
  });
});

describe("Fristen", () => {
  it("2021 kann bis 31.12.2026 beantragt werden", () => {
    const f = fristen(2021, new Date("2026-11-04"));
    expect(f.expired).toBe(false);
    expect(f.urgent).toBe(true);
    expect(f.daysLeft).toBe(58);
  });
  it("2020 ist abgelaufen", () => expect(fristen(2020, new Date("2026-11-04")).expired).toBe(true));
});

describe("Pensionen", () => {
  const pension = { id: "p1", art: "pension", arbeitgeber: "PVA", kz210: 20_000, kz230: 1020, kz245: 18_980, kz260: 1500 };
  it("kein Verkehrsabsetzbetrag und keine Werbungskostenpauschale, dafür Pensionistenabsetzbetrag", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [pension] }));
    expect(r.absetzbetraege.some((a) => a.label === "Verkehrsabsetzbetrag")).toBe(false);
    expect(r.werbungskostenSumme).toBe(0);
    expect(r.absetzbetraege.find((a) => a.label === "Pensionistenabsetzbetrag")?.amount).toBe(1002);
  });
  it("Pensionistenabsetzbetrag wird eingeschliffen", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [{ ...pension, kz245: 26_101 }] }));
    const pab = r.absetzbetraege.find((a) => a.label === "Pensionistenabsetzbetrag")!.amount;
    expect(pab).toBeCloseTo((1002 * (30957 - 26101)) / (30957 - 21245), 1);
  });
  it("erhöhter Pensionistenabsetzbetrag bei geringen Partnereinkünften", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [pension], pensionErhoeht: true, partnerEinkuenfte: 1000 }));
    expect(r.absetzbetraege.find((a) => a.label === "Erhöhter Pensionistenabsetzbetrag")?.amount).toBe(1476);
  });
});

describe("Unterhaltsabsetzbetrag", () => {
  it("2025: 37 € / 55 € pro Monat", () => {
    const r = calculate(
      TaxCaseSchema.parse({ year: 2025, lohnzettel: [lz], unterhaltKinder: [{ id: "a", months: 12 }, { id: "b", months: 6 }] }),
    );
    expect(r.absetzbetraege.find((a) => a.label === "Unterhaltsabsetzbetrag")?.amount).toBe(37 * 12 + 55 * 6);
    expect(r.erstattung).toBeCloseTo(37 * 12 + 55 * 6, 0);
  });
});

describe("Kapitalerträge – Regelbesteuerungsoption", () => {
  it("lohnt sich bei niedrigem Einkommen", () => {
    const r = calculate(
      TaxCaseSchema.parse({
        year: 2025,
        lohnzettel: [{ id: "a", kz210: 14_000, kz230: 2500, kz245: 11_500, kz260: 0 }],
        kapital: { ertraege275: 1000, ertraege25: 0, kestBezahlt: 275 },
      }),
    );
    expect(r.kapitalOption?.empfohlen).toBe(true);
    expect(r.kapitalOption!.erstattung).toBeCloseTo(275, 0);
  });
  it("lohnt sich nicht bei hohem Einkommen", () => {
    const r = calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [lz], kapital: { ertraege275: 1000, ertraege25: 0, kestBezahlt: 275 } }));
    expect(r.kapitalOption?.empfohlen).toBe(false);
    expect(r.erstattung).toBeCloseTo(calculate(TaxCaseSchema.parse({ year: 2025, lohnzettel: [lz] })).erstattung, 2);
  });
});
