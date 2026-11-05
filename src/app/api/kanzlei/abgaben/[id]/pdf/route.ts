import { audit } from "@/lib/server/auth";
import { HttpError, route } from "@/lib/server/guard";
import { abgabeFuerKanzlei, kanzleiVon } from "@/lib/server/kanzlei";
import { buildPdf } from "@/lib/server/pdf";

/** Ausfüllhilfe (Kennzahlen + Berechnung) zum freigegebenen Stand. */
export const GET = route({ auth: true }, async ({ req, user }) => {
  if (!(await kanzleiVon(user.userId)) || !user.totpEnabled) throw new HttpError(403, "Kein Kanzlei-Konto mit Zwei-Faktor-Anmeldung.");
  const id = new URL(req.url).pathname.split("/").at(-2) ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "Ungültige ID.");
  const d = await abgabeFuerKanzlei(user, id);
  await audit(user.userId, "kanzlei_pdf");
  return new Response(Buffer.from(await buildPdf(d.snapshot.case, d.snapshot.result)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Abgabe-${d.year}-${d.id.slice(0, 8)}.pdf"`, "Cache-Control": "no-store" },
  });
});
