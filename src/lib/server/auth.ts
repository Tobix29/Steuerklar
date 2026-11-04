import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { blindIndex, encryptJson, decryptJson, newWrappedDataKey, randomToken, sha256, unwrapDataKey } from "@/lib/security/crypto";
import { q } from "./db";

export const SESSION_COOKIE = "__Host-sk_session";
export type SessionKind = "web" | "mobile";
/** Web: 30 min Leerlauf / 12 h absolut. Mobile: längere Laufzeit, dafür App-Sperre per Face ID/Fingerabdruck. */
const TIMEOUTS: Record<SessionKind, { idle: number; absolute: number }> = {
  web: { idle: 30 * 60 * 1000, absolute: 12 * 60 * 60 * 1000 },
  mobile: { idle: 14 * 24 * 60 * 60 * 1000, absolute: 30 * 24 * 60 * 60 * 1000 },
};
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
  const exists = await q.get("SELECT 1 FROM users WHERE email_idx = ?", idx);
  if (exists) {
    // Gleiche Antwortzeit wie bei Erfolg, keine Aussage ob Konto existiert.
    await hashPassword(password);
    return { ok: false, error: "Registrierung nicht möglich. Bitte melde dich an oder nutze eine andere E-Mail-Adresse." };
  }
  const id = randomUUID();
  const dekWrapped = newWrappedDataKey(id);
  const dek = unwrapDataKey(dekWrapped, id);
  await q.run("INSERT INTO users (id, email_idx, email_enc, password_hash, dek, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, idx, encryptJson(dek, email.trim(), `email:${id}`), await hashPassword(password), dekWrapped, Date.now());
  await audit(id, "register");
  return { ok: true, userId: id };
}

export async function checkCredentials(email: string, password: string): Promise<{ ok: true; user: UserRow } | { ok: false; error: string }> {
  const generic = "E-Mail oder Passwort ist falsch.";
  const row = await q.get("SELECT * FROM users WHERE email_idx = ?", blindIndex(email)) as UserRow | undefined;
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
    await q.run("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?", failed >= MAX_FAILED_LOGINS ? 0 : failed, failed >= MAX_FAILED_LOGINS ? Date.now() + LOCK_MS : 0, row.id);
    await audit(row.id, failed >= MAX_FAILED_LOGINS ? "login_locked" : "login_failed");
    return { ok: false, error: generic };
  }
  await q.run("UPDATE users SET failed_logins = 0, locked_until = 0 WHERE id = ?", row.id);
  return { ok: true, user: row };
}

/* ---------- Sessions ---------- */

/**
 * Legt eine Sitzung an. Web: Token als __Host-Cookie. Mobile: Token wird zurückgegeben und
 * von der App im Secure Enclave/Keystore-geschützten Speicher (Keychain/Keystore) abgelegt.
 */
export async function createSession(userId: string, mfaPending: boolean, kind: SessionKind = "web"): Promise<string> {
  const token = randomToken(32);
  const now = Date.now();
  const t = TIMEOUTS[kind];
  await q.run("INSERT INTO sessions (id_hash, user_id, created_at, last_seen, expires_at, mfa_pending, kind) VALUES (?, ?, ?, ?, ?, ?, ?)", sha256(token), userId, now, now, now + (mfaPending ? 10 * 60 * 1000 : t.absolute), mfaPending ? 1 : 0, kind);
  // Abgelaufene Sessions aufräumen
  await q.run("DELETE FROM sessions WHERE expires_at < ? OR (kind = 'web' AND last_seen < ?) OR (kind = 'mobile' AND last_seen < ?)", now, now - TIMEOUTS.web.idle, now - TIMEOUTS.mobile.idle);
  if (kind === "web") {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: t.absolute / 1000 });
  }
  return token;
}

/** Liest das Sitzungstoken aus dem Cookie (Web) oder dem Authorization-Header (native App). */
async function readToken(): Promise<{ token: string; kind: SessionKind } | null> {
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) return { token: auth.slice(7).trim(), kind: "mobile" };
  const c = (await cookies()).get(SESSION_COOKIE)?.value;
  return c ? { token: c, kind: "web" } : null;
}

export async function requestKind(): Promise<SessionKind> {
  const h = await headers();
  return h.get("authorization")?.startsWith("Bearer ") || h.get("x-client") === "mobile" ? "mobile" : "web";
}

export async function destroySession() {
  const t = await readToken();
  if (t) await q.run("DELETE FROM sessions WHERE id_hash = ?", sha256(t.token));
  if (t?.kind !== "mobile") (await cookies()).delete(SESSION_COOKIE);
}

export interface SessionInfo {
  userId: string;
  mfaPending: boolean;
  idHash: string;
  kind: SessionKind;
}

export async function getSession(): Promise<SessionInfo | null> {
  const t = await readToken();
  if (!t || t.token.length > 100) return null;
  const idHash = sha256(t.token);
  const row = await q.get("SELECT user_id, last_seen, expires_at, mfa_pending, kind FROM sessions WHERE id_hash = ?", idHash) as
    | { user_id: string; last_seen: number; expires_at: number; mfa_pending: number; kind: SessionKind }
    | undefined;
  // Ein Web-Token darf nicht als Bearer-Token verwendet werden und umgekehrt.
  if (!row || row.kind !== t.kind) return null;
  const now = Date.now();
  if (row.expires_at < now || row.last_seen + TIMEOUTS[row.kind].idle < now) {
    await q.run("DELETE FROM sessions WHERE id_hash = ?", idHash);
    return null;
  }
  if (now - row.last_seen > 60_000) await q.run("UPDATE sessions SET last_seen = ? WHERE id_hash = ?", now, idHash);
  return { userId: row.user_id, mfaPending: row.mfa_pending === 1, idHash, kind: row.kind };
}

export async function completeMfa(idHash: string, kind: SessionKind) {
  await q.run("UPDATE sessions SET mfa_pending = 0, expires_at = ? WHERE id_hash = ?", Date.now() + TIMEOUTS[kind].absolute, idHash);
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
  const row = await q.get("SELECT id, dek, email_enc, totp_secret_enc FROM users WHERE id = ?", s.userId) as
    | { id: string; dek: string; email_enc: string; totp_secret_enc: string | null }
    | undefined;
  if (!row) return null;
  const dek = unwrapDataKey(row.dek, row.id);
  return { userId: row.id, dek, email: decryptJson<string>(dek, row.email_enc, `email:${row.id}`), totpEnabled: !!row.totp_secret_enc };
}

export async function revokeAllSessions(userId: string) {
  await q.run("DELETE FROM sessions WHERE user_id = ?", userId);
}

/* ---------- Audit-Log (ohne Klartext-IP, DSGVO-freundlich) ---------- */

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Auf Vercel setzt die Plattform X-Forwarded-For selbst (vertrauenswürdig).
  if (process.env.TRUST_PROXY === "1" || process.env.VERCEL) {
    const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
  }
  return h.get("x-real-ip") ?? "local";
}

export async function audit(userId: string | null, event: string) {
  const ip = await clientIp().catch(() => "unknown");
  await q.run("INSERT INTO audit_log (user_id, event, ip_hash, at) VALUES (?, ?, ?, ?)", userId, event, sha256(`${new Date().toISOString().slice(0, 10)}:${ip}`), Date.now());
}
