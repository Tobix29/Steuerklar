import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import { faelligAm, ibanGueltig, naechsteNummer, offenePosten, pflichtangaben, rechnungSummen, steuerHinweis, type Rechnung } from "./rechnung";
import { BetriebSchema, TaxCaseSchema } from "./types";

const firma = { name: "Anna Muster", adresse: "Hauptplatz 1, 4020 Linz", uid: "ATU12345678", iban: "AT61 1904 3002 3457 3201", bic: "", email: "", kleinunternehmer: false };
const re = (x: Partial<Rechnung> = {}): Rechnung => ({
  id: "r1", nummer: "2025-001", datum: "2025-03-01", leistungVon: "2025-02-01", leistungBis: "2025-02-28",
  kunde: { name: "Muster GmbH", adresse: "Ring 2, 1010 Wien", uid: "" },
  positionen: [{ text: "Webdesign", menge: 10, einheit: "Std.", preis: 80, ustSatz: 20 }, { text: "Fachbuch", menge: 1, einheit: "Stk.", preis: 50, ustSatz: 10 }],
  zahlungszielTage: 14, reverseCharge: false, notiz: "", ausgestelltAm: "2025-03-01", bezahltAm: "", storniert: false, mahnungen: [], ...x,
});

describe("Ausgangsrechnungen", () => {
  it("summiert je Steuersatz", () => {
    const s = rechnungSummen(re(), firma);
    expect(s.netto).toBe(850);
    expect(s.ust).toBe(165);
    expect(s.saetze.map((x) => x.satz)).toEqual([20, 10]);
  });
  it("Kleinunternehmer und Reverse Charge ohne USt mit Pflichthinweis", () => {
    expect(rechnungSummen(re(), { ...firma, kleinunternehmer: true }).ust).toBe(0);
    expect(steuerHinweis(re(), { ...firma, kleinunternehmer: true })).toContain("§ 6 Abs. 1 Z 27 UStG");
    expect(steuerHinweis(re({ reverseCharge: true }), firma)).toContain("Reverse Charge");
    expect(pflichtangaben(re({ reverseCharge: true }), firma).fehler).toContain("UID des Empfängers (Reverse Charge)");
  });
  it("prüft Pflichtangaben und Kleinbetragsrechnung", () => {
    expect(pflichtangaben(re(), firma).fehler).toEqual([]);
    expect(pflichtangaben(re(), { ...firma, uid: "" }).fehler).toContain("Deine UID-Nummer (über 400 € brutto)");
    const klein = re({ kunde: { name: "", adresse: "", uid: "" }, positionen: [{ text: "Beratung", menge: 1, einheit: "Std.", preis: 100, ustSatz: 20 }] });
    expect(pflichtangaben(klein, { ...firma, uid: "" }).fehler).toEqual([]);
  });
  it("IBAN, Nummernkreis, Fälligkeit", () => {
    expect(ibanGueltig("AT61 1904 3002 3457 3201")).toBe(true);
    expect(ibanGueltig("AT61 1904 3002 3457 3202")).toBe(false);
    expect(naechsteNummer([re(), re({ nummer: "2025-007" }), re({ nummer: "2024-099" })], 2025)).toBe("2025-008");
    expect(faelligAm(re())).toBe("2025-03-15");
  });
  it("bezahlte Rechnung wird automatisch als Erlös gebucht, offene als offener Posten geführt", () => {
    const b = BetriebSchema.parse({ id: "b", firma, rechnungen: [re({ bezahltAm: "2025-03-10" }), re({ id: "r2", nummer: "2025-002" }), re({ id: "r3", nummer: "2025-003", bezahltAm: "2025-04-01", storniert: true })] });
    const r = calculate(TaxCaseSchema.parse({ year: 2025, betriebe: [b] }));
    expect(r.umsatzsteuer?.umsatz).toBeGreaterThan(0);
    const op = offenePosten(b, new Date("2025-04-01"));
    expect(op).toHaveLength(1);
    expect(op[0]!.ueberfaellig).toBe(true);
    expect(op[0]!.brutto).toBe(1015);
  });
  it("Entwürfe zählen weder als Erlös noch als offener Posten", () => {
    const b = BetriebSchema.parse({ id: "b", firma, rechnungen: [re({ ausgestelltAm: "", bezahltAm: "2025-03-10" })] });
    expect(offenePosten(b)).toHaveLength(0);
    expect(calculate(TaxCaseSchema.parse({ year: 2025, betriebe: [b] })).umsatzsteuer).toBeNull();
  });
});
