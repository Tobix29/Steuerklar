import { calculate } from "@/lib/tax/calculate";
import { json, route } from "@/lib/server/guard";
import { loadCase, parseYear } from "@/lib/server/repo";

export const GET = route({ auth: true }, async ({ req, user }) => {
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  return json(calculate(await loadCase(user, year)));
});
