"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MoneyInput, NumberInput } from "@/components/ui";
import { api, eur, kiIdeen } from "@/lib/client/api";
import { alsAntwort, beantworten, fragen, mitErsparnis, type FrageMitWert } from "@/lib/agent/fragen";
import type { Ideen } from "@/lib/ai/ideen";
import { SUPPORTED_YEARS } from "@/lib/tax/constants";
import type { TaxCase } from "@/lib/tax/types";
import type { StoredDocument } from "@/lib/server/repo";
import { useCase } from "../CaseContext";

const GRUPPE: Record<FrageMitWert["gruppe"], string> = { vollstaendig: "Vollständigkeit", vorjahr: "Aus dem Vorjahr", arbeit: "Arbeit", familie: "Familie", privat: "Privat", einkuenfte: "Weitere Einkünfte" };
const BEREICH: Record<string, string> = { profil: "/app/profil", belege: "/app/belege", buchhaltung: "/app/buchhaltung", finanzamt: "/app/finanzamt" };

function Karte({ f, onAntwort, onNein, onSpaeter }: { f: FrageMitWert; onAntwort: (wert: number | boolean | string) => void; onNein: () => void; onSpaeter: () => void }) {
  const [wert, setWert] = useState<number>(0);
  const [wahl, setWahl] = useState<string>(f.eingabe.typ === "auswahl" ? f.eingabe.optionen[0]!.wert : "");
  const e = f.eingabe;
  return (
    <section className="card card-lg stack fade-in" key={f.id} aria-live="polite">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="eyebrow" style={{ margin: 0 }}>{GRUPPE[f.gruppe]}</span>
        {f.ersparnis >= 5 && <span className="badge badge-green">bringt dir ca. {eur(f.ersparnis, 0)}</span>}
      </div>
      <h2 className="title-2" style={{ fontSize: 24 }}>{f.titel}</h2>
      <p className="muted" style={{ margin: 0 }}>{f.text}</p>
      {f.hilfe && <p className="small" style={{ margin: 0 }}>📅 {f.hilfe}</p>}

      {(e.typ === "betrag" || e.typ === "zahl") && (
        <div className="field" style={{ maxWidth: 260 }}>
          <span className="label">{e.label}</span>
          {e.typ === "betrag" ? <MoneyInput ariaLabel={e.label} value={wert} onChange={setWert} /> : <NumberInput ariaLabel={e.label} value={wert} max={e.max} suffix={e.einheit} onChange={setWert} />}
        </div>
      )}
      {e.typ === "auswahl" && (
        <div className="segmented" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
          {e.optionen.map((o) => <button key={o.wert} type="button" aria-pressed={wahl === o.wert} onClick={() => setWahl(o.wert)}>{o.label}</button>)}
        </div>
      )}

      <div className="row" style={{ flexWrap: "wrap" }}>
        {e.typ === "janein" && (
          <>
            <button className="btn" onClick={() => onAntwort(true)}>{e.ja ?? "Ja"}</button>
            <button className="btn btn-secondary" onClick={() => onAntwort(false)}>{e.nein ?? "Nein"}</button>
          </>
        )}
        {(e.typ === "betrag" || e.typ === "zahl") && (
          <>
            <button className="btn" disabled={wert <= 0} onClick={() => onAntwort(wert)}>Übernehmen</button>
            <button className="btn btn-secondary" onClick={onNein}>Nein / trifft nicht zu</button>
          </>
        )}
        {e.typ === "auswahl" && <button className="btn" onClick={() => onAntwort(wahl)}>Übernehmen</button>}
        {e.typ === "info" && <button className="btn" onClick={() => onAntwort(true)}>{e.aktion}</button>}
        <button className="btn btn-ghost" onClick={onSpaeter}>Später</button>
      </div>
    </section>
  );
}

export default function SteuerCheck() {
  const { data, result, year, update } = useCase();
  const router = useRouter();
  const [vorjahr, setVorjahr] = useState<TaxCase | null>(null);
  const [offeneBelege, setOffeneBelege] = useState(0);
  const [spaeter, setSpaeter] = useState<string[]>([]);
  const [ideen, setIdeen] = useState<Ideen["ideen"] | null>(null);
  const [ideenBusy, setIdeenBusy] = useState(false);
  const [ideenErr, setIdeenErr] = useState<string | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const vj = year - 1;
    if ((SUPPORTED_YEARS as number[]).includes(vj))
      api<{ case: TaxCase }>(`/api/case?year=${vj}`).then((r) => setVorjahr(r.case.lohnzettel.length || r.case.betriebe.length || r.case.mietobjekte.length ? r.case : null), () => setVorjahr(null));
    api<{ documents: StoredDocument[] }>(`/api/documents?year=${year}`).then((r) => setOffeneBelege(r.documents.filter((d) => !d.applied).length), () => {});
    setSpaeter([]);
    setIdeen(null);
    start.current = null;
  }, [year]);

  const liste = useMemo(() => (data && result ? mitErsparnis(data, result, fragen(data, result, { vorjahr, offeneBelege })) : []), [data, result, vorjahr, offeneBelege]);
  if (!data || !result) return <div className="shimmer" style={{ height: 300, borderRadius: 18 }} />;
  start.current ??= result.erstattung;

  const offen = liste.filter((f) => !spaeter.includes(f.id));
  const naechste = offen[0] ?? null;
  const erledigt = data.agent.erledigt.length;
  const gesamt = erledigt + liste.length;
  const plus = Math.round((result.erstattung - (start.current ?? result.erstattung)) * 100) / 100;

  const antworten = (f: FrageMitWert, wert: number | boolean | string | null) => {
    update((d) => void Object.assign(d, beantworten(d, f, wert === null ? null : alsAntwort(f, wert))));
    if (f.link && (f.eingabe.typ === "info" || (f.link.beiJa && wert === true))) router.push(f.link.href);
  };
  const fertig = () => update((d) => void (d.agent.abgeschlossenAt = Date.now()));

  async function ladeIdeen() {
    setIdeenBusy(true);
    setIdeenErr(null);
    try {
      setIdeen((await kiIdeen(year)).ideen);
    } catch (e) {
      setIdeenErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setIdeenBusy(false);
    }
  }

  return (
    <div className="stack fade-in" style={{ "--gap": "24px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Steuer-Check {year}</p>
          <h1 className="title">Was steht dir noch zu?</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Ein paar gezielte Fragen – Steuerklar rechnet bei jeder Antwort sofort mit{vorjahr ? ` und vergleicht mit ${vorjahr.year}` : ""}.</p>
        </div>
      </header>

      <section className="card stack" style={{ "--gap": "10px" } as React.CSSProperties}>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="small muted">{erledigt} von {gesamt} erledigt</span>
          <span className="small">
            {result.erstattung >= 0 ? "Gutschrift" : "Nachzahlung"} <strong className="num">{eur(Math.abs(result.erstattung))}</strong>
            {plus !== 0 && <span className="badge badge-green" style={{ marginLeft: 8 }}>{plus > 0 ? "+" : ""}{eur(plus)} durch den Check</span>}
          </span>
        </div>
        <div className="progress"><div style={{ width: `${gesamt ? (erledigt / gesamt) * 100 : 100}%` }} /></div>
      </section>

      {naechste ? (
        <Karte key={naechste.id} f={naechste} onAntwort={(w) => antworten(naechste, w)} onNein={() => antworten(naechste, null)} onSpaeter={() => setSpaeter((s) => [...s, naechste.id])} />
      ) : (
        <section className="card card-lg stack center fade-in">
          <div style={{ fontSize: 44 }} aria-hidden="true">🎉</div>
          <h2 className="title-2">Fertig – deine Erklärung {year} ist bereit</h2>
          <p className="muted" style={{ margin: 0 }}>
            {result.erstattung >= 0 ? `Voraussichtliche Gutschrift: ${eur(result.erstattung)}` : `Voraussichtliche Nachzahlung: ${eur(-result.erstattung)}`}
            {plus > 0 ? ` – davon ${eur(plus)} durch den Steuer-Check.` : "."}
          </p>
          <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn btn-lg" href="/app/abgabe" onClick={fertig}>📤 Freigeben & abgeben lassen</Link>
            <Link className="btn btn-secondary" href="/app/ergebnis">Details ansehen</Link>
          </div>
          {spaeter.length > 0 && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "center" }} onClick={() => setSpaeter([])}>{spaeter.length} zurückgestellte Frage(n) ansehen</button>}
        </section>
      )}

      {offen.length > 1 && (
        <section className="stack">
          <h2 className="title-2" style={{ fontSize: 18 }}>Danach</h2>
          <div className="list">
            {offen.slice(1, 8).map((f) => (
              <button key={f.id} className="list-item" style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", color: "var(--text)" }} onClick={() => setSpaeter((s) => [...s.filter((x) => x !== f.id), ...offen.slice(0, offen.indexOf(f)).map((x) => x.id)])}>
                <span className="grow">{f.titel}<div className="tiny muted">{GRUPPE[f.gruppe]}</div></span>
                {f.ersparnis >= 5 && <span className="badge badge-green">ca. {eur(f.ersparnis, 0)}</span>}
                <span className="muted">›</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card card-lg stack">
        <div className="row-between" style={{ flexWrap: "wrap", gap: 8 }}>
          <h2 className="title-2" style={{ fontSize: 18 }}>✨ Was übersehe ich noch?</h2>
          <button className="btn btn-secondary btn-sm" disabled={ideenBusy} onClick={ladeIdeen}>{ideenBusy ? <span className="spinner" /> : null} {ideen ? "Neu fragen" : "KI fragen"}</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Die KI sieht sich deinen ganzen Fall an und sucht Abzüge und Optionen, die über die Standardfragen hinausgehen. Es wird nichts automatisch geändert.</p>
        {ideenErr && <div className="notice notice-red small"><span>⚠️</span><span>{ideenErr}</span></div>}
        {ideen && ideen.length === 0 && <p className="small" style={{ margin: 0 }}>✓ Die KI hat nichts Weiteres gefunden.</p>}
        {ideen?.map((i, n) => (
          <div key={n} className="list-item" style={{ alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <span className="grow" style={{ minWidth: 200 }}>
              <strong>{i.titel}</strong>
              <div className="small muted">{i.text}</div>
            </span>
            {i.geschaetzt ? <span className="badge badge-green">ca. {eur(i.geschaetzt, 0)}</span> : null}
            {BEREICH[i.bereich] && <Link className="btn btn-ghost btn-sm" href={BEREICH[i.bereich]!}>Erledigen ›</Link>}
          </div>
        ))}
      </section>
    </div>
  );
}
