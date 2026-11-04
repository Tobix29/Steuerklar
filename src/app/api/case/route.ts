import { calculate } from "@/lib/tax/calculate";
import { TaxCaseSchema } from "@/lib/tax/types";
import { json, parseJson, route } from "@/lib/server/guard";
import { listDocuments, loadCase, parseYear, saveCase } from "@/lib/server/repo";

export const GET = route({ auth: true }, async ({ req, user }) => {
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  const data = loadCase(user, year);
  return json({ case: data, result: calculate(data), documents: listDocuments(user, year).length });
});

export const PUT = route({ auth: true, rate: { name: "case", limit: 120, windowMs: 60_000 } }, async ({ req, user }) => {
  const data = await parseJson(req, TaxCaseSchema);
  saveCase(user, data);
  return json({ case: data, result: calculate(data) });
});
