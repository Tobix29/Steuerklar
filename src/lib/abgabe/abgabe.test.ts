import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/tax/calculate";
import { TaxCaseSchema } from "@/lib/tax/types";
import { erstelleSnapshot, formulare, freigabeMoeglich, pruefliste, uebergang, uebermittlungsdatei } from "./abgabe";

const fall = TaxCaseSchema.parse({
  year: 2025, firstName: "Anna", lastName: "Muster", pendlerKm: 30, fahrtenProMonat: 20,
  lohnzettel: [{ id: "l", kz210: 48_000, kz230: 7_400, kz245: 40_600, kz260: 7_100 }],
  werbungskosten: [{ id: "w", label: "Laptop & <Zubehör>", amount: 1_200, category: "arbeitsmittel" }],
});
const r = calculate(fall);
const heute = new Date("2026-03-01");

describe("Status-Ablauf", () => {
  it("erlaubt nur zulässige Übergänge je Rolle", () => {
    expect(uebergang(null, "freigeben", "mandant")).toBe("freigegeben");
    expect(uebergang("freigegeben", "pruefen", "kanzlei")).toBe("in_pruefung");
    expect(uebergang("in_pruefung", "rueckfrage", "kanzlei")).toBe("rueckfrage");
    expect(uebergang("rueckfrage", "freigeben", "mandant")).toBe("freigegeben");
    expect(uebergang("in_pruefung", "uebermitteln", "kanzlei")).toBe("uebermittelt");
    expect(() => uebergang("freigegeben", "uebermitteln", "kanzlei")).toThrow(); // erst prüfen
    expect(() => uebergang("freigegeben", "pruefen", "mandant")).toThrow(); // falsche Rolle
    expect(() => uebergang("uebermittelt", "zurueckziehen", "mandant")).toThrow();
  });
});

describe("Prüfliste und Snapshot", () => {
  it("markiert fehlende Belege und Pendlerrechner", () => {
    const p = pruefliste(fall, r, [], heute);
    expect(p.some((x) => x.text.includes("Pendlerrechner"))).toBe(true);
    expect(p.some((x) => x.text.includes("Laptop"))).toBe(true);
    expect(p.some((x) => x.stufe === "kritisch")).toBe(false);
  });
  it("laufendes Jahr ist kritisch und blockiert die Freigabe", async () => {
    const s = await erstelleSnapshot(fall, r, [], 1, new Date("2025-06-01"));
    expect(freigabeMoeglich(s)).toBe(false);
  });
  it("Prüfsumme ist stabil und ändert sich mit den Daten", async () => {
    const a = await erstelleSnapshot(fall, r, [], 1, heute);
    const b = await erstelleSnapshot(fall, r, [], 2, heute);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    const f2 = { ...fall, pendlerKm: 31 };
    expect((await erstelleSnapshot(f2, calculate(f2), [], 1, heute)).hash).not.toBe(a.hash);
  });
  it("Formulare und Übermittlungsdatei (XML-escaped)", async () => {
    expect(formulare(r)).toContain("L1");
    const s = await erstelleSnapshot(fall, r, [], 1, heute);
    const xml = uebermittlungsdatei({ id: "x", year: 2025, mandant: { name: "Anna <Muster>", email: "a@b.at" }, snapshot: s, freigabe: { at: heute.getTime(), text: "", hash: s.hash } });
    expect(xml).toContain('formular typ="L1"');
    expect(xml).toContain("Anna &lt;Muster&gt;");
    expect(xml).not.toContain("<Muster>");
  });
});
