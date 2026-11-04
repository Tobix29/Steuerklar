import { calculate } from "@/lib/tax/calculate";
import { TaxCaseSchema } from "@/lib/tax/types";
import { json, parseJson, route } from "@/lib/server/guard";
import { q } from "@/lib/server/db";
import { listDocuments, loadCase, parseYear, saveCase } from "@/lib/server/repo";

export const GET = route({ auth: true }, async ({ req, user }) => {
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  const data = await loadCase(user, year);
  const storage = await q.info();
  return json({ case: data, result: calculate(data), documents: (await listDocuments(user, year)).length, storagePersistent: storage.persistent });
});

export const PUT = route({ auth: true, rate: { name: "case", limit: 120, windowMs: 60_000 } }, async ({ req, user }) => {
  const data = await parseJson(req, TaxCaseSchema);
  await saveCase(user, data);
  return json({ case: data, result: calculate(data) });
});
