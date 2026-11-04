"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/client/api";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = useMemo(() => strength(password), [password]);
  const labels = ["Zu kurz", "Schwach", "Okay", "Gut", "Sehr stark"];
  const colors = ["var(--red)", "var(--red)", "var(--orange)", "var(--green)", "var(--green)"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/register", { method: "POST", json: { email, password, acceptTerms: accept } });
      router.replace("/app/profil");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card fade-in">
      <div className="center" style={{ marginBottom: 28 }}>
        <div className="brand-mark" style={{ width: 56, height: 56, borderRadius: 16, fontSize: 28, margin: "0 auto 18px" }}>✓</div>
        <h1 className="title">Konto erstellen</h1>
        <p className="muted" style={{ margin: "8px 0 0" }}>In wenigen Minuten zu deinem Steuerausgleich.</p>
      </div>
      <form className="card card-lg stack" onSubmit={submit} noValidate>
        {error && <div className="notice notice-red small" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Passwort</label>
          <input id="password" className="input" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} />
          {password && (
            <div className="row" style={{ gap: 8 }}>
              <div className="progress" style={{ flex: 1 }}>
                <div style={{ width: `${(s / 4) * 100}%`, background: colors[s] }} />
              </div>
              <span className="tiny" style={{ color: colors[s] }}>{labels[s]}</span>
            </div>
          )}
          <span className="help">Mindestens 12 Zeichen. Eine Passphrase aus mehreren Wörtern ist ideal.</span>
        </div>
        <label className="row small" style={{ alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
          <span className="muted">
            Ich akzeptiere die AGB und die Datenschutzerklärung. Mir ist bewusst, dass Steuerklar eine Software zur Selbsthilfe ist und keine
            Steuerberatung erbringt.
          </span>
        </label>
        <button className="btn btn-block btn-lg" disabled={busy || !accept || password.length < 12 || !email}>
          {busy ? <span className="spinner" /> : "Konto erstellen"}
        </button>
        <p className="tiny muted center" style={{ margin: 0 }}>🔐 Deine Daten werden mit einem persönlichen Schlüssel verschlüsselt gespeichert.</p>
      </form>
      <p className="center small muted" style={{ marginTop: 20 }}>
        Schon registriert? <Link href="/anmelden">Anmelden</Link>
      </p>
    </div>
  );
}
