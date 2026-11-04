import { audit, checkCredentials, createSession, requestKind } from "@/lib/server/auth";
import { HttpError, json, parseJson, rateLimit, route } from "@/lib/server/guard";
import { blindIndex } from "@/lib/security/crypto";
import { CredentialsSchema } from "@/lib/server/validation";

export const POST = route({ auth: false, rate: { name: "login", limit: 10, windowMs: 15 * 60_000 } }, async ({ req }) => {
  const body = await parseJson(req, CredentialsSchema);
  // Zusätzlich pro Konto begrenzen (Schutz gegen verteiltes Credential Stuffing)
  if (!rateLimit(`login-acct:${blindIndex(body.email)}`, 10, 15 * 60_000)) throw new HttpError(429, "Zu viele Anmeldeversuche.");
  const res = await checkCredentials(body.email, body.password);
  if (!res.ok) throw new HttpError(401, res.error);
  const mfa = !!res.user.totp_secret_enc;
  const kind = await requestKind();
  const token = await createSession(res.user.id, mfa, kind);
  if (!mfa) await audit(res.user.id, `login_${kind}`);
  return json(kind === "mobile" ? { ok: true, mfa, token } : { ok: true, mfa });
});
