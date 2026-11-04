import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import { anlageAfa, betrieb } from "./einkuenfte";
import { YEAR_PARAMS } from "./constants";
import { planung, svsSchaetzung, termine } from "./planer";
import { BetriebSchema, TaxCaseSchema } from "./types";

const anlage = (over: Record<string, unknown>) => BetriebSchema.shape.anlagen.unwrap().element.parse({ id: "a", anschaffungsjahr: 2024, kosten: 3000, nutzungsdauer: 3, ...over });

describe("Anlagenverzeichnis", () => {
  it("lineare AfA mit Halbjahresregel", () => {
    const a = anlage({ anschaffungsmonat: 9 });
    expect(anlageAfa(a, 2024).afa).toBe(500);
    expect(anlageAfa(a, 2025).afa).toBe(1000);
    expect(anlageAfa(a, 2027).afa).toBe(500);
    expect(anlageAfa(a, 2028).afa).toBe(0);
  });
  it("GWG bis 1.000 € (ab 2023) sofort, 2022 nur bis 800 €", () => {
    expect(anlageAfa(anlage({ kosten: 950 }), 2024)).toMatchObject({ afa: 950, gwg: true });
    expect(anlageAfa(anlage({ kosten: 950, anschaffungsjahr: 2022 }), 2022).gwg).toBe(false);
  });
  it("Pkw: Luxustangente 40.000 € und mind. 8 Jahre", () => {
    expect(anlageAfa(anlage({ kosten: 60_000, nutzungsdauer: 5, pkw: true }), 2025).afa).toBe(5000);
  });
  it("fließt mit Privatanteil in die Einnahmen-Ausgaben-Rechnung", () => {
    const b = BetriebSchema.parse({ id: "b", einnahmen: 30_000, anlagen: [{ id: "a", anschaffungsjahr: 2025, kosten: 3000, nutzungsdauer: 3, privatanteil: 40 }] });
    const r = betrieb(b, YEAR_PARAMS[2025]);
    expect(r.lines.find((l) => l.label.includes("Anlagenverzeichnis"))?.amount).toBe(-600);
  });
});

describe("Rücklagen-Planer", () => {
  it("SVS-Schätzung mit Mindest- und Höchstbeitragsgrundlage", () => {
    const s = svsSchaetzung(30_000);
    expect(s.summe).toBeCloseTo(30_000 * (0.185 + 0.068 + 0.0153) + 12.95 * 12, 1);
    expect(svsSchaetzung(1000).mindest).toBe(true);
    expect(svsSchaetzung(200_000).beitragsgrundlage).toBe(8085 * 12);
  });
  it("Vorauszahlung = Mehrsteuer aus Nebeneinkünften / 4", () => {
    const c = TaxCaseSchema.parse({ year: 2025, lohnzettel: [{ id: "l", kz210: 50_000, kz220: 7143, kz225: 1226, kz230: 7744, kz245: 35_113, kz260: 5502 }], betriebe: [{ id: "b", einnahmen: 20_000, ausgaben: 5000 }] });
    const r = calculate(c);
    const p = planung(c, r);
    expect(p.estAufNebeneinkuenfte).toBeGreaterThan(4000);
    expect(p.vorauszahlungQuartal).toBeCloseTo(p.estAufNebeneinkuenfte / 4, 1);
    expect(p.svs?.summe).toBeGreaterThan(3000);
  });
  it("UVA vierteljährlich unter 100.000 € und Termine sortiert", () => {
    const c = TaxCaseSchema.parse({ year: 2025, betriebe: [{ id: "b", einnahmen: 60_000, ausgaben: 10_000 }] });
    const r = calculate(c);
    const p = planung(c, r);
    expect(p.uva?.zeitraum).toBe("vierteljährlich");
    expect(p.uva?.zahllastJeZeitraum).toBe(3000);
    const t = termine(c, r, new Date("2026-11-04T00:00:00Z"));
    expect(t.length).toBeGreaterThan(5);
    expect([...t].sort((a, b) => a.datum.localeCompare(b.datum))).toEqual(t);
    expect(t.some((x) => x.art === "uva" && x.datum === "2026-11-15")).toBe(true);
    expect(t.some((x) => x.art === "svs")).toBe(true);
  });
});
