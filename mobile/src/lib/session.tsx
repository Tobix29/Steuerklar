import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getApiToken, setApiToken, setUnauthorizedHandler } from "./api";
import { deleteSecret, getSecret, KEYS, setSecret } from "./secureStorage";

type Status = "loading" | "signedOut" | "mfa" | "signedIn";

interface SessionCtx {
  status: Status;
  signIn: (email: string, password: string) => Promise<{ mfa: boolean }>;
  verifyMfa: (code: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: (opts?: { remote?: boolean }) => Promise<void>;
  /** Neues Token übernehmen (z. B. nach Aktivierung der 2FA) */
  replaceToken: (token: string) => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("SessionProvider fehlt");
  return c;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  const store = useCallback(async (t: string | null) => {
    setApiToken(t);
    if (t) await setSecret(KEYS.token, t);
    else await deleteSecret(KEYS.token);
  }, []);

  const signOut = useCallback(
    async (opts: { remote?: boolean } = { remote: true }) => {
      if (opts.remote) await api("/api/auth/logout", { method: "POST" }).catch(() => {});
      await store(null);
      setStatus("signedOut");
    },
    [store],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut({ remote: false }));
    (async () => {
      const t = await getSecret(KEYS.token).catch(() => null);
      if (!t) return setStatus("signedOut");
      setApiToken(t);
      try {
        await api("/api/me");
        setStatus("signedIn");
      } catch {
        await store(null);
        setStatus("signedOut");
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [signOut, store]);

  const value = useMemo<SessionCtx>(
    () => ({
      status,
      async signIn(email, password) {
        const r = await api<{ token: string; mfa: boolean }>("/api/auth/login", { json: { email, password } });
        if (r.mfa) {
          // MFA-pendentes Token nur im Speicher halten, nicht persistieren
          setApiToken(r.token);
          setStatus("mfa");
        } else {
          await store(r.token);
          setStatus("signedIn");
        }
        return { mfa: r.mfa };
      },
      async verifyMfa(code) {
        await api("/api/auth/mfa", { json: { code } });
        await store(getApiToken());
        setStatus("signedIn");
      },
      async register(email, password) {
        const r = await api<{ token: string }>("/api/auth/register", { json: { email, password, acceptTerms: true } });
        await store(r.token);
        setStatus("signedIn");
      },
      signOut,
      async replaceToken(t) {
        await store(t);
      },
    }),
    [status, store, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
