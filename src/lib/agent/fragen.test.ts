import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/tax/calculate";
import { TaxCaseSchema } from "@/lib/tax/types";
import { alsAntwort, beantworten, fragen, mitErsparnis } from "./fragen";

const heute = new Date("2026-03-15");
const lz = [{ id: "l", kz210: 42_000, kz230: 6_500, kz245: 35_500, kz260: 6_000 }];
const c = TaxCaseSchema.parse({ year: 2025, lohnzettel: lz });
const r = calculate(c);

describe("Steuer-Check", () => {
  it("fragt bei Arbeitnehmer:innen nach Pendeln, Homeoffice und Werbungskosten – mit geschätzter Ersparnis", () => {
    const list = mitErsparnis(c, r, fragen(c, r, { today: heute }));
    const ids = list.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["pendler", "homeoffice", "wk-digital", "kirche", "ams"]));
    expect(list.find((f) => f.id === "pendler")!.ersparnis).toBeGreaterThan(100);
    // Pflicht-/Vollständigkeitsfragen zuerst
    expect(list[0]!.gruppe).toBe("vollstaendig");
  });
  it("übernimmt Antworten und blendet erledigte Fragen aus", () => {
    const f = fragen(c, r, { today: heute }).find((x) => x.id === "pendler")!;
    const c2 = beantworten(c, f, alsAntwort(f, 30));
    expect(c2.pendlerKm).toBe(30);
    expect(c2.fahrtenProMonat).toBe(20);
    expect(calculate(c2).erstattung).toBeGreaterThan(r.erstattung);
    const ids2 = fragen(c2, calculate(c2), { today: heute }).map((x) => x.id);
    expect(ids2).not.toContain("pendler");
    expect(ids2).toContain("pendler-oeffi");
    const skip = beantworten(c2, fragen(c2, calculate(c2), { today: heute }).find((x) => x.id === "homeoffice")!, null);
    expect(fragen(skip, calculate(skip), { today: heute }).map((x) => x.id)).not.toContain("homeoffice");
  });
  it("schlägt Werte aus dem Vorjahr vor und übernimmt Kinder", () => {
    const vj = TaxCaseSchema.parse({ year: 2024, lohnzettel: lz, pendlerKm: 42, children: [{ id: "k", firstName: "Lena", birthYear: 2015 }] });
    const list = fragen(c, r, { vorjahr: vj, today: heute });
    expect(list.find((f) => f.id === "pendler")!.hilfe).toContain("42 km");
    const kinder = list.find((f) => f.id === "vj-kinder")!;
    const c2 = beantworten(c, kinder, alsAntwort(kinder, true));
    expect(c2.children).toHaveLength(1);
    expect(calculate(c2).erstattung).toBeGreaterThan(r.erstattung + 1_000);
  });
  it("laufendes Jahr und fehlender Lohnzettel werden gemeldet", () => {
    const leer = TaxCaseSchema.parse({ year: 2026 });
    const ids = fragen(leer, calculate(leer), { today: heute }).map((f) => f.id);
    expect(ids).toContain("jahr-laeuft");
    expect(ids).toContain("lohnzettel");
  });
});
