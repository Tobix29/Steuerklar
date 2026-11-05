import { describe, expect, it } from "vitest";
import { mahnSumme, mahnText, mahnungEntwurf, naechsteMahnung, verzugszinsen, type Rechnung } from "./rechnung";

const firma = { name: "Anna Muster", adresse: "Hauptplatz 1, 4020 Linz", uid: "", iban: "AT61 1904 3002 3457 3201", bic: "", email: "", kleinunternehmer: true };
const re = (x: Partial<Rechnung> = {}): Rechnung => ({
  id: "r1", nummer: "2025-001", datum: "2025-03-01", leistungVon: "2025-03-01", leistungBis: "",
  kunde: { name: "Max Kunde", adresse: "Gasse 1, 1010 Wien", uid: "" },
  positionen: [{ text: "Beratung", menge: 1, einheit: "Std.", preis: 1000, ustSatz: 20 }],
  zahlungszielTage: 14, reverseCharge: false, notiz: "", ausgestelltAm: "2025-03-01", bezahltAm: "", storniert: false, mahnungen: [], ...x,
});

describe("Mahnwesen", () => {
  it("schlägt die Stufen der Reihe nach vor", () => {
    expect(naechsteMahnung(re(), new Date("2025-03-16"))).toMatchObject({ stufe: 1, faellig: false }); // fällig 15.3., +3 Tage
    expect(naechsteMahnung(re(), new Date("2025-03-18"))).toMatchObject({ stufe: 1, faellig: true });
    const m1 = mahnungEntwurf(re(), firma, 1, new Date("2025-03-18"));
    expect(m1.zinsen).toBe(0);
    expect(m1.frist).toBe("2025-04-01");
    expect(naechsteMahnung(re({ mahnungen: [m1] }), new Date("2025-04-01"))!.faellig).toBe(false);
    expect(naechsteMahnung(re({ mahnungen: [m1] }), new Date("2025-04-02"))).toMatchObject({ stufe: 2, faellig: true });
    expect(naechsteMahnung(re({ bezahltAm: "2025-04-01" }))).toBeNull();
    const m3 = { ...m1, stufe: 3 as const };
    expect(naechsteMahnung(re({ mahnungen: [m1, m3] }))).toBeNull();
  });
  it("Verzugszinsen 4 % für Verbraucher:innen, Pauschale 40 € nur bei Unternehmen", () => {
    expect(verzugszinsen(re(), firma, 4, "2025-04-14")).toBeCloseTo((1000 * 0.04 * 30) / 365, 2);
    const v = mahnungEntwurf(re(), firma, 2, new Date("2025-04-14"));
    expect(v.zinssatz).toBe(4);
    expect(v.gebuehr).toBe(0);
    const b2b = mahnungEntwurf(re({ kunde: { name: "GmbH", adresse: "x", uid: "ATU87654321" } }), firma, 2, new Date("2025-04-14"), 11.5);
    expect(b2b.gebuehr).toBe(40);
    expect(b2b.zinssatz).toBe(11.5);
    expect(mahnSumme(re(), firma, b2b).gesamt).toBeCloseTo(1000 + b2b.zinsen + 40, 2);
  });
  it("Text der letzten Mahnung kündigt rechtliche Schritte an", () => {
    const m = mahnungEntwurf(re(), firma, 3, new Date("2025-05-01"));
    const t = mahnText(re(), firma, m);
    expect(t.betreff).toBe("Letzte Mahnung: Rechnung 2025-001");
    expect(t.text).toContain("gerichtlich");
    expect(t.text).toContain("AT61 1904 3002 3457 3201");
    expect(m.frist).toBe("2025-05-08");
  });
});
