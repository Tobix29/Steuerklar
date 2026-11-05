"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { api, eur } from "@/lib/client/api";
import { FREIGABE_TEXT, pruefliste, STATUS, VOLLMACHT_TEXT, formulare, type AbgabeStatus, type Ereignis, type Nachricht, type PruefPunkt } from "@/lib/abgabe/abgabe";
import { useCase } from "../CaseContext";

interface Vollmacht { id: string; kanzleiId: string; kanzleiName: string; text: string; erteiltAt: number; widerrufenAt: number | null }
interface Abgabe {
  id: string; year: number; kanzleiName: string; status: AbgabeStatus; statusLabel: string; gutschrift: number; formulare: string[]; version: number;
  uebermittlung: { at: number; referenz: string } | null; ereignisse: Ereignis[]; nachrichten: Nachricht[]; pruefliste: PruefPunkt[]; hash: string; freigabe: { at: number };
}

import { Pruefliste, TON, Verlauf, zeit } from "./Teile";

export default function AbgabeSeite() {
  const { data, result, year, documentCount } = useCase();
  const [vm, setVm] = useState<Vollmacht[] | null>(null);
  const [abgaben, setAbgaben] = useState<Abgabe[]>([]);
  const [code, setCode] = useState("");
  const [gefunden, setGefunden] = useState<{ id: string; name: string } | null>(null);
  const [vmOk, setVmOk] = useState(false);
  const [frOk, setFrOk] = useState(false);
  const [nachricht, setNachricht] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const [v, a] = await Promise.all([api<{ vollmachten: Vollmacht[] }>("/api/vollmacht"), api<{ abgaben: Abgabe[] }>(`/api/abgaben?year=${year}`)]);
    setVm(v.vollmachten);
    setAbgaben(a.abgaben);
  }, [year]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!data || !result || vm === null) return <div className="shimmer" style={{ height: 240, borderRadius: 18 }} />;

  const aktiv = vm.find((v) => !v.widerrufenAt) ?? null;
  const abgabe = abgaben.find((a) => a.status !== "zurueckgezogen") ?? abgaben[0] ?? null;
  const vorschau = pruefliste(data, result, []);
  const kritisch = vorschau.filter((p) => p.stufe === "kritisch");
  const offenFuerFreigabe = !abgabe || ["rueckfrage", "zurueckgezogen"].includes(abgabe.status);

  async function run<T>(fn: () => Promise<T>, ok?: string) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      if (ok) toast.show(ok);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Steuerjahr {year}</p>
          <h1 className="title">Abgeben lassen</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Deine Partner-Kanzlei prüft deine Erklärung und bringt sie über FinanzOnline beim Finanzamt ein. Du gibst nur frei.</p>
        </div>
      </header>
      {err && <div className="notice notice-red small"><span>⚠️</span><span>{err}</span></div>}

      {/* Schritt 1: Kanzlei & Vollmacht */}
      <section className="card card-lg stack">
        <div className="row-between">
          <h2 className="title-2">1 · Kanzlei & Vollmacht</h2>
          {aktiv && <span className="badge badge-green">✓ Vollmacht erteilt</span>}
        </div>
        {aktiv ? (
          <>
            <p style={{ margin: 0 }}><strong>{aktiv.kanzleiName}</strong> <span className="muted small">· seit {zeit(aktiv.erteiltAt)}</span></p>
            <details className="small muted"><summary>Vollmachtstext</summary><p>{aktiv.text}</p></details>
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", color: "var(--red)" }} disabled={busy}
              onClick={() => confirm("Vollmacht widerrufen? Offene Abgaben werden zurückgezogen.") && run(() => api("/api/vollmacht", { method: "DELETE", json: { id: aktiv.id } }), "Vollmacht widerrufen")}>
              Vollmacht widerrufen
            </button>
          </>
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>Gib den Kanzlei-Code ein, den du von deiner Kanzlei bekommen hast.</p>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <input className="input mono" style={{ maxWidth: 200, textTransform: "uppercase" }} aria-label="Kanzlei-Code" placeholder="ABCD-1234" value={code} onChange={(e) => { setCode(e.target.value.slice(0, 12)); setGefunden(null); }} />
              <button className="btn btn-secondary" disabled={busy || code.length < 4} onClick={() => run(async () => setGefunden((await api<{ kanzlei: { id: string; name: string } }>(`/api/kanzlei/suche?code=${encodeURIComponent(code)}`)).kanzlei))}>Suchen</button>
            </div>
            {gefunden && (
              <div className="stack fade-in" style={{ "--gap": "10px" } as React.CSSProperties}>
                <p style={{ margin: 0 }}>Kanzlei: <strong>{gefunden.name}</strong></p>
                <label className="row small" style={{ alignItems: "flex-start", gap: 10 }}>
                  <input type="checkbox" checked={vmOk} onChange={(e) => setVmOk(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>{VOLLMACHT_TEXT(gefunden.name)}</span>
                </label>
                <button className="btn" style={{ alignSelf: "flex-start" }} disabled={!vmOk || busy} onClick={() => run(() => api("/api/vollmacht", { method: "POST", json: { code, zustimmung: true } }), "✓ Vollmacht erteilt")}>Vollmacht erteilen</button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Schritt 2: Prüfen & freigeben */}
      {aktiv && offenFuerFreigabe && (
        <section className="card card-lg stack">
          <h2 className="title-2">2 · Prüfen & freigeben</h2>
          <div className="grid grid-3">
            <div><div className="tiny muted">{result.erstattung >= 0 ? "Voraussichtliche Gutschrift" : "Voraussichtliche Nachzahlung"}</div><div className="title-2 num">{eur(Math.abs(result.erstattung))}</div></div>
            <div><div className="tiny muted">Formulare</div><div className="title-2">{formulare(result).join(", ")}</div></div>
            <div><div className="tiny muted">Belege</div><div className="title-2 num">{documentCount}</div></div>
          </div>
          <div>
            <h3 className="small" style={{ margin: "0 0 8px", fontWeight: 600 }}>Das sieht sich die Kanzlei genauer an</h3>
            <Pruefliste punkte={vorschau} />
          </div>
          {abgabe?.status === "rueckfrage" && <div className="notice notice-orange small"><span>💬</span><span>Die Kanzlei hat eine Rückfrage (siehe unten). Ändere deine Angaben bei Bedarf und gib dann erneut frei.</span></div>}
          <label className="row small" style={{ alignItems: "flex-start", gap: 10 }}>
            <input type="checkbox" checked={frOk} onChange={(e) => setFrOk(e.target.checked)} style={{ marginTop: 3 }} />
            <span>{FREIGABE_TEXT(year, aktiv.kanzleiName)}</span>
          </label>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-lg" disabled={!frOk || busy || kritisch.length > 0}
              onClick={() => run(() => api("/api/abgaben", { method: "POST", json: { year, kanzleiId: aktiv.kanzleiId, bestaetigung: true } }), "✓ Freigegeben – die Kanzlei ist informiert")}>
              {busy ? <span className="spinner" /> : "📤"} {abgabe ? "Erneut freigeben" : "Zur Abgabe freigeben"}
            </button>
            <Link className="btn btn-secondary" href="/app/ergebnis">Ergebnis ansehen</Link>
          </div>
          {kritisch.length > 0 && <p className="tiny" style={{ margin: 0, color: "var(--red)" }}>Freigabe erst möglich, wenn die ⛔-Punkte geklärt sind.</p>}
          <p className="tiny muted" style={{ margin: 0 }}>Bei der Freigabe wird ein unveränderlicher Stand deiner Daten mit Prüfsumme erstellt. Spätere Änderungen in der App ändern die Abgabe nicht – dafür gibst du erneut frei.</p>
        </section>
      )}

      {/* Schritt 3: Status */}
      {abgabe && (
        <section className="card card-lg stack">
          <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
            <h2 className="title-2">3 · Status</h2>
            <span className={`badge ${TON[STATUS[abgabe.status].ton]}`}>{abgabe.statusLabel}</span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Version {abgabe.version} · freigegeben {zeit(abgabe.freigabe.at)} · Prüfsumme <span className="mono">{abgabe.hash.slice(0, 12)}…</span>
            {abgabe.uebermittlung && <> · FinanzOnline-Referenz <strong>{abgabe.uebermittlung.referenz}</strong></>}
          </p>
          {abgabe.status === "uebermittelt" && <div className="notice notice-green small"><span>✓</span><span>Übermittelt. Der Bescheid kommt in die Databox der Kanzlei bzw. in deine FinanzOnline-Databox. Prüfen kannst du ihn unter <Link href="/app/finanzamt">Finanzamt → Bescheid prüfen</Link>.</span></div>}
          <Verlauf ereignisse={abgabe.ereignisse} nachrichten={abgabe.nachrichten} ich="mandant" />
          {abgabe.status !== "zurueckgezogen" && (
            <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
              <textarea className="input" rows={3} aria-label="Nachricht an die Kanzlei" placeholder="Nachricht an die Kanzlei …" value={nachricht} onChange={(e) => setNachricht(e.target.value.slice(0, 4000))} />
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-secondary" disabled={!nachricht.trim() || busy} onClick={() => run(async () => { await api(`/api/abgaben/${abgabe.id}`, { method: "POST", json: { aktion: "nachricht", text: nachricht } }); setNachricht(""); }, "Gesendet")}>Senden</button>
                {["freigegeben", "in_pruefung", "rueckfrage"].includes(abgabe.status) && (
                  <button className="btn btn-ghost" style={{ color: "var(--red)" }} disabled={busy} onClick={() => confirm("Abgabe zurückziehen?") && run(() => api(`/api/abgaben/${abgabe.id}`, { method: "POST", json: { aktion: "zurueckziehen", text: "" } }), "Zurückgezogen")}>Zurückziehen</button>
                )}
              </div>
            </div>
          )}
        </section>
      )}
      {toast.node}
    </div>
  );
}
