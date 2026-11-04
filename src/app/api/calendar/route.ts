import { fristIcs, termineIcs } from "@/lib/tax/calendar";
import { calculate } from "@/lib/tax/calculate";
import { termine } from "@/lib/tax/planer";
import { route } from "@/lib/server/guard";
import { loadCase, parseYear } from "@/lib/server/repo";

/** Fristen als Kalendereintrag. `?alle=1`: alle Steuertermine des Falls (mit geschätzten Beträgen in der Beschreibung). */
export const GET = route({ auth: true }, async ({ req, user }) => {
  const url = new URL(req.url);
  const year = parseYear(url.searchParams.get("year"));
  let body: string;
  let name: string;
  if (url.searchParams.get("alle") === "1") {
    const c = await loadCase(user, year);
    body = termineIcs(termine(c, calculate(c)));
    name = `Steuertermine-${year}.ics`;
  } else {
    body = fristIcs(year);
    name = `Frist-Arbeitnehmerveranlagung-${year}.ics`;
  }
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
});
