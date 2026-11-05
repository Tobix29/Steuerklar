import { mahnungPdf } from "@/lib/pdf/rechnung";
import { audit } from "@/lib/server/auth";
import { HttpError, route } from "@/lib/server/guard";
import { loadCase, parseYear } from "@/lib/server/repo";

/** Vermerkte Mahnung (Stufe 1–3) als PDF. */
export const GET = route({ auth: true, rate: { name: "mahnung-pdf", limit: 120, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const url = new URL(req.url);
  const c = await loadCase(user, parseYear(url.searchParams.get("year")));
  const b = c.betriebe.find((x) => x.id === url.searchParams.get("betrieb"));
  const r = b?.rechnungen.find((x) => x.id === url.searchParams.get("id"));
  const m = r?.mahnungen.find((x) => x.stufe === Number(url.searchParams.get("stufe")));
  if (!b || !r || !m) throw new HttpError(404, "Mahnung nicht gefunden.");
  await audit(user.userId, "mahnung_pdf");
  return new Response(Buffer.from(await mahnungPdf(r, b.firma, m)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Mahnung-${m.stufe}-${r.nummer.replace(/[^\w-]+/g, "_")}.pdf"`, "Cache-Control": "no-store" },
  });
});
