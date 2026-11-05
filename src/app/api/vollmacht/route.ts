import { z } from "zod";
import { audit } from "@/lib/server/auth";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { kanzleiPerCode, vollmachten, vollmachtErteilen, vollmachtWiderrufen } from "@/lib/server/kanzlei";

export const GET = route({ auth: true }, async ({ user }) => json({ vollmachten: await vollmachten(user.userId) }));

const Erteilen = z.object({ code: z.string().min(4).max(20), zustimmung: z.literal(true) });
/** Vollmacht an eine Kanzlei erteilen (per Kanzlei-Code). */
export const POST = route({ auth: true, rate: { name: "vollmacht", limit: 20, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const body = await parseJson(req, Erteilen, 1024);
  const k = await kanzleiPerCode(body.code);
  if (!k) throw new HttpError(404, "Keine Kanzlei mit diesem Code gefunden.");
  const v = await vollmachtErteilen(user, k);
  await audit(user.userId, "vollmacht_erteilt");
  return json({ vollmacht: v }, 201);
});

const Widerruf = z.object({ id: z.string().uuid() });
export const DELETE = route({ auth: true }, async ({ req, user }) => {
  const body = await parseJson(req, Widerruf, 1024);
  await vollmachtWiderrufen(user, body.id);
  await audit(user.userId, "vollmacht_widerrufen");
  return json({ ok: true });
});
