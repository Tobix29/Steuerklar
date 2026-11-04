/** Kalendereintrag (.ics) für die Frist der Arbeitnehmerveranlagung, mit Erinnerungen 14 und 1 Tag vorher. */
import { fristen } from "./constants";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

export function fristIcs(year: number, now = new Date()): string {
  const f = fristen(year, now);
  const day = ymd(f.antrag);
  const next = new Date(f.antrag.getTime() + 86_400_000);
  const stamp = `${ymd(now)}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Steuerklar//Fristen//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:frist-anv-${year}@steuerklar`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:Letzter Tag: Arbeitnehmerveranlagung ${year}`,
    `DESCRIPTION:Heute endet die Frist für die Arbeitnehmerveranlagung ${year} (5 Jahre rückwirkend). Abgabe über FinanzOnline: https://finanzonline.bmf.gv.at`,
    "BEGIN:VALARM",
    "TRIGGER:-P14D",
    "ACTION:DISPLAY",
    `DESCRIPTION:In 14 Tagen endet die Frist für die Arbeitnehmerveranlagung ${year}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:Morgen endet die Frist für die Arbeitnehmerveranlagung ${year}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** Alle Termine (Erklärungen, Vorauszahlungen, SVS, UVA) als ein Kalender. Beträge stehen nur in der Beschreibung. */
export function termineIcs(termine: { datum: string; titel: string; art: string; betrag?: number }[], now = new Date()): string {
  const stamp = `${ymd(now)}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Steuerklar//Fristen//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Steuerklar – Steuertermine"];
  for (const t of termine) {
    const d = new Date(`${t.datum}T00:00:00Z`);
    const next = new Date(d.getTime() + 86_400_000);
    const uid = `${t.datum}-${t.titel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@steuerklar`;
    const desc = `${t.titel}${t.betrag ? ` – geschätzt ${t.betrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : ""}. Erstellt von Steuerklar, ohne Gewähr.`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d)}`,
      `DTEND;VALUE=DATE:${ymd(next)}`,
      `SUMMARY:${esc(t.titel)}`,
      `DESCRIPTION:${esc(desc)}`,
      "BEGIN:VALARM",
      `TRIGGER:${t.art === "frist" || t.art === "erklaerung" ? "-P14D" : "-P3D"}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(t.titel)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
