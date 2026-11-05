import { rechnungPdf } from "@/lib/pdf/rechnung";
import { audit } from "@/lib/server/auth";
import { HttpError, route } from "@/lib/server/guard";
import { loadCase, parseYear } from "@/lib/server/repo";

/** Rechnung als PDF (nur ausgestellte Rechnungen). */
export const GET = route({ auth: true, rate: { name: "rechnung-pdf", limit: 120, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const url = new URL(req.url);
  const c = await loadCase(user, parseYear(url.searchParams.get("year")));
  const b = c.betriebe.find((x) => x.id === url.searchParams.get("betrieb"));
  const r = b?.rechnungen.find((x) => x.id === url.searchParams.get("id"));
  if (!b || !r) throw new HttpError(404, "Rechnung nicht gefunden.");
  if (!r.ausgestelltAm) throw new HttpError(409, "Entwürfe werden erst nach dem Ausstellen als PDF erzeugt.");
  await audit(user.userId, "rechnung_pdf");
  const name = `Rechnung-${r.nummer.replace(/[^\w-]+/g, "_")}${r.storniert ? "-STORNO" : ""}.pdf`;
  return new Response(Buffer.from(await rechnungPdf(r, b.firma)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
});
