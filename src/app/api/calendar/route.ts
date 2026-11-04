import { fristIcs } from "@/lib/tax/calendar";
import { route } from "@/lib/server/guard";
import { parseYear } from "@/lib/server/repo";

/** Frist als Kalendereintrag (enthält keine persönlichen Daten). */
export const GET = route({ auth: true }, async ({ req }) => {
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  return new Response(fristIcs(year), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="Frist-Arbeitnehmerveranlagung-${year}.ics"`,
      "Cache-Control": "no-store",
    },
  });
});
