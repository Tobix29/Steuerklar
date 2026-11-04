import { calculate } from "@/lib/tax/calculate";
import { TaxCaseSchema } from "@/lib/tax/types";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { listDocuments, loadCase, parseYear, saveCase } from "@/lib/server/repo";

export const GET = route({ auth: true }, async ({ req, user }) => {
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  const data = loadCase(user, year);
  return json({ case: data, result: calculate(data), documents: listDocuments(user, year).length });
});

export const PUT = route({ auth: true, rate: { name: "case", limit: 120, windowMs: 60_000 } }, async ({ req, user }) => {
  const data = await parseJson(req, TaxCaseSchema);
  if (data.filing === "single" && data.persons.length > 1) data.persons = data.persons.slice(0, 1);
  if (data.filing === "joint" && data.persons.length < 2) throw new HttpError(400, "Für die Zusammenveranlagung werden zwei Personen benötigt.");
  saveCase(user, data);
  return json({ case: data, result: calculate(data) });
});
