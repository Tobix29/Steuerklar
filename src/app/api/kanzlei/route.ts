import { z } from "zod";
import { audit } from "@/lib/server/auth";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { kanzleiAnlegen, kanzleiUebersicht } from "@/lib/server/kanzlei";
import { safeEqual } from "@/lib/security/crypto";

/** Kanzlei-Dashboard: eigene Kanzlei, Mandantenzahl, Abgaben. `kanzlei: null`, wenn das Konto keiner Kanzlei angehört. */
export const GET = route({ auth: true }, async ({ user }) => {
  const u = await kanzleiUebersicht(user);
  if (!u) return json({ kanzlei: null, setupMoeglich: !!process.env.KANZLEI_SETUP_TOKEN });
  if (!user.totpEnabled) return json({ kanzlei: { ...u.kanzlei, code: "" }, mandanten: 0, abgaben: [], totpNoetig: true });
  return json(u);
});

const Setup = z.object({ name: z.string().min(3).max(200), token: z.string().min(16).max(200) });
/**
 * Kanzlei anlegen. Geschützt durch ein Einrichtungs-Token (KANZLEI_SETUP_TOKEN), das der Betreiber nur an
 * berufsberechtigte Partnerkanzleien weitergibt.
 */
export const POST = route({ auth: true, rate: { name: "kanzlei-setup", limit: 5, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const body = await parseJson(req, Setup, 2048);
  const expected = process.env.KANZLEI_SETUP_TOKEN;
  if (!expected || !safeEqual(body.token, expected)) throw new HttpError(403, "Ungültiges Einrichtungs-Token.");
  if (!user.totpEnabled) throw new HttpError(403, "Kanzlei-Konten brauchen eine aktive Zwei-Faktor-Anmeldung (Konto → Sicherheit).");
  const k = await kanzleiAnlegen(user, body.name);
  await audit(user.userId, "kanzlei_angelegt");
  return json({ kanzlei: k }, 201);
});
