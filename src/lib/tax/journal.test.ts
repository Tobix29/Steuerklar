import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import { journalCsv, journalSummen, mitJournal } from "./journal";
import { TaxCaseSchema, type Betrieb } from "./types";

type B = Betrieb["buchungen"][number];
const b = (x: Partial<B> & Pick<B, "kategorie" | "netto">): B => ({ id: Math.random().toString(36), datum: "2025-03-10", beschreibung: "", ust: 0, privatanteil: 0, ...x });

describe("Einnahmen-Ausgaben-Journal", () => {
  const buchungen = [
    b({ kategorie: "erloese", netto: 50_000, ust: 10_000 }),
    b({ kategorie: "buero", netto: 1_000, ust: 200 }),
    b({ kategorie: "kfz", netto: 2_000, ust: 400, privatanteil: 25 }),
    b({ kategorie: "bewirtung", netto: 400, ust: 40 }),
    b({ kategorie: "svs", netto: 6_000 }),
    b({ kategorie: "erloese", netto: 999, datum: "2024-12-30" }),
  ];
  it("summiert mit Privatanteil, 50 % Bewirtung und Zufluss-Abfluss", () => {
    const s = journalSummen(buchungen, 2025);
    expect(s.einnahmen).toBe(50_000);
    expect(s.ausgaben).toBe(1_000 + 1_500 + 200);
    expect(s.vorsteuer).toBe(200 + 300 + 40);
    expect(s.svs).toBe(6_000);
    expect(s.ausserhalb).toBe(1);
    expect(s.kategorien.find((k) => k.key === "erloese")?.kz).toBe("9040");
  });
  it("Kleinunternehmer: Vorsteuer wird Teil der Ausgabe", () => {
    const s = journalSummen([b({ kategorie: "buero", netto: 1_000, ust: 200 })], 2025, false);
    expect(s.ausgaben).toBe(1_200);
    expect(s.vorsteuer).toBe(0);
  });
  it("ersetzt die Betriebssummen in der Berechnung", () => {
    const c = TaxCaseSchema.parse({ year: 2025, betriebe: [{ id: "x", einnahmen: 1, ausgaben: 1, buchungen }] });
    const m = mitJournal(c).betriebe[0]!;
    expect(m.einnahmen).toBe(50_000);
    expect(m.sozialversicherung).toBe(6_000);
    const r = calculate(c);
    expect(r.umsatzsteuer?.kleinunternehmer).toBe(false);
    expect(r.umsatzsteuer?.zahllast).toBeCloseTo(10_000 - 540, 2);
  });
  it("CSV ist sortiert und gegen Formel-Injection geschützt", () => {
    const csv = journalCsv([b({ kategorie: "erloese", netto: 10, datum: "2025-05-01", beschreibung: "=HYPERLINK()" }), b({ kategorie: "buero", netto: 5, datum: "2025-01-01" })]);
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toContain("2025-01-01");
    expect(lines[2]).toContain(`"'=HYPERLINK()"`);
  });
});
