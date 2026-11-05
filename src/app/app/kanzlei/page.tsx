"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { api, eur } from "@/lib/client/api";
import { STATUS, type AbgabeDaten, type AbgabeStatus } from "@/lib/abgabe/abgabe";
import type { FormEntry } from "@/lib/tax/types";
import { Pruefliste, TON, Verlauf, zeit } from "../abgabe/Teile";

interface Kurz {
  id: string; year: number; mandant: { name: string; email: string }; status: AbgabeStatus; statusLabel: string; gutschrift: number;
  formulare: string[]; kritisch: number; pruefen: number; version: number; uebermittlung: { referenz: string } | null; ungelesen: "mandant" | "kanzlei" | null; updatedAt: number;
}
interface Uebersicht {
  kanzlei: { id: string; name: string; code: string; rolle: string } | null;
  mandanten?: number;
  abgaben?: Kurz[];
  setupMoeglich?: boolean;
  totpNoetig?: boolean;
}
type Detail = AbgabeDaten & { kennzahlen: Record<string, FormEntry[]> };

const FILTER = {
  offen: { label: "Offen", s: ["freigegeben", "in_pruefung", "rueckfrage"] },
  erledigt: { label: "Übermittelt", s: ["uebermittelt", "bescheid"] },
  alle: { label: "Alle", s: Object.keys(STATUS) },
} as const;

function Setup({ moeglich, onDone }: { moeglich: boolean; onDone: () => void }) {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (!moeglich)
    return <div className="notice notice-blue small"><span>⚖️</span><span>Dieses Konto gehört zu keiner Kanzlei. Partnerkanzleien werden vom Betreiber freigeschaltet.</span></div>;
  return (
    <section className="card card-lg stack" style={{ maxWidth: 560 }}>
      <h2 className="title-2">Kanzlei einrichten</h2>
      <p className="small muted" style={{ margin: 0 }}>Für berufsberechtigte Steuerberatungskanzleien. Das Einrichtungs-Token erhältst du vom Betreiber. Voraussetzung: Zwei-Faktor-Anmeldung ist aktiv.</p>
      <div className="field"><label className="label" htmlFor="k-name">Name der Kanzlei</label><input id="k-name" className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 200))} placeholder="Muster Steuerberatung GmbH" /></div>
      <div className="field"><label className="label" htmlFor="k-token">Einrichtungs-Token</label><input id="k-token" className="input mono" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} /></div>
      {err && <div className="notice notice-red small"><span>⚠️</span><span>{err}</span></div>}
      <button className="btn" style={{ alignSelf: "flex-start" }} disabled={name.trim().length < 3 || token.length < 16}
        onClick={() => api("/api/kanzlei", { method: "POST", json: { name, token } }).then(onDone, (e: Error) => setErr(e.message))}>Kanzlei anlegen</button>
    </section>
  );
}

function DetailAnsicht({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [text, setText] = useState("");
  const [referenz, setReferenz] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const load = useCallback(() => api<{ abgabe: Detail }>(`/api/kanzlei/abgaben/${id}`).then((r) => setD(r.abgabe), (e: Error) => setErr(e.message)), [id]);
  useEffect(() => {
    setD(null);
    void load();
  }, [load]);
  if (err && !d) return <div className="notice notice-red small"><span>⚠️</span><span>{err}</span></div>;
  if (!d) return <div className="shimmer" style={{ height: 300, borderRadius: 18 }} />;
  const r = d.snapshot.result;

  async function aktion(a: string, ok: string) {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/kanzlei/abgaben/${id}`, { method: "POST", json: { aktion: a, text, referenz } });
      setText("");
      toast.show(ok);
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack fade-in" style={{ "--gap": "20px" } as React.CSSProperties}>
      <section className="card card-lg stack">
        <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 className="title-2">{d.mandant.name} · {d.year}</h2>
            <div className="small muted">{d.mandant.email} · Version {d.snapshot.version} · freigegeben {zeit(d.freigabe.at)}</div>
          </div>
          <span className={`badge ${TON[STATUS[d.status].ton]}`}>{STATUS[d.status].label}</span>
        </div>
        <div className="grid grid-3">
          <div><div className="tiny muted">{r.erstattung >= 0 ? "Gutschrift" : "Nachzahlung"}</div><div className="title-2 num">{eur(Math.abs(r.erstattung))}</div></div>
          <div><div className="tiny muted">Einkommen</div><div className="title-2 num">{eur(r.einkommen, 0)}</div></div>
          <div><div className="tiny muted">Formulare</div><div className="title-2">{d.snapshot.formulare.join(", ")}</div></div>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>Prüfsumme der Freigabe: <span className="mono">{d.snapshot.hash}</span></p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <a className="btn btn-secondary btn-sm" href={`/api/kanzlei/abgaben/${d.id}/pdf`}>⬇︎ Ausfüllhilfe (PDF)</a>
          <a className="btn btn-secondary btn-sm" href={`/api/kanzlei/abgaben/${d.id}/datei`}>⬇︎ Übermittlungsdatei (XML)</a>
        </div>
      </section>

      <section className="card card-lg stack">
        <h3 className="title-2" style={{ fontSize: 18 }}>Prüfliste</h3>
        <Pruefliste punkte={d.snapshot.pruefliste} />
      </section>

      <section className="card card-lg stack">
        <h3 className="title-2" style={{ fontSize: 18 }}>Kennzahlen für FinanzOnline</h3>
        {Object.entries(d.kennzahlen).map(([f, list]) => (
          <div key={f}>
            <p className="section-label" style={{ margin: "0 0 6px" }}>{f}</p>
            <div className="list">
              {list.map((e, i) => (
                <div key={i} className="list-item" style={{ gap: 10 }}>
                  <span className="mono small" style={{ width: 44, flexShrink: 0 }}>{e.kz}</span>
                  <span className="grow small">{e.label}</span>
                  <span className="num small" style={{ textAlign: "right" }}>{e.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {d.snapshot.belege.length > 0 && (
        <section className="card card-lg stack">
          <h3 className="title-2" style={{ fontSize: 18 }}>Belege ({d.snapshot.belege.length})</h3>
          <div className="list">
            {d.snapshot.belege.map((b) => (
              <div key={b.id} className="list-item small">
                <span className="grow">{b.fileName}<div className="tiny muted">{b.typ}</div></span>
                <span className="num">{b.betrag !== null ? eur(b.betrag) : "–"}</span>
                <span className={`badge ${b.uebernommen ? "badge-green" : "badge-orange"}`}>{b.uebernommen ? "übernommen" : "offen"}</span>
              </div>
            ))}
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>Belegbilder speichert Steuerklar nicht – bei Bedarf über Rückfrage anfordern.</p>
        </section>
      )}

      <section className="card card-lg stack">
        <h3 className="title-2" style={{ fontSize: 18 }}>Verlauf & Aktionen</h3>
        <Verlauf ereignisse={d.ereignisse} nachrichten={d.nachrichten} ich="kanzlei" />
        {err && <div className="notice notice-red small"><span>⚠️</span><span>{err}</span></div>}
        <textarea className="input" rows={3} aria-label="Nachricht oder Rückfrage" placeholder="Nachricht, Rückfrage oder Begründung …" value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} />
        <div className="row" style={{ flexWrap: "wrap" }}>
          {d.status === "freigegeben" && <button className="btn" disabled={busy} onClick={() => aktion("pruefen", "Prüfung begonnen")}>Prüfung beginnen</button>}
          {["freigegeben", "in_pruefung"].includes(d.status) && <button className="btn btn-secondary" disabled={busy || !text.trim()} onClick={() => aktion("rueckfrage", "Rückfrage gesendet")}>Rückfrage stellen</button>}
          <button className="btn btn-secondary" disabled={busy || !text.trim()} onClick={() => aktion("nachricht", "Gesendet")}>Nur Nachricht</button>
          {["freigegeben", "in_pruefung", "rueckfrage"].includes(d.status) && <button className="btn btn-ghost" style={{ color: "var(--red)" }} disabled={busy || !text.trim()} onClick={() => aktion("ablehnen", "Abgelehnt")}>Ablehnen</button>}
        </div>
        {d.status === "in_pruefung" && (
          <div className="card card-flat stack" style={{ "--gap": "10px" } as React.CSSProperties}>
            <strong className="small">Übermittlung an das Finanzamt</strong>
            <ol className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Vollmacht in FinanzOnline eintragen (falls noch nicht geschehen).</li>
              <li>Kennzahlen bzw. Übermittlungsdatei in die Erklärung {d.snapshot.formulare.join(" + ")} übernehmen und über FinanzOnline einbringen.</li>
              <li>Referenz der Übermittlungsbestätigung hier eintragen – die Mandantin bzw. der Mandant wird informiert.</li>
            </ol>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <input className="input mono" style={{ maxWidth: 260 }} aria-label="FinanzOnline-Referenz" placeholder="Referenz / Übermittlungs-ID" value={referenz} onChange={(e) => setReferenz(e.target.value.slice(0, 80))} />
              <button className="btn" disabled={busy || !referenz.trim()} onClick={() => aktion("uebermitteln", "Als übermittelt markiert")}>Als übermittelt markieren</button>
            </div>
          </div>
        )}
        {d.status === "uebermittelt" && <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => aktion("bescheid", "Bescheid vermerkt")}>Bescheid eingelangt</button>}
      </section>
      {toast.node}
    </div>
  );
}

export default function KanzleiSeite() {
  const [u, setU] = useState<Uebersicht | null>(null);
  const [filter, setFilter] = useState<keyof typeof FILTER>("offen");
  const [sel, setSel] = useState<string | null>(null);
  const load = useCallback(() => api<Uebersicht>("/api/kanzlei").then(setU), []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!u) return <div className="shimmer" style={{ height: 240, borderRadius: 18 }} />;

  const header = (
    <header className="app-header">
      <div>
        <p className="eyebrow">Kanzlei-Ansicht</p>
        <h1 className="title">{u.kanzlei?.name ?? "Kanzlei"}</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>Freigegebene Erklärungen deiner Mandant:innen prüfen, Rückfragen stellen und nach der Übermittlung abschließen.</p>
      </div>
    </header>
  );
  if (!u.kanzlei) return <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>{header}<Setup moeglich={!!u.setupMoeglich} onDone={() => void load()} /></div>;
  if (u.totpNoetig)
    return (
      <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
        {header}
        <div className="notice notice-orange small"><span>🔐</span><span>Für den Zugriff auf Mandantendaten ist die Zwei-Faktor-Anmeldung Pflicht. <Link href="/app/konto">Jetzt unter Konto aktivieren</Link>.</span></div>
      </div>
    );

  const liste = (u.abgaben ?? []).filter((a) => (FILTER[filter].s as readonly string[]).includes(a.status));
  return (
    <div className="stack fade-in" style={{ "--gap": "24px" } as React.CSSProperties}>
      {header}
      <section className="grid grid-3">
        <div className="card"><div className="tiny muted">Kanzlei-Code für Mandant:innen</div><div className="title-2 mono">{u.kanzlei.code}</div></div>
        <div className="card"><div className="tiny muted">Mandant:innen mit Vollmacht</div><div className="title-2 num">{u.mandanten}</div></div>
        <div className="card"><div className="tiny muted">Offene Abgaben</div><div className="title-2 num">{(u.abgaben ?? []).filter((a) => (FILTER.offen.s as readonly string[]).includes(a.status)).length}</div></div>
      </section>
      <div className="segmented" style={{ alignSelf: "flex-start" }}>
        {(Object.keys(FILTER) as (keyof typeof FILTER)[]).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{FILTER[f].label}</button>)}
      </div>
      <div className="list">
        {liste.length === 0 && <div className="list-item muted small">Keine Abgaben in dieser Ansicht.</div>}
        {liste.map((a) => (
          <button key={a.id} className="list-item" aria-current={sel === a.id ? "true" : undefined}
            style={{ width: "100%", textAlign: "left", background: sel === a.id ? "var(--surface-2)" : "none", border: 0, cursor: "pointer", color: "var(--text)", flexWrap: "wrap" }}
            onClick={() => setSel(a.id)}>
            <span className="grow" style={{ minWidth: 160 }}>
              <strong>{a.mandant.name}</strong> · {a.year}
              <div className="tiny muted">{a.formulare.join(", ")} · v{a.version} · {zeit(a.updatedAt)}{a.ungelesen === "mandant" ? " · 💬 neue Nachricht" : ""}</div>
            </span>
            {a.kritisch > 0 && <span className="badge badge-red">{a.kritisch} kritisch</span>}
            {a.pruefen > 0 && <span className="badge badge-orange">{a.pruefen} prüfen</span>}
            <span className="num small">{eur(a.gutschrift, 0)}</span>
            <span className={`badge ${TON[STATUS[a.status].ton]}`}>{a.statusLabel}</span>
          </button>
        ))}
      </div>
      {sel && <DetailAnsicht id={sel} onChanged={() => void load()} />}
    </div>
  );
}
