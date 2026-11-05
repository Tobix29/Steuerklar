import { uebermittlungsdatei } from "@/lib/abgabe/abgabe";
import { audit } from "@/lib/server/auth";
import { HttpError, route } from "@/lib/server/guard";
import { abgabeFuerKanzlei, kanzleiVon } from "@/lib/server/kanzlei";

/** Übermittlungsdatei (Kennzahlen je Formular) herunterladen. */
export const GET = route({ auth: true }, async ({ req, user }) => {
  if (!(await kanzleiVon(user.userId)) || !user.totpEnabled) throw new HttpError(403, "Kein Kanzlei-Konto mit Zwei-Faktor-Anmeldung.");
  const id = new URL(req.url).pathname.split("/").at(-2) ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "Ungültige ID.");
  const d = await abgabeFuerKanzlei(user, id);
  await audit(user.userId, "kanzlei_datei");
  return new Response(uebermittlungsdatei(d), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="Abgabe-${d.year}-${d.id.slice(0, 8)}.xml"`, "Cache-Control": "no-store" },
  });
});
