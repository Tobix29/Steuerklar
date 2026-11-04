import { calculate } from "@/lib/tax/calculate";
import { SUPPORTED_YEARS } from "@/lib/tax/constants";
import { json, route } from "@/lib/server/guard";
import { listDocuments, loadCase } from "@/lib/server/repo";

/** Überblick über alle Veranlagungsjahre: Gutschrift, Datenstand – für Vorjahresvergleich und Fristen. */
export const GET = route({ auth: true }, async ({ user }) => {
  const years = [];
  for (const year of SUPPORTED_YEARS) {
    const c = await loadCase(user, year);
    const docs = (await listDocuments(user, year)).length;
    const hasData = c.lohnzettel.length > 0;
    years.push({ year, hasData, documents: docs, erstattung: hasData ? calculate(c).erstattung : null });
  }
  return json({ years });
});
