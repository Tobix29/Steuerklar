import { createSession, registerUser } from "@/lib/server/auth";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { RegisterSchema } from "@/lib/server/validation";

export const POST = route({ auth: false, rate: { name: "register", limit: 5, windowMs: 60 * 60_000 } }, async ({ req }) => {
  const body = await parseJson(req, RegisterSchema);
  const res = await registerUser(body.email, body.password);
  if (!res.ok) throw new HttpError(400, res.error);
  await createSession(res.userId, false);
  return json({ ok: true });
});
