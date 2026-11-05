import { z } from "zod";
import { kennzahlen } from "@/lib/abgabe/abgabe";
import { audit } from "@/lib/server/auth";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { abgabeFuerKanzlei, aktion, kanzleiVon, kurz } from "@/lib/server/kanzlei";

const idFrom = (req: Request) => {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "Ungültige ID.");
  return id;
};

async function nurKanzlei(userId: string, totp: boolean) {
  if (!(await kanzleiVon(userId))) throw new HttpError(403, "Kein Kanzlei-Konto.");
  if (!totp) throw new HttpError(403, "Kanzlei-Konten brauchen eine aktive Zwei-Faktor-Anmeldung.");
}

/** Vollständige Abgabe für die Prüfung in der Kanzlei. */
export const GET = route({ auth: true }, async ({ req, user }) => {
  await nurKanzlei(user.userId, user.totpEnabled);
  const d = await abgabeFuerKanzlei(user, idFrom(req));
  await audit(user.userId, "kanzlei_abgabe_angesehen");
  return json({ abgabe: { ...d, kennzahlen: kennzahlen(d.snapshot.result) } });
});

const Body = z.object({
  aktion: z.enum(["nachricht", "pruefen", "rueckfrage", "uebermitteln", "bescheid", "ablehnen"]),
  text: z.string().max(4000).default(""),
  referenz: z.string().max(80).default(""),
});
export const POST = route({ auth: true, rate: { name: "kanzlei-aktion", limit: 300, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  await nurKanzlei(user.userId, user.totpEnabled);
  const body = await parseJson(req, Body, 16 * 1024);
  const d = await aktion(user, idFrom(req), "kanzlei", body.aktion, body.text, body.referenz);
  await audit(user.userId, `kanzlei_${body.aktion}`);
  return json({ abgabe: kurz(d) });
});
