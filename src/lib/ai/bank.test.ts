import { describe, expect, it } from "vitest";
import { applyFindings, prepareCsv, type BankFinding } from "./bank";
import { emptyCase } from "@/lib/tax/types";

const f = (over: Partial<BankFinding>): BankFinding => ({
  datum: "2025-03-01", empfaenger: "Händler", verwendungszweck: "", betrag: 100, kategorie: "fachliteratur",
  beruflicherAnteil: null, begruendung: "", sicherheit: "hoch", ...over,
});

describe("Kontoauszug-Import", () => {
  it("ordnet Treffer den richtigen Feldern zu", () => {
    const c = emptyCase(2025);
    let i = 0;
    const n = applyFindings(c, [
      f({ kategorie: "digitale_arbeitsmittel", betrag: 1000, beruflicherAnteil: 0.6 }),
      f({ kategorie: "spende", betrag: 50 }),
      f({ kategorie: "kirchenbeitrag", betrag: 120 }),
      f({ kategorie: "krankheitskosten", betrag: 300 }),
      f({ kategorie: "gewerkschaft", betrag: 200 }),
      f({ betrag: -40 }),
    ], () => `id${i++}`);
    expect(n).toBe(6);
    expect(c.werbungskosten.find((w) => w.category === "digitale_arbeitsmittel")?.amount).toBe(600);
    expect(c.werbungskosten.find((w) => w.category === "gewerkschaft")?.amount).toBe(200);
    expect(c.spenden[0]!.amount).toBe(50);
    expect(c.kirchenbeitrag).toBe(120);
    expect(c.krankheitskosten[0]!.amount).toBe(300);
    expect(c.werbungskosten.find((w) => w.category === "fachliteratur")?.amount).toBe(40);
  });
  it("bereinigt den CSV-Text", () => {
    expect(prepareCsv("a;b\r\n\r\n  c;d  \n")).toBe("a;b\nc;d");
  });
});
