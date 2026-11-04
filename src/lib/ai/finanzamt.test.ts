import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/tax/calculate";
import { TaxCaseSchema } from "@/lib/tax/types";
import { BescheidSchema, compareBescheid, istFristfrei, monatsfrist, vermuteteZustellung, type Bescheid } from "./finanzamt";

const fall = TaxCaseSchema.parse({
  year: 2025,
  lohnzettel: [{ id: "l", kz210: 48_000, kz220: 6_800, kz225: 1_150, kz230: 7_400, kz245: 33_400, kz260: 7_100 }],
  werbungskosten: [{ id: "w", label: "Laptop", amount: 1_200, category: "arbeitsmittel" }],
});
const r = calculate(fall);
const bescheid = (over: Partial<Bescheid>): Bescheid =>
  BescheidSchema.parse({
    istBescheid: true, art: "einkommensteuer", jahr: 2025, bescheiddatum: "2026-03-12", finanzamt: "Finanzamt Österreich", steuernummer: "12 345/6789",
    gesamtbetragDerEinkuenfte: null, werbungskosten: null, sonderausgaben: null, aussergewoehnlicheBelastungen: null, einkommen: null,
    einkommensteuer: null, anrechenbareLohnsteuer: null, abgabengutschrift: null, familienbonus: null, vorauszahlungFolgejahr: null,
    nichtAnerkannt: [], begruendung: "", hinweise: [], ...over,
  });

describe("Fristen nach BAO", () => {
  it("Monatsfrist endet am gleichen Tag des Folgemonats, Monatsende und Wochenende beachtet", () => {
    expect(monatsfrist("2026-03-12")).toBe("2026-04-13"); // 12.4.2026 ist Sonntag
    expect(monatsfrist("2026-01-31")).toBe("2026-03-02"); // 28.2. ist Samstag
    expect(monatsfrist("2026-03-06")).toBe("2026-04-07"); // 6.4.2026 ist Ostermontag
    expect(monatsfrist("2026-11-24")).toBe("2026-12-28"); // 24.–27.12. fristfrei
    expect(monatsfrist("2026-12-15")).toBe("2027-01-15");
  });
  it("Feiertage", () => {
    expect(istFristfrei(new Date("2026-04-03"))).toBe(true); // Karfreitag
    expect(istFristfrei(new Date("2026-06-04"))).toBe(true); // Fronleichnam
    expect(istFristfrei(new Date("2026-10-26"))).toBe(true);
    expect(istFristfrei(new Date("2026-10-27"))).toBe(false);
  });
  it("Post ohne Zustellnachweis: 3. Werktag", () => {
    expect(vermuteteZustellung("2026-03-12", false)).toBe("2026-03-17");
  });
});

describe("Bescheidprüfung", () => {
  it("erkennt gekürzte Werbungskosten und entwirft eine Beschwerde", () => {
    const p = compareBescheid(bescheid({ werbungskosten: 132, abgabengutschrift: r.erstattung - 400, nichtAnerkannt: [{ posten: "Laptop", betrag: 1200, begruendung: "Privatnutzung" }] }), fall, r, { today: new Date("2026-03-20") });
    const wk = p.abweichungen.find((a) => a.posten === "Werbungskosten");
    expect(wk?.zuDeinenUngunsten).toBe(true);
    expect(wk?.differenz).toBeCloseTo(r.werbungskostenSumme - 132, 2);
    expect(p.differenzGutschrift).toBe(400);
    expect(p.beschwerdeSinnvoll).toBe(true);
    expect(p.frist).toBe("2026-04-13");
    expect(p.fristAbgelaufen).toBe(false);
    expect(p.beschwerde).toContain("§ 243 BAO");
    expect(p.beschwerde).toContain("12 345/6789");
    expect(p.beschwerde).toContain("Laptop");
    expect(p.beschwerde).not.toContain("§ 212a"); // Gutschrift, keine Nachforderung
  });
  it("keine Beschwerde bei Übereinstimmung, Aussetzung bei Nachforderung", () => {
    const ok = compareBescheid(bescheid({ werbungskosten: r.werbungskostenSumme, abgabengutschrift: r.erstattung }), fall, r, { today: new Date("2026-03-20") });
    expect(ok.abweichungen).toHaveLength(0);
    expect(ok.beschwerdeSinnvoll).toBe(false);
    const nach = compareBescheid(bescheid({ abgabengutschrift: -300 }), fall, r, { today: new Date("2026-03-20") });
    expect(nach.beschwerde).toContain("§ 212a BAO");
  });
  it("abgelaufene Frist → Hinweis auf § 299 BAO", () => {
    const p = compareBescheid(bescheid({ abgabengutschrift: r.erstattung - 500 }), fall, r, { today: new Date("2026-06-01") });
    expect(p.fristAbgelaufen).toBe(true);
    expect(p.fazit).toContain("§ 299 BAO");
  });
});
