import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Persistenz mit zwei Treibern hinter einer gemeinsamen, asynchronen Schnittstelle:
 *  - PostgreSQL, wenn DATABASE_URL (bzw. POSTGRES_URL) gesetzt ist – z. B. Neon über den Vercel Marketplace (EU-Region wählen).
 *  - SQLite (node:sqlite) für lokale Entwicklung. Auf Vercel ohne Datenbank landet SQLite in /tmp und ist NICHT dauerhaft.
 * Alle personenbezogenen Inhalte liegen ausschließlich verschlüsselt in der DB (siehe crypto.ts).
 * SQL wird mit `?`-Platzhaltern geschrieben; für Postgres werden sie in $1, $2 … umgeschrieben.
 */

type Param = string | number | null;

interface Db {
  driver: "postgres" | "sqlite";
  persistent: boolean;
  get<T>(sql: string, ...params: Param[]): Promise<T | undefined>;
  all<T>(sql: string, ...params: Param[]): Promise<T[]>;
  run(sql: string, ...params: Param[]): Promise<void>;
}

const schema = (pg: boolean) => `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email_idx TEXT NOT NULL UNIQUE,
    email_enc TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    dek TEXT NOT NULL,
    totp_secret_enc TEXT,
    totp_last_counter BIGINT,
    failed_logins INTEGER NOT NULL DEFAULT 0,
    locked_until BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    last_seen BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    mfa_pending INTEGER NOT NULL DEFAULT 0,
    kind TEXT NOT NULL DEFAULT 'web'
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS cases (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    data_enc TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, year)
  );
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    data_enc TEXT NOT NULL,
    created_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS documents_user_year ON documents(user_id, year);
  CREATE TABLE IF NOT EXISTS kanzleien (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kanzlei_mitglieder (
    kanzlei_id TEXT NOT NULL REFERENCES kanzleien(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rolle TEXT NOT NULL DEFAULT 'berater',
    PRIMARY KEY (kanzlei_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS vollmachten (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kanzlei_id TEXT NOT NULL REFERENCES kanzleien(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    erteilt_at BIGINT NOT NULL,
    widerrufen_at BIGINT
  );
  CREATE INDEX IF NOT EXISTS vollmachten_user ON vollmachten(user_id);
  CREATE INDEX IF NOT EXISTS vollmachten_kanzlei ON vollmachten(kanzlei_id);
  CREATE TABLE IF NOT EXISTS abgaben (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kanzlei_id TEXT NOT NULL REFERENCES kanzleien(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    status TEXT NOT NULL,
    dek TEXT NOT NULL,
    data_enc TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS abgaben_user ON abgaben(user_id, year);
  CREATE INDEX IF NOT EXISTS abgaben_kanzlei ON abgaben(kanzlei_id, status);
  CREATE TABLE IF NOT EXISTS audit_log (
    id ${pg ? "BIGSERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT"},
    user_id TEXT,
    event TEXT NOT NULL,
    ip_hash TEXT,
    at BIGINT NOT NULL
  );
`;

/** Ersetzt `?`-Platzhalter durch $1, $2 … (die SQL-Strings im Projekt enthalten keine literalen Fragezeichen). */
function toPostgresPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => "$" + String(++i));
}

async function createPostgres(url: string): Promise<Db> {
  const { default: pg } = await import("pg");
  // BIGINT (OID 20) als Zahl liefern – Zeitstempel in ms liegen weit unter 2^53.
  pg.types.setTypeParser(20, (v: string) => Number(v));
  const pool = new pg.Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10_000,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true },
  });
  await pool.query(schema(true));
  return {
    driver: "postgres",
    persistent: true,
    async get<T>(sql: string, ...params: Param[]) {
      return (await pool.query(toPostgresPlaceholders(sql), params)).rows[0] as T | undefined;
    },
    async all<T>(sql: string, ...params: Param[]) {
      return (await pool.query(toPostgresPlaceholders(sql), params)).rows as T[];
    },
    async run(sql: string, ...params: Param[]) {
      await pool.query(toPostgresPlaceholders(sql), params);
    },
  };
}

async function createSqlite(): Promise<Db> {
  const { DatabaseSync } = await import("node:sqlite");
  const onVercel = !!process.env.VERCEL;
  const file = process.env.DATABASE_PATH ?? (onVercel ? "/tmp/steuerklar.db" : path.join(process.cwd(), "data", "steuerklar.db"));
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;");
  db.exec(schema(false));
  const cols = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "kind")) db.exec("ALTER TABLE sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'web'");
  if (onVercel) console.warn("[db] Keine DATABASE_URL gesetzt – Daten liegen in /tmp und gehen verloren.");
  return {
    driver: "sqlite",
    persistent: !onVercel,
    async get<T>(sql: string, ...params: Param[]) {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    async all<T>(sql: string, ...params: Param[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async run(sql: string, ...params: Param[]) {
      db.prepare(sql).run(...params);
    },
  };
}

const g = globalThis as unknown as { __steuerklarDb?: Promise<Db> };

function instance(): Promise<Db> {
  if (!g.__steuerklarDb) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    g.__steuerklarDb = (url ? createPostgres(url) : createSqlite()).catch((err: unknown) => {
      g.__steuerklarDb = undefined; // beim nächsten Request erneut versuchen
      throw err;
    });
  }
  return g.__steuerklarDb;
}

/** Datenbankzugriff: `await q.get(sql, …)`, `await q.all(…)`, `await q.run(…)`. */
export const q = {
  get: async <T>(sql: string, ...p: Param[]) => (await instance()).get<T>(sql, ...p),
  all: async <T>(sql: string, ...p: Param[]) => (await instance()).all<T>(sql, ...p),
  run: async (sql: string, ...p: Param[]) => (await instance()).run(sql, ...p),
  info: async () => {
    const d = await instance();
    return { driver: d.driver, persistent: d.persistent };
  },
};
