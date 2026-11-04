import { describe, expect, it } from "vitest";
import { antragText, antragVorschlag } from "./antraege";
import { calculate } from "./calculate";
import { TaxCaseSchema } from "./types";

const c = TaxCaseSchema.parse({ year: 2025, firstName: "Anna", betriebe: [{ id: "b", einnahmen: 40_000, ausgaben: 8_000 }] });
const r = calculate(c);

describe("Anträge", () => {
  it("Herabsetzung mit Prognose aus dem Planer", () => {
    const a = antragVorschlag("herabsetzung", c, r);
    expect(a.beantragt).toBeGreaterThan(0);
    const t = antragText({ ...a, betrag: 12_000 }, c);
    expect(t).toContain("§ 45 Abs. 4 EStG");
    expect(t).toContain("12.000,00 €");
    expect(t).toContain("Anna [Nachname]");
  });
  it("Ratenzahlung rechnet die Monatsrate", () => {
    const t = antragText({ art: "zahlungserleichterung", betrag: 1_000, beantragt: 0, raten: 3, datum: "", begruendung: "", iban: "" }, c);
    expect(t).toContain("3 Monatsraten zu je 333,34 €");
    expect(t).toContain("§ 212 BAO");
  });
  it("Rückzahlung mit IBAN, Platzhalter ohne Angaben", () => {
    expect(antragText({ art: "rueckzahlung", betrag: 0, beantragt: 0, raten: 0, datum: "", begruendung: "", iban: "at61 1904 3002 3457 3201" }, c)).toContain("IBAN: AT61 1904 3002 3457 3201");
    expect(antragText({ art: "beschwerdefrist", betrag: 0, beantragt: 0, raten: 0, datum: "", begruendung: "", iban: "" }, c)).toContain("[Datum]");
  });
});
