import { describe, expect, it } from "vitest";
import { fristIcs } from "./calendar";

describe("Fristen-Kalender", () => {
  it("erzeugt einen ganztägigen Termin am 31.12. des fünften Folgejahres mit Erinnerungen", () => {
    const ics = fristIcs(2021, new Date("2026-11-04T10:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
    expect(ics).toContain("TRIGGER:-P14D");
    expect(ics.split("\r\n").filter((l) => l === "BEGIN:VALARM")).toHaveLength(2);
  });
});
