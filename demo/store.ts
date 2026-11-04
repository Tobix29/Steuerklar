/**
 * Speicher der Artifact-Demo.
 *  - Angemeldete Viewer: `db`-Capability unter `data/users/<id>/` – privat, nicht einmal für die Besitzerin lesbar,
 *    bleibt über Geräte und Neuveröffentlichungen erhalten.
 *  - Sonst: localStorage des Browsers, als letzte Rückfallebene nur im Arbeitsspeicher.
 */
import type { StoredDocument } from "@/lib/server/repo";
import { emptyCase, TaxCaseSchema, type TaxCase } from "@/lib/tax/types";
import type { TaxYear } from "@/lib/tax/constants";

export interface Store {
  kind: "konto" | "browser" | "sitzung";
  getCase(year: TaxYear): Promise<TaxCase>;
  setCase(c: TaxCase): Promise<void>;
  listDocs(year: number): Promise<StoredDocument[]>;
  getDoc(id: string): Promise<StoredDocument | null>;
  putDoc(d: StoredDocument): Promise<void>;
  delDoc(id: string): Promise<void>;
  clear(): Promise<void>;
}

type Claude = { use: (name: string) => Promise<any> };
const claude = (): Claude | undefined => (window as unknown as { claude?: Claude }).claude;

const parseCase = (raw: unknown, year: TaxYear): TaxCase => {
  const p = TaxCaseSchema.safeParse(raw);
  return p.success ? p.data : emptyCase(year);
};

async function dbStore(): Promise<Store | null> {
  const c = claude();
  if (!c) return null;
  const [db, user] = await Promise.all([c.use("db"), c.use("user")]);
  if (!db || !user) return null;
  const uid: string | null = await user.id();
  if (!uid) return null;
  const base = `data/users/${uid}`;
  const col = db.collection(base);
  return {
    kind: "konto",
    async getCase(year) {
      const snap = await db.doc(`${base}/case-${year}`).get();
      return snap.exists ? parseCase(JSON.parse(String(snap.data()?.json ?? "null")), year) : emptyCase(year);
    },
    async setCase(c) {
      await db.doc(`${base}/case-${c.year}`).set({ kind: "case", year: c.year, json: JSON.stringify(c) });
    },
    async listDocs(year) {
      const snap = await col.get();
      return snap.docs
        .map((d: { data(): Record<string, unknown> | undefined }) => d.data())
        .filter((d: Record<string, unknown> | undefined) => d?.kind === "doc" && d.year === year)
        .map((d: Record<string, unknown>) => JSON.parse(String(d.json)) as StoredDocument)
        .sort((a: StoredDocument, b: StoredDocument) => b.uploadedAt - a.uploadedAt);
    },
    async getDoc(id) {
      const snap = await db.doc(`${base}/doc-${id}`).get();
      return snap.exists ? (JSON.parse(String(snap.data()?.json)) as StoredDocument) : null;
    },
    async putDoc(d) {
      await db.doc(`${base}/doc-${d.id}`).set({ kind: "doc", year: d.year, json: JSON.stringify(d) });
    },
    async delDoc(id) {
      await db.doc(`${base}/doc-${id}`).delete();
    },
    async clear() {
      const snap = await col.get();
      for (const d of snap.docs) await db.doc(`${base}/${d.id}`).delete();
    },
  };
}

function localStore(): Store {
  const KEY = "steuerklar_demo_v1";
  let mem: { cases: Record<string, TaxCase>; docs: Record<string, StoredDocument> } = { cases: {}, docs: {} };
  let persistent = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) mem = JSON.parse(raw);
  } catch {
    persistent = false;
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(mem));
    } catch {
      persistent = false;
    }
  };
  return {
    get kind() {
      return persistent ? ("browser" as const) : ("sitzung" as const);
    },
    async getCase(year) {
      return mem.cases[year] ? parseCase(mem.cases[year], year) : emptyCase(year);
    },
    async setCase(c) {
      mem.cases[c.year] = c;
      save();
    },
    async listDocs(year) {
      return Object.values(mem.docs).filter((d) => d.year === year).sort((a, b) => b.uploadedAt - a.uploadedAt);
    },
    async getDoc(id) {
      return mem.docs[id] ?? null;
    },
    async putDoc(d) {
      mem.docs[d.id] = d;
      save();
    },
    async delDoc(id) {
      delete mem.docs[id];
      save();
    },
    async clear() {
      mem = { cases: {}, docs: {} };
      save();
    },
  };
}

let storePromise: Promise<Store> | null = null;

export function store(): Promise<Store> {
  storePromise ??= dbStore()
    .catch(() => null)
    .then((s) => s ?? localStore());
  return storePromise;
}
