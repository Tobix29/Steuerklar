import { BESCHEID_INSTRUCTIONS, BescheidSchema, compareBescheid } from "@/lib/ai/finanzamt";
import { calculate } from "@/lib/tax/calculate";
import { audit } from "@/lib/server/auth";
import { readLetter } from "@/lib/server/finanzamt";
import { json, route } from "@/lib/server/guard";
import { loadCase, parseYear } from "@/lib/server/repo";

export const maxDuration = 120;

/** Steuerbescheid auslesen und mit der eigenen Berechnung vergleichen. Der Bescheid wird nicht gespeichert. */
export const POST = route({ auth: true, rate: { name: "bescheid", limit: 20, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const { form, data: bescheid } = await readLetter(req, BescheidSchema, BESCHEID_INSTRUCTIONS, () => "Lies diesen Steuerbescheid aus.");
  const year = parseYear(String(form.get("year") ?? ""));
  const c = await loadCase(user, year);
  const pruefung = compareBescheid(bescheid, c, calculate(c), { databox: form.get("zustellung") !== "post" });
  await audit(user.userId, "bescheid_checked");
  return json({ bescheid, pruefung });
});
