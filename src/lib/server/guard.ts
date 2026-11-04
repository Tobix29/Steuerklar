import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { clientIp, currentUser, type AuthedUser } from "./auth";

/* ---------- Rate Limiting (Sliding Window, In-Memory) ----------
 * Für mehrere Instanzen in Produktion durch Redis/Upstash ersetzen. */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => t > now - windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 50_000) for (const [k, v] of buckets) if (!v.some((t) => t > now - windowMs)) buckets.delete(k);
  return true;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/**
 * CSRF-Schutz (zusätzlich zu SameSite=Strict-Cookies): Zustandsändernde Requests
 * müssen vom eigenen Origin kommen.
 */
function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  // Native App: Bearer-Token bzw. Header „X-Client: mobile“ statt Cookie → kein CSRF-Risiko,
  // denn Browser können diese Header cross-origin nur nach CORS-Preflight setzen, und CORS ist nicht freigegeben.
  const mobile = req.headers.get("authorization")?.startsWith("Bearer ") || req.headers.get("x-client") === "mobile";
  if (mobile && !req.headers.get("cookie")?.includes("__Host-sk_session")) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Ungültige Herkunft der Anfrage.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Ungültige Herkunft der Anfrage.");
  }
  if (originHost !== host) throw new HttpError(403, "Ungültige Herkunft der Anfrage.");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) throw new HttpError(403, "Cross-Site-Anfrage blockiert.");
}

interface Options {
  auth?: boolean;
  rate?: { name: string; limit: number; windowMs: number };
}

type Handler<A extends boolean> = (ctx: { req: Request; user: A extends true ? AuthedUser : AuthedUser | null }) => Promise<Response>;

export function route<A extends boolean = true>(opts: Options & { auth?: A }, handler: Handler<A>) {
  return async (req: Request): Promise<Response> => {
    try {
      assertSameOrigin(req);
      if (opts.rate) {
        const ip = await clientIp();
        if (!rateLimit(`${opts.rate.name}:${ip}`, opts.rate.limit, opts.rate.windowMs))
          throw new HttpError(429, "Zu viele Anfragen. Bitte warte einen Moment.");
      }
      const user = await currentUser();
      if (opts.auth !== false && !user) throw new HttpError(401, "Bitte melde dich an.");
      return await handler({ req, user: user as never });
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      // Keine internen Details nach außen geben.
      console.error("[api]", err instanceof Error ? err.message : err);
      return json({ error: "Interner Fehler. Bitte versuche es erneut." }, 500);
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>, maxBytes = 256 * 1024): Promise<T> {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "JSON erwartet.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Anfrage zu groß.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Ungültiges JSON.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new HttpError(400, "Ungültige Eingabe: " + parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).slice(0, 3).join("; "));
  return parsed.data;
}
