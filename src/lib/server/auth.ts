import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { blindIndex, encryptJson, decryptJson, newWrappedDataKey, randomToken, sha256, unwrapDataKey } from "@/lib/security/crypto";
import { db } from "./db";

export const SESSION_COOKIE = "__Host-sk_session";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 Minuten Inaktivität
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // spätestens nach 12 Stunden neu anmelden
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;

/** OWASP-Empfehlung für Argon2id (m = 19 MiB, t = 2, p = 1). */
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
// Dummy-Hash für konstantes Timing bei unbekannten E-Mails (verhindert User-Enumeration).
let dummyHash: string | null = null;

export async function hashPassword(pw: string) {
  return hash(pw, ARGON);
}

interface UserRow {
  id: string;
  password_hash: string;
  dek: string;
  totp_secret_enc: string | null;
  totp_last_counter: number | null;
  failed_logins: number;
  locked_until: number;
}

export async function registerUser(email: string, password: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const idx = blindIndex(email);
  const exists = db().prepare("SELECT 1 FROM users WHERE email_idx = ?").get(idx);
  if (exists) {
    // Gleiche Antwortzeit wie bei Erfolg, keine Aussage ob Konto existiert.
    await hashPassword(password);
    return { ok: false, error: "Registrierung nicht möglich. Bitte melde dich an oder nutze eine andere E-Mail-Adresse." };
  }
  const id = randomUUID();
  const dekWrapped = newWrappedDataKey(id);
  const dek = unwrapDataKey(dekWrapped, id);
  db()
    .prepare("INSERT INTO users (id, email_idx, email_enc, password_hash, dek, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, idx, encryptJson(dek, email.trim(), `email:${id}`), await hashPassword(password), dekWrapped, Date.now());
  await audit(id, "register");
  return { ok: true, userId: id };
}

export async function checkCredentials(email: string, password: string): Promise<{ ok: true; user: UserRow } | { ok: false; error: string }> {
  const generic = "E-Mail oder Passwort ist falsch.";
  const row = db().prepare("SELECT * FROM users WHERE email_idx = ?").get(blindIndex(email)) as UserRow | undefined;
  if (!row) {
    dummyHash ??= await hashPassword(randomToken());
    await verify(dummyHash, password).catch(() => false);
    return { ok: false, error: generic };
  }
  if (row.locked_until > Date.now()) {
    return { ok: false, error: "Zu viele Fehlversuche. Das Konto ist für 15 Minuten gesperrt." };
  }
  const valid = await verify(row.password_hash, password).catch(() => false);
  if (!valid) {
    const failed = row.failed_logins + 1;
    db()
      .prepare("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?")
      .run(failed >= MAX_FAILED_LOGINS ? 0 : failed, failed >= MAX_FAILED_LOGINS ? Date.now() + LOCK_MS : 0, row.id);
    await audit(row.id, failed >= MAX_FAILED_LOGINS ? "login_locked" : "login_failed");
    return { ok: false, error: generic };
  }
  db().prepare("UPDATE users SET failed_logins = 0, locked_until = 0 WHERE id = ?").run(row.id);
  return { ok: true, user: row };
}

/* ---------- Sessions ---------- */

export async function createSession(userId: string, mfaPending: boolean) {
  const token = randomToken(32);
  const now = Date.now();
  db()
    .prepare("INSERT INTO sessions (id_hash, user_id, created_at, last_seen, expires_at, mfa_pending) VALUES (?, ?, ?, ?, ?, ?)")
    .run(sha256(token), userId, now, now, now + ABSOLUTE_TIMEOUT_MS, mfaPending ? 1 : 0);
  // Alte Sessions aufräumen
  db().prepare("DELETE FROM sessions WHERE expires_at < ? OR last_seen < ?").run(now, now - IDLE_TIMEOUT_MS);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE id_hash = ?").run(sha256(token));
  jar.delete(SESSION_COOKIE);
}

export interface SessionInfo {
  userId: string;
  mfaPending: boolean;
  idHash: string;
}

export async function getSession(): Promise<SessionInfo | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const idHash = sha256(token);
  const row = db().prepare("SELECT user_id, last_seen, expires_at, mfa_pending FROM sessions WHERE id_hash = ?").get(idHash) as
    | { user_id: string; last_seen: number; expires_at: number; mfa_pending: number }
    | undefined;
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at < now || row.last_seen + IDLE_TIMEOUT_MS < now) {
    db().prepare("DELETE FROM sessions WHERE id_hash = ?").run(idHash);
    return null;
  }
  if (now - row.last_seen > 60_000) db().prepare("UPDATE sessions SET last_seen = ? WHERE id_hash = ?").run(now, idHash);
  return { userId: row.user_id, mfaPending: row.mfa_pending === 1, idHash };
}

export async function completeMfa(idHash: string) {
  db().prepare("UPDATE sessions SET mfa_pending = 0 WHERE id_hash = ?").run(idHash);
}

export interface AuthedUser {
  userId: string;
  dek: Buffer;
  email: string;
  totpEnabled: boolean;
}

/** Liefert den angemeldeten Nutzer (vollständig authentifiziert) oder null. */
export async function currentUser(): Promise<AuthedUser | null> {
  const s = await getSession();
  if (!s || s.mfaPending) return null;
  const row = db().prepare("SELECT id, dek, email_enc, totp_secret_enc FROM users WHERE id = ?").get(s.userId) as
    | { id: string; dek: string; email_enc: string; totp_secret_enc: string | null }
    | undefined;
  if (!row) return null;
  const dek = unwrapDataKey(row.dek, row.id);
  return { userId: row.id, dek, email: decryptJson<string>(dek, row.email_enc, `email:${row.id}`), totpEnabled: !!row.totp_secret_enc };
}

export async function revokeAllSessions(userId: string) {
  db().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

/* ---------- Audit-Log (ohne Klartext-IP, DSGVO-freundlich) ---------- */

export async function clientIp(): Promise<string> {
  const h = await headers();
  if (process.env.TRUST_PROXY === "1") {
    const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
  }
  return h.get("x-real-ip") ?? "local";
}

export async function audit(userId: string | null, event: string) {
  const ip = await clientIp().catch(() => "unknown");
  db()
    .prepare("INSERT INTO audit_log (user_id, event, ip_hash, at) VALUES (?, ?, ?, ?)")
    .run(userId, event, sha256(`${new Date().toISOString().slice(0, 10)}:${ip}`), Date.now());
}
