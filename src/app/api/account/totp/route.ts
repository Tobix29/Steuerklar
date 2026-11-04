import QRCode from "qrcode";
import { z } from "zod";
import { audit, checkCredentials, revokeAllSessions, createSession, requestKind } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { decryptJson, encryptJson, newTotpSecret, verifyTotp } from "@/lib/security/crypto";

/** Neues Geheimnis + QR-Code erzeugen (noch nicht aktiv). */
export const GET = route({ auth: true, rate: { name: "totp", limit: 20, windowMs: 15 * 60_000 } }, async ({ user }) => {
  const secret = newTotpSecret();
  const uri = `otpauth://totp/Steuerklar:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Steuerklar&algorithm=SHA1&digits=6&period=30`;
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return json({ secret, svg });
});

const EnableSchema = z.object({ action: z.literal("enable"), secret: z.string().regex(/^[A-Z2-7]{32}$/), code: z.string().regex(/^\d{6}$/) });
const DisableSchema = z.object({ action: z.literal("disable"), password: z.string().min(1).max(128), code: z.string().regex(/^\d{6}$/) });

export const POST = route({ auth: true, rate: { name: "totp", limit: 20, windowMs: 15 * 60_000 } }, async ({ req, user }) => {
  const body = await parseJson(req, z.union([EnableSchema, DisableSchema]));
  if (body.action === "enable") {
    const counter = verifyTotp(body.secret, body.code, null);
    if (counter === null) throw new HttpError(400, "Der Code passt nicht. Prüfe die Uhrzeit deines Geräts.");
    await q.run("UPDATE users SET totp_secret_enc = ?, totp_last_counter = ? WHERE id = ?", encryptJson(user.dek, body.secret, `totp:${user.userId}`), counter, user.userId);
    await audit(user.userId, "mfa_enabled");
    // Alle Sitzungen beenden und für dieses Gerät eine neue ausstellen
    await revokeAllSessions(user.userId);
    const kind = await requestKind();
    const token = await createSession(user.userId, false, kind);
    return json(kind === "mobile" ? { ok: true, token } : { ok: true });
  }
  const cred = await checkCredentials(user.email, body.password);
  if (!cred.ok) throw new HttpError(401, "Passwort ist falsch.");
  const row = await q.get("SELECT totp_secret_enc, totp_last_counter FROM users WHERE id = ?", user.userId) as {
    totp_secret_enc: string | null;
    totp_last_counter: number | null;
  };
  if (!row.totp_secret_enc) throw new HttpError(400, "Zwei-Faktor-Anmeldung ist nicht aktiv.");
  const secret = decryptJson<string>(user.dek, row.totp_secret_enc, `totp:${user.userId}`);
  if (verifyTotp(secret, body.code, row.totp_last_counter) === null) throw new HttpError(401, "Der Code ist ungültig.");
  await q.run("UPDATE users SET totp_secret_enc = NULL, totp_last_counter = NULL WHERE id = ?", user.userId);
  await audit(user.userId, "mfa_disabled");
  return json({ ok: true });
});
