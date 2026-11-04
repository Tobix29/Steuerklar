import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Persistenz (SQLite über das in Node eingebaute `node:sqlite`, keine nativen Abhängigkeiten).
 * Alle personenbezogenen Inhalte liegen ausschließlich verschlüsselt in der DB (siehe crypto.ts).
 * Produktion: PostgreSQL (EU-Region) mit Verschlüsselung at rest + Backups – Schema ist kompatibel gehalten.
 */

const globalForDb = globalThis as unknown as { __steuerklarDb?: DatabaseSync };

function init(): DatabaseSync {
  const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "steuerklar.db");
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA secure_delete = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email_idx TEXT NOT NULL UNIQUE,
      email_enc TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      dek TEXT NOT NULL,
      totp_secret_enc TEXT,
      totp_last_counter INTEGER,
      failed_logins INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      mfa_pending INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS cases (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      data_enc TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, year)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      data_enc TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS documents_user_year ON documents(user_id, year);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      event TEXT NOT NULL,
      ip_hash TEXT,
      at INTEGER NOT NULL
    );
  `);
  return db;
}

export function db(): DatabaseSync {
  if (!globalForDb.__steuerklarDb) globalForDb.__steuerklarDb = init();
  return globalForDb.__steuerklarDb;
}
