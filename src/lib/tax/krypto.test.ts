import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import { TaxCaseSchema } from "./types";

const base = { year: 2025, lohnzettel: [{ id: "l", kz210: 50_000, kz230: 9_000, kz245: 41_000, kz260: 8_500 }] };
const fall = (extra: object) => TaxCaseSchema.parse({ ...base, ...extra });

describe("Krypto / Erträge ohne KESt-Abzug", () => {
  const ohne = calculate(fall({}));
  it("27,5 % Sondersteuer wird nachgezahlt und macht die E1 zur Pflicht", () => {
    const r = calculate(fall({ kapital: { ohneKest275: 2_000 } }));
    expect(r.einkommensteuer - ohne.einkommensteuer).toBeCloseTo(550, 2);
    expect(r.erstattung).toBeCloseTo(ohne.erstattung - 550, 2);
    expect(r.e1Erforderlich).toBe(true);
    expect(r.pflichtveranlagung.some((p) => p.includes("E1kv"))).toBe(true);
  });
  it("Verluste (z. B. Krypto) werden zuerst mit Erträgen ohne KESt verrechnet", () => {
    const r = calculate(fall({ kapital: { ohneKest275: 2_000, verluste275: 1_500 } }));
    expect(r.einkommensteuer - ohne.einkommensteuer).toBeCloseTo(137.5, 2);
  });
  it("Regelbesteuerung bei niedrigem Einkommen: keine Sondersteuer", () => {
    const low = TaxCaseSchema.parse({ year: 2025, lohnzettel: [{ id: "l", kz210: 9_000, kz230: 1_600, kz245: 7_400, kz260: 0 }], kapital: { ohneKest275: 1_000 } });
    const r = calculate(low);
    const ref = calculate({ ...low, kapital: { ...low.kapital, ohneKest275: 0 } });
    expect(r.kapitalOption?.empfohlen).toBe(true);
    expect(r.erstattung).toBeCloseTo(ref.erstattung, 0);
  });
});

describe("Sonstige Einkünfte", () => {
  const ohne = calculate(fall({}));
  it("Freigrenzen 440 € / 220 € – darunter steuerfrei, darüber voll", () => {
    expect(calculate(fall({ sonstige: { spekulation: 440, leistungen: 220 } })).einkommen).toBe(ohne.einkommen);
    const r = calculate(fall({ sonstige: { spekulation: 441 } }));
    expect(r.e1Erforderlich).toBe(true);
    // 441 € liegen unter dem Veranlagungsfreibetrag (730 €) → bei Arbeitnehmer:innen trotzdem steuerfrei
    expect(r.einkommen).toBe(ohne.einkommen);
    expect(calculate(fall({ sonstige: { spekulation: 3_000 } })).einkommen).toBeCloseTo(ohne.einkommen + 3_000, 2);
  });
});
