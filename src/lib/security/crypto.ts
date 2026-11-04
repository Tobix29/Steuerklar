import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Envelope-Verschlüsselung (AES-256-GCM):
 *  - Master Key (KEK) kommt aus der Umgebung / einem KMS (DATA_ENCRYPTION_KEY, 32 Byte Base64).
 *  - Jede:r Nutzer:in hat einen eigenen Data Key (DEK), der mit dem KEK verschlüsselt gespeichert wird.
 *  - Alle Steuerdaten werden mit dem DEK verschlüsselt; die AAD bindet den Ciphertext an
 *    Nutzer-ID + Datensatz, sodass Ciphertexte nicht zwischen Datensätzen vertauscht werden können.
 * Produktion: KEK in AWS KMS / GCP KMS / HashiCorp Vault halten und rotieren (Feld `v` = Key-Version).
 */

const VERSION = 1;

let cachedKek: Buffer | null = null;
function kek(): Buffer {
  if (cachedKek) return cachedKek;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY fehlt");
    // Nur Entwicklung: deterministischer Schlüssel, damit lokale Daten Neustarts überleben.
    console.warn("[security] DATA_ENCRYPTION_KEY nicht gesetzt – unsicherer Entwicklungsschlüssel aktiv.");
    cachedKek = createHash("sha256").update("steuerklar-dev-only-key").digest();
    return cachedKek;
  }
  // Bevorzugt: 32 Byte als Base64 (openssl rand -base64 32). Alternativ: zufällige Zeichenkette mit
  // mindestens 40 Zeichen (z. B. aus einem Passwort-Generator) – daraus wird per HKDF-SHA256 der Schlüssel abgeleitet.
  const decoded = /^[A-Za-z0-9+/]{43}=$/.test(raw.trim()) ? Buffer.from(raw.trim(), "base64") : null;
  let key: Buffer;
  if (decoded && decoded.length === 32) key = decoded;
  else if (raw.length >= 40) key = Buffer.from(hkdfSync("sha256", raw, "steuerklar-kek-salt-v1", "steuerklar kek", 32));
  else throw new Error("DATA_ENCRYPTION_KEY muss 32 Byte (Base64) oder eine Zufallszeichenkette mit mindestens 40 Zeichen sein");
  cachedKek = key;
  return key;
}

function seal(key: Buffer, plaintext: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${VERSION}.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

function open(key: Buffer, sealed: string, aad: string): Buffer {
  const [v, ivB, tagB, ctB] = sealed.split(".");
  if (v !== `v${VERSION}` || !ivB || !tagB || ctB === undefined) throw new Error("Ungültiges Chiffrat");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]);
}

export function newWrappedDataKey(userId: string): string {
  return seal(kek(), randomBytes(32), `dek:${userId}`);
}

export function unwrapDataKey(wrapped: string, userId: string): Buffer {
  return open(kek(), wrapped, `dek:${userId}`);
}

export function encryptJson(dek: Buffer, value: unknown, aad: string): string {
  return seal(dek, Buffer.from(JSON.stringify(value), "utf8"), aad);
}

export function decryptJson<T>(dek: Buffer, sealed: string, aad: string): T {
  return JSON.parse(open(dek, sealed, aad).toString("utf8")) as T;
}

/** Nicht-umkehrbarer, geschlüsselter Hash (z. B. für E-Mail-Lookup ohne Klartext-Index). */
export function blindIndex(value: string): string {
  return createHmac("sha256", kek()).update(`idx:${value.trim().toLowerCase()}`).digest("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/* ---------- TOTP (RFC 6238) für Zwei-Faktor-Authentifizierung ---------- */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx < 0) throw new Error("Ungültiges Base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpCode(secretB32: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secretB32)).update(msg).digest();
  const offset = h[h.length - 1]! & 0xf;
  const bin = ((h[offset]! & 0x7f) << 24) | (h[offset + 1]! << 16) | (h[offset + 2]! << 8) | h[offset + 3]!;
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Prüft einen TOTP-Code (±1 Zeitfenster). Gibt den verwendeten Counter zurück (Replay-Schutz). */
export function verifyTotp(secretB32: string, code: string, lastUsedCounter: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(Date.now() / 30_000);
  for (const c of [now - 1, now, now + 1]) {
    if (lastUsedCounter !== null && c <= lastUsedCounter) continue;
    if (safeEqual(totpCode(secretB32, c), code)) return c;
  }
  return null;
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}
