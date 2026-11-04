import { z } from "zod";
import { audit, checkCredentials, destroySession } from "@/lib/server/auth";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { deleteAccount } from "@/lib/server/repo";

/** Konto löschen (DSGVO Art. 17). Erfordert das Passwort. */
export const DELETE = route({ auth: true, rate: { name: "delete", limit: 5, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const { password } = await parseJson(req, z.object({ password: z.string().min(1).max(128) }));
  const cred = await checkCredentials(user.email, password);
  if (!cred.ok) throw new HttpError(401, "Passwort ist falsch.");
  await audit(user.userId, "account_deleted");
  await deleteAccount(user.userId);
  await destroySession();
  return json({ ok: true });
});
