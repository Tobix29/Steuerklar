import { buchungInstructions, BuchungScanSchema, sanitizeBuchung } from "@/lib/ai/buchung";
import { audit } from "@/lib/server/auth";
import { readLetter } from "@/lib/server/finanzamt";
import { json, route } from "@/lib/server/guard";
import { parseYear } from "@/lib/server/repo";

export const maxDuration = 120;

/** Rechnung/Kassenbon auslesen und als Buchungsvorschlag zurückgeben. Das Bild wird nicht gespeichert. */
export const POST = route({ auth: true, rate: { name: "buchung", limit: 120, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const { data } = await readLetter(
    req,
    BuchungScanSchema,
    (form) => buchungInstructions(parseYear(String(form.get("year") ?? ""))),
    () => "Erfasse diesen Beleg.",
  );
  await audit(user.userId, "buchung_scanned");
  return json({ buchung: sanitizeBuchung(data) });
});
