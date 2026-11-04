"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";

export function LoginForm({ expired }: { expired: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === "password") {
        const r = await api<{ mfa: boolean }>("/api/auth/login", { method: "POST", json: { email, password } });
        setPassword("");
        if (r.mfa) {
          setStep("mfa");
          return;
        }
      } else {
        await api("/api/auth/mfa", { method: "POST", json: { code } });
      }
      router.replace("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card fade-in">
      <div className="center" style={{ marginBottom: 28 }}>
        <div className="brand-mark" style={{ width: 56, height: 56, borderRadius: 16, fontSize: 28, margin: "0 auto 18px" }}>✓</div>
        <h1 className="title">{step === "password" ? "Willkommen zurück" : "Bestätigungscode"}</h1>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {step === "password" ? "Melde dich bei Steuerklar an." : "Gib den 6-stelligen Code aus deiner Authenticator-App ein."}
        </p>
      </div>
      <form className="card card-lg stack" onSubmit={submit} noValidate>
        {expired && step === "password" && <div className="notice notice-orange small">Deine Sitzung ist aus Sicherheitsgründen abgelaufen.</div>}
        {error && <div className="notice notice-red small" role="alert">{error}</div>}
        {step === "password" ? (
          <>
            <div className="field">
              <label htmlFor="email">E-Mail</label>
              <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">Passwort</label>
              <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </>
        ) : (
          <input
            className="input code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            aria-label="Bestätigungscode"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        )}
        <button className="btn btn-block btn-lg" disabled={busy || (step === "mfa" && code.length !== 6)}>
          {busy ? <span className="spinner" /> : step === "password" ? "Anmelden" : "Bestätigen"}
        </button>
      </form>
      <p className="center small muted" style={{ marginTop: 20 }}>
        Noch kein Konto? <Link href="/registrieren">Jetzt registrieren</Link>
      </p>
    </div>
  );
}
