"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { api } from "@/lib/client/api";

interface Me { email: string; totpEnabled: boolean; aiEnabled: boolean }

export default function Konto() {
  const router = useRouter();
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [setup, setSetup] = useState<{ secret: string; svg: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [danger, setDanger] = useState<"disable2fa" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api<Me>("/api/me").then(setMe);
  useEffect(() => void load(), []);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setError(null);
    try {
      await fn();
      toast.show(ok);
      setCode("");
      setPassword("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      return false;
    }
  }

  return (
    <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Konto</p>
          <h1 className="title">Sicherheit & Daten</h1>
          {me && <p className="muted" style={{ margin: "6px 0 0" }}>{me.email}</p>}
        </div>
      </header>
      {error && <div className="notice notice-red small" role="alert">{error}</div>}

      <section className="card card-lg stack">
        <div className="row-between">
          <div className="row">
            <span className="icon-tile">🛡️</span>
            <div>
              <h2 className="title-2">Zwei-Faktor-Anmeldung</h2>
              <p className="small muted" style={{ margin: 0 }}>Schützt dein Konto zusätzlich mit einem Code aus einer Authenticator-App.</p>
            </div>
          </div>
          {me && <span className={`badge ${me.totpEnabled ? "badge-green" : "badge-orange"}`}>{me.totpEnabled ? "Aktiv" : "Aus"}</span>}
        </div>

        {me && !me.totpEnabled && !setup && (
          <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => api<{ secret: string; svg: string }>("/api/account/totp").then(setSetup)}>
            Einrichten
          </button>
        )}
        {setup && (
          <div className="grid grid-2" style={{ alignItems: "center" }}>
            <div className="qr" dangerouslySetInnerHTML={{ __html: setup.svg }} />
            <div className="stack">
              <p className="small" style={{ margin: 0 }}>1. Scanne den QR-Code mit einer Authenticator-App (z. B. Passwörter-App, 1Password, Google Authenticator).</p>
              <p className="tiny muted mono" style={{ margin: 0, wordBreak: "break-all" }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
              <p className="small" style={{ margin: 0 }}>2. Gib den angezeigten Code ein:</p>
              <input className="input code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} aria-label="Code" onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button
                className="btn"
                disabled={code.length !== 6}
                onClick={async () => {
                  if (await run(() => api("/api/account/totp", { method: "POST", json: { action: "enable", secret: setup.secret, code } }), "Zwei-Faktor-Anmeldung aktiviert")) {
                    setSetup(null);
                    void load();
                  }
                }}
              >
                Aktivieren
              </button>
            </div>
          </div>
        )}
        {me?.totpEnabled && danger !== "disable2fa" && (
          <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => setDanger("disable2fa")}>Deaktivieren</button>
        )}
        {danger === "disable2fa" && (
          <div className="stack">
            <input className="input" type="password" placeholder="Passwort" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <input className="input" inputMode="numeric" placeholder="6-stelliger Code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <div className="row">
              <button className="btn btn-danger" onClick={async () => {
                if (await run(() => api("/api/account/totp", { method: "POST", json: { action: "disable", password, code } }), "Zwei-Faktor-Anmeldung deaktiviert")) {
                  setDanger(null);
                  void load();
                }
              }}>Deaktivieren</button>
              <button className="btn btn-ghost" onClick={() => setDanger(null)}>Abbrechen</button>
            </div>
          </div>
        )}
      </section>

      <section>
        <p className="section-label">Datenschutz</p>
        <div className="list">
          <div className="list-item">
            <span className="icon-tile">🔐</span>
            <div className="grow">
              <div>Verschlüsselung</div>
              <div className="tiny muted">AES-256-GCM mit persönlichem Schlüssel · Belegfotos werden nicht gespeichert</div>
            </div>
            <span className="badge badge-green">Aktiv</span>
          </div>
          <div className="list-item">
            <span className="icon-tile">🤖</span>
            <div className="grow">
              <div>KI-Belegerkennung</div>
              <div className="tiny muted">Verarbeitung über die Claude API (Anthropic), keine Nutzung zum Training</div>
            </div>
            {me && <span className={`badge ${me.aiEnabled ? "badge-green" : "badge-orange"}`}>{me.aiEnabled ? "Aktiv" : "Demo"}</span>}
          </div>
          <a className="list-item" href="/api/account/export" style={{ color: "var(--text)" }}>
            <span className="icon-tile">📦</span>
            <div className="grow">
              <div>Meine Daten exportieren</div>
              <div className="tiny muted">Alle gespeicherten Daten als JSON (Art. 20 DSGVO)</div>
            </div>
            <span className="muted">›</span>
          </a>
        </div>
      </section>

      <section className="card stack" style={{ border: "1px solid var(--red-soft)" }}>
        <h2 className="title-2" style={{ color: "var(--red)" }}>Konto löschen</h2>
        <p className="small muted" style={{ margin: 0 }}>Löscht dein Konto und alle Steuerdaten unwiderruflich (Art. 17 DSGVO). Der persönliche Schlüssel wird vernichtet.</p>
        {danger !== "delete" ? (
          <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setDanger("delete")}>Konto löschen …</button>
        ) : (
          <div className="stack">
            <input className="input" type="password" placeholder="Passwort zur Bestätigung" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="row">
              <button className="btn btn-danger" disabled={!password} onClick={async () => {
                if (await run(() => api("/api/account", { method: "DELETE", json: { password } }), "Konto gelöscht")) {
                  router.replace("/");
                  router.refresh();
                }
              }}>Endgültig löschen</button>
              <button className="btn btn-ghost" onClick={() => setDanger(null)}>Abbrechen</button>
            </div>
          </div>
        )}
      </section>
      {toast.node}
    </div>
  );
}
