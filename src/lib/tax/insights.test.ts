import { describe, expect, it } from "vitest";
import { insights } from "./insights";
import { TaxCaseSchema } from "./types";

const base = (over: Record<string, unknown> = {}) =>
  TaxCaseSchema.parse({
    year: 2025,
    lohnzettel: [{ id: "lz1", kz210: 50_000, kz220: 7143, kz225: 1226, kz230: 7744, kz245: 35_113, kz260: 5502 }],
    ...over,
  });

describe("Spar-Check", () => {
  it("beziffert die Wirkung jedes Abzugs", () => {
    const i = insights(base({ pendlerKm: 25, fahrtenProMonat: 18, children: [{ id: "k", birthYear: 2019 }] }));
    expect(i.contributions[0]!.key).toBe("kinder");
    expect(i.contributions[0]!.effect).toBeCloseTo(2000.16, 0);
    expect(i.contributions.find((c) => c.key === "pendler")!.effect).toBeCloseTo(696 * 0.3 + 50, 0);
  });

  it("warnt, wenn der Familienbonus verpufft", () => {
    const low = TaxCaseSchema.parse({
      year: 2025,
      lohnzettel: [{ id: "a", kz210: 22_000, kz230: 3900, kz245: 16_000, kz260: 300 }],
      children: [{ id: "k", birthYear: 2019 }],
    });
    const tip = insights(low).tips.find((t) => t.key === "familienbonus");
    expect(tip).toBeDefined();
    expect(tip!.effect).toBeGreaterThan(1000);
  });

  it("zeigt die Lücke bis zur Werbungskostenpauschale", () => {
    const i = insights(base({ werbungskosten: [{ id: "w", label: "Buch", amount: 40, category: "fachliteratur" }] }));
    expect(i.tips.some((t) => t.key === "pauschale")).toBe(true);
  });

  it("schlägt die nächste Aliquotierungsstufe vor", () => {
    const i = insights(base({ pendlerKm: 30, fahrtenProMonat: 10 }));
    expect(i.tips.find((t) => t.key === "pendler-fahrten")?.effect).toBeGreaterThan(50);
  });
});
