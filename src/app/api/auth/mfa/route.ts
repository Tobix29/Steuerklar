import { audit, completeMfa, getSession } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { decryptJson, unwrapDataKey, verifyTotp } from "@/lib/security/crypto";
import { CodeSchema } from "@/lib/server/validation";

export const POST = route({ auth: false, rate: { name: "mfa", limit: 10, windowMs: 15 * 60_000 } }, async ({ req }) => {
  const { code } = await parseJson(req, CodeSchema);
  const s = await getSession();
  if (!s || !s.mfaPending) throw new HttpError(401, "Sitzung abgelaufen. Bitte erneut anmelden.");
  const row = await q.get("SELECT dek, totp_secret_enc, totp_last_counter FROM users WHERE id = ?", s.userId) as
    | { dek: string; totp_secret_enc: string | null; totp_last_counter: number | null }
    | undefined;
  if (!row?.totp_secret_enc) throw new HttpError(400, "Zwei-Faktor-Anmeldung ist nicht aktiv.");
  const secret = decryptJson<string>(unwrapDataKey(row.dek, s.userId), row.totp_secret_enc, `totp:${s.userId}`);
  const counter = verifyTotp(secret, code, row.totp_last_counter);
  if (counter === null) {
    await audit(s.userId, "mfa_failed");
    throw new HttpError(401, "Der Code ist ungültig.");
  }
  await q.run("UPDATE users SET totp_last_counter = ? WHERE id = ?", counter, s.userId);
  await completeMfa(s.idHash, s.kind);
  await audit(s.userId, `login_${s.kind}`);
  return json({ ok: true });
});
