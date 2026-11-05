import { z } from "zod";
import { audit } from "@/lib/server/auth";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { aktion, kurz } from "@/lib/server/kanzlei";

const idFrom = (req: Request) => {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "Ungültige ID.");
  return id;
};

const Body = z.object({ aktion: z.enum(["nachricht", "zurueckziehen"]), text: z.string().max(4000).default("") });
/** Mandant:in: Nachricht an die Kanzlei oder Abgabe zurückziehen. */
export const POST = route({ auth: true, rate: { name: "abgabe-aktion", limit: 120, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const body = await parseJson(req, Body, 16 * 1024);
  const d = await aktion(user, idFrom(req), "mandant", body.aktion, body.text);
  await audit(user.userId, `abgabe_${body.aktion}`);
  return json({ abgabe: kurz(d) });
});
