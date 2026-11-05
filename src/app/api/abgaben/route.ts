import { z } from "zod";
import { audit } from "@/lib/server/auth";
import { json, parseJson, route } from "@/lib/server/guard";
import { freigeben, kurz, meineAbgaben } from "@/lib/server/kanzlei";
import { parseYear } from "@/lib/server/repo";

export const GET = route({ auth: true }, async ({ req, user }) => {
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  return json({ abgaben: await meineAbgaben(user, year) });
});

const Freigabe = z.object({ year: z.number().int(), kanzleiId: z.string().uuid(), bestaetigung: z.literal(true) });
/** Steuerfall zur Abgabe durch die Kanzlei freigeben (neuer, unveränderlicher Snapshot). */
export const POST = route({ auth: true, rate: { name: "abgabe", limit: 20, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const body = await parseJson(req, Freigabe, 1024);
  const d = await freigeben(user, parseYear(String(body.year)), body.kanzleiId);
  await audit(user.userId, "abgabe_freigegeben");
  return json({ abgabe: kurz(d) }, 201);
});
