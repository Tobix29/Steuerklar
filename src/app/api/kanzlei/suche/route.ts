import { HttpError, json, route } from "@/lib/server/guard";
import { kanzleiPerCode } from "@/lib/server/kanzlei";

/** Kanzlei per Code finden (nur Name, damit Mandant:innen vor der Vollmacht sehen, wem sie sie erteilen). */
export const GET = route({ auth: true, rate: { name: "kanzlei-suche", limit: 30, windowMs: 60 * 60_000 } }, async ({ req }) => {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (code.length < 4 || code.length > 20) throw new HttpError(400, "Ungültiger Code.");
  const k = await kanzleiPerCode(code);
  if (!k) throw new HttpError(404, "Keine Kanzlei mit diesem Code gefunden.");
  return json({ kanzlei: { id: k.id, name: k.name } });
});
