import { describe, expect, it } from "vitest";
import { avabBetrag, behinderungPauschbetrag, calculate, pendlerFaktor, pendlerpauschale, selbstbehalt, steuerSonstigeBezuege, tarifsteuer, verkehrsabsetzbetrag } from "./calculate";
import { SUPPORTED_YEARS, YEAR_PARAMS } from "./constants";
import { TaxCaseSchema } from "./types";

const P25 = YEAR_PARAMS[2025];

describe("Tarif §33 Abs 1 EStG", () => {
  it.each(SUPPORTED_YEARS)("ist 0 bis zur ersten Stufe (%i)", (y) => {
    const p = YEAR_PARAMS[y];
    expect(tarifsteuer(p.brackets[0]!.upTo, p)).toBe(0);
    expect(tarifsteuer(p.brackets[0]!.upTo + 100, p)).toBeCloseTo(20, 2);
  });
  it.each(SUPPORTED_YEARS)("Stufen sind aufsteigend und enden mit 55 % (%i)", (y) => {
    const b = YEAR_PARAMS[y].brackets;
    for (let i = 1; i < b.length; i++) {
      expect(b[i]!.upTo).toBeGreaterThan(b[i - 1]!.upTo);
      expect(b[i]!.rate).toBeGreaterThan(b[i - 1]!.rate);
    }
    expect(b.at(-1)!.rate).toBe(0.55);
  });
  it("Referenzwert 2025: 40.000 € Einkommen", () => {
    // 8.309 × 20 % + 14.219 × 30 % + 4.164 × 40 %
    expect(tarifsteuer(40_000, P25)).toBeCloseTo(1661.8 + 4265.7 + 1665.6, 2);
  });
  it("Tarifstufen 2026 sind um ca. 1,73 % höher als 2025", () => {
    const ratio = YEAR_PARAMS[2026].brackets[0]!.upTo / P25.brackets[0]!.upTo;
    expect(ratio).toBeCloseTo(1.0173, 3);
  });
});

describe("Sonstige Bezüge (13./14.)", () => {
  it("Freigrenze 2.100 €", () => expect(steuerSonstigeBezuege(2100)).toBe(0));
  it("6 % nach 620 € Freibetrag", () => expect(steuerSonstigeBezuege(5917)).toBeCloseTo((5917 - 620) * 0.06, 2));
  it("27 %-Stufe ab 25.000 €", () => expect(steuerSonstigeBezuege(30000)).toBeCloseTo(24380 * 0.06 + 5000 * 0.27, 2));
});

describe("Pendler & Absetzbeträge", () => {
  it("kleines Pendlerpauschale 20–40 km", () => expect(pendlerpauschale(25, true, 20, P25)).toBe(696));
  it("unter 20 km mit zumutbaren Öffis: nichts", () => expect(pendlerpauschale(15, true, 20, P25)).toBe(0));
  it("großes Pendlerpauschale 2–20 km", () => expect(pendlerpauschale(10, false, 20, P25)).toBe(372));
  it("Aliquotierung 2/3 und 1/3", () => {
    expect(pendlerFaktor(9)).toBeCloseTo(2 / 3);
    expect(pendlerFaktor(5)).toBeCloseTo(1 / 3);
    expect(pendlerFaktor(3)).toBe(0);
  });
  it("Pendlereuro 2026 = 6 €/km", () => expect(YEAR_PARAMS[2026].pendlereuroPerKm).toBe(6));
  it("Zuschlag zum VAB wird eingeschliffen", () => {
    expect(verkehrsabsetzbetrag(15_000, P25).zuschlag).toBe(790);
    expect(verkehrsabsetzbetrag(35_000, P25).zuschlag).toBe(0);
    const mid = verkehrsabsetzbetrag((19424 + 29743) / 2, P25).zuschlag;
    expect(mid).toBeCloseTo(395, 0);
  });
  it("AVAB 2025", () => {
    expect(avabBetrag(1, P25)).toBe(601);
    expect(avabBetrag(2, P25)).toBe(813);
    expect(avabBetrag(3, P25)).toBe(1081);
  });
  it("Selbstbehalt", () => {
    expect(selbstbehalt(40_000, 0)).toBe(4800);
    expect(selbstbehalt(40_000, 2)).toBe(4000);
  });
});

/** Typischer Fall: 50.000 € brutto (14 Gehälter), Wien, 2025 */
const base = (over: Record<string, unknown> = {}) =>
  TaxCaseSchema.parse({
    year: 2025,
    firstName: "Lena",
    lohnzettel: [
      {
        id: "lz1",
        arbeitgeber: "Muster GmbH",
        kz210: 50_000,
        kz220: 7143,
        kz225: 1226,
        kz230: 7744,
        kz245: 35_113,
        kz260: 5502,
      },
    ],
    ...over,
  });

describe("calculate() – Arbeitnehmerveranlagung", () => {
  it("ohne zusätzliche Abzüge ≈ keine Gutschrift (Lohnsteuer war korrekt)", () => {
    const r = calculate(base());
    expect(r.werbungskostenSumme).toBe(132);
    expect(Math.abs(r.erstattung)).toBeLessThan(5);
  });

  it("Werbungskosten über der Pauschale erhöhen die Gutschrift um den Grenzsteuersatz", () => {
    const r = calculate(base({ werbungskosten: [{ id: "w", label: "Laptop", amount: 1132, category: "digitale_arbeitsmittel" }] }));
    expect(r.erstattung).toBeCloseTo(1000 * 0.3, 0);
    expect(r.formular.some((f) => f.kz === "169")).toBe(true);
  });

  it("Pendlerpauschale + Pendlereuro", () => {
    const r = calculate(base({ pendlerKm: 25, oeffiZumutbar: true, fahrtenProMonat: 18 }));
    // 696 € × 30 % + 25 km × 2 € Pendlereuro
    expect(r.erstattung).toBeCloseTo(696 * 0.3 + 50, 0);
  });

  it("Familienbonus Plus senkt die Steuer um 2.000,16 € je Kind", () => {
    const r = calculate(base({ children: [{ id: "k", birthYear: 2019, months: 12, familienbonusShare: 1 }] }));
    expect(r.erstattung).toBeCloseTo(2000.16, 0);
  });

  it("Familienbonus halbiert bei Aufteilung", () => {
    const r = calculate(base({ children: [{ id: "k", birthYear: 2019, months: 12, familienbonusShare: 0.5 }] }));
    expect(r.erstattung).toBeCloseTo(1000.08, 0);
  });

  it("Alleinerzieherabsetzbetrag wird zusätzlich gutgeschrieben", () => {
    const r = calculate(base({ familienstatus: "alleinerzieher", children: [{ id: "k", birthYear: 2019, months: 12 }] }));
    expect(r.erstattung).toBeCloseTo(2000.16 + 601, 0);
  });

  it("Geringverdiener: SV-Rückerstattung (Negativsteuer)", () => {
    const r = calculate(
      TaxCaseSchema.parse({ year: 2025, lohnzettel: [{ id: "a", kz210: 9000, kz230: 1600, kz245: 7400, kz260: 0 }] }),
    );
    expect(r.tarifsteuer).toBe(0);
    expect(r.negativsteuer[0]?.label).toBe("SV-Rückerstattung");
    expect(r.erstattung).toBeGreaterThan(0);
    expect(r.erstattung).toBeLessThanOrEqual(1600 * 0.55);
  });

  it("Mehrere Lohnzettel lösen Pflichtveranlagung aus", () => {
    const c = base();
    c.lohnzettel.push({ ...c.lohnzettel[0]!, id: "lz2" });
    expect(calculate(c).pflichtveranlagung.length).toBeGreaterThan(0);
  });

  it("Kirchenbeitrag max. 600 €", () => {
    const r = calculate(base({ kirchenbeitrag: 900 }));
    expect(r.sonderausgaben[0]!.amount).toBe(600);
  });

  it("weist ungültige Eingaben zurück", () => {
    expect(() => TaxCaseSchema.parse({ year: 2019 })).toThrow();
    expect(() => base({ bundesland: "BY" })).toThrow();
  });

  it("Behinderung: Pauschbetrag ohne Selbstbehalt", () => {
    expect(behinderungPauschbetrag(24)).toBe(0);
    expect(behinderungPauschbetrag(50)).toBe(401);
    expect(behinderungPauschbetrag(100)).toBe(1198);
    const r = calculate(base({ behinderungGrad: 50 }));
    expect(r.aussergewoehnlicheBelastungenSumme).toBe(401);
    expect(r.erstattung).toBeCloseTo(401 * 0.3, 0);
  });

  it("Auswärtige Berufsausbildung: 110 € pro Monat", () => {
    const r = calculate(base({ children: [{ id: "k", birthYear: 2006, months: 12, auswaertigeAusbildungMonate: 10 }] }));
    expect(r.aussergewoehnlicheBelastungen.find((l) => l.label.startsWith("Auswärtige"))?.amount).toBe(1100);
  });

  it("Familienheimfahrten sind gedeckelt, doppelte Haushaltsführung unter KZ 723", () => {
    const r = calculate(base({ familienheimfahrten: 5000, doppelteHaushaltsfuehrung: 4800 }));
    expect(r.werbungskosten.find((l) => l.kz === "300")?.amount).toBe(3672);
    expect(r.werbungskosten.find((l) => l.kz === "723")?.amount).toBe(4800);
    expect(r.formular.some((f) => f.kz === "300") && r.formular.some((f) => f.kz === "723")).toBe(true);
  });
});
