"use client";
import { useRef, useState } from "react";
import { erklaereBrief, eur, pruefeBescheid } from "@/lib/client/api";
import { downscale } from "@/lib/client/image";
import { POST_ARTEN, type Bescheid, type BescheidPruefung, type Post } from "@/lib/ai/finanzamt";
import { ANTRAEGE, antragText, antragVorschlag, type AntragArt, type AntragInput } from "@/lib/tax/antraege";
import { MoneyInput, NumberInput, useToast } from "@/components/ui";
import { useCase } from "../CaseContext";

const datumDe = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "–");
const tageBis = (iso: string) => Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86_400_000);

function Upload({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  return (
    <div className="row" style={{ flexWrap: "wrap" }}>
      <button className="btn" disabled={busy} onClick={() => cam.current?.click()}>
        {busy ? <span className="spinner" /> : "📸"} {busy ? "KI liest …" : label}
      </button>
      <button className="btn btn-secondary" disabled={busy} onClick={() => ref.current?.click()}>PDF oder Bild wählen</button>
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </div>
  );
}

function Entwurf({ title, text, onChange }: { title: string; text: string; onChange: (t: string) => void }) {
  const toast = useToast();
  return (
    <div className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
      <div className="row-between">
        <h3 className="title-2" style={{ fontSize: 17 }}>{title}</h3>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigator.clipboard.writeText(text).then(() => toast.show("✓ Kopiert"), () => toast.show("Kopieren nicht möglich – bitte markieren"))}
        >
          Kopieren
        </button>
      </div>
      <textarea className="input mono" aria-label={title} value={text} onChange={(e) => onChange(e.target.value)} rows={18} style={{ fontSize: 13, lineHeight: 1.5, minHeight: 280, resize: "vertical" }} />
      <p className="tiny muted" style={{ margin: 0 }}>Platzhalter in [eckigen Klammern] ersetzen. Einbringen über FinanzOnline → Eingaben → Rechtsmittel bzw. Anbringen, oder unterschrieben per Post.</p>
      {toast.node}
    </div>
  );
}

function BescheidKarte() {
  const { year } = useCase();
  const [zustellung, setZustellung] = useState<"databox" | "post">("databox");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ bescheid: Bescheid; pruefung: BescheidPruefung } | null>(null);
  const [text, setText] = useState("");

  async function run(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const r = await pruefeBescheid(await downscale(file), year, zustellung);
      setRes(r);
      setText(r.pruefung.beschwerde);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  const p = res?.pruefung;
  const b = res?.bescheid;
  return (
    <section className="card card-lg stack" aria-labelledby="bescheid-h">
      <div>
        <h2 id="bescheid-h" className="title-2">🔍 Bescheid prüfen</h2>
        <p className="muted small" style={{ margin: "6px 0 0" }}>
          Lade deinen Einkommensteuerbescheid {year} hoch. Steuerklar vergleicht ihn mit deiner Berechnung und schreibt bei Abweichungen die Beschwerde für dich.
        </p>
      </div>
      <div className="field">
        <span className="label">Wie kam der Bescheid?</span>
        <div className="segmented" style={{ alignSelf: "flex-start" }}>
          {(["databox", "post"] as const).map((z) => (
            <button key={z} type="button" aria-pressed={zustellung === z} onClick={() => setZustellung(z)}>
              {z === "databox" ? "FinanzOnline-Databox" : "Per Post"}
            </button>
          ))}
        </div>
      </div>
      <Upload label="Bescheid fotografieren" busy={busy} onFile={run} />
      {err && <div className="notice notice-red small"><span>⚠️</span><span>{err}</span></div>}
      {p && b && (
        <div className="stack fade-in">
          <div className={`notice ${p.beschwerdeSinnvoll ? "notice-orange" : "notice-green"} small`}>
            <span>{p.beschwerdeSinnvoll ? "✍️" : "✓"}</span>
            <span>{p.fazit}</span>
          </div>
          <div className="grid grid-3">
            <div className="card-flat card">
              <div className="tiny muted">Laut Bescheid</div>
              <div className="title-2 num">{b.abgabengutschrift === null ? "–" : eur(b.abgabengutschrift)}</div>
              <div className="tiny muted">{b.abgabengutschrift !== null && b.abgabengutschrift < 0 ? "Nachforderung" : "Gutschrift"}</div>
            </div>
            <div className="card-flat card">
              <div className="tiny muted">Unterschied zu deiner Berechnung</div>
              <div className="title-2 num" style={{ color: (p.differenzGutschrift ?? 0) >= 20 ? "var(--orange)" : undefined }}>
                {p.differenzGutschrift === null ? "–" : eur(p.differenzGutschrift)}
              </div>
            </div>
            <div className="card-flat card">
              <div className="tiny muted">Beschwerdefrist bis</div>
              <div className="title-2 num" style={{ color: p.fristAbgelaufen ? "var(--red)" : undefined }}>{datumDe(p.frist)}</div>
              <div className="tiny muted">{p.frist ? (p.fristAbgelaufen ? "abgelaufen" : `noch ${tageBis(p.frist)} Tage`) : "Datum nicht erkannt"}</div>
            </div>
          </div>
          {p.abweichungen.length > 0 && (
            <div className="list">
              {p.abweichungen.map((a) => (
                <div key={a.posten} className="list-item">
                  <div className="grow">
                    <div>{a.posten}</div>
                    <div className="tiny muted">Bescheid {eur(a.bescheid)} · Steuerklar {eur(a.berechnet)}</div>
                  </div>
                  <span className={`badge ${a.zuDeinenUngunsten ? "badge-orange" : "badge-blue"}`}>{a.differenz > 0 ? "+" : ""}{eur(a.differenz)}</span>
                </div>
              ))}
            </div>
          )}
          {b.nichtAnerkannt.length > 0 && (
            <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
              <h3 className="small" style={{ margin: 0, fontWeight: 600 }}>Laut Begründung nicht anerkannt</h3>
              {b.nichtAnerkannt.map((n, i) => (
                <div key={i} className="small"><strong>{n.posten}</strong>{n.betrag ? ` (${eur(n.betrag)})` : ""}: <span className="muted">{n.begruendung}</span></div>
              ))}
            </div>
          )}
          {b.hinweise.length > 0 && <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{b.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>}
          {b.istBescheid && (p.beschwerdeSinnvoll || p.abweichungen.length > 0 || b.nichtAnerkannt.length > 0) && (
            <>
              <Entwurf title="Entwurf: Beschwerde" text={text} onChange={setText} />
              <p className="tiny muted" style={{ margin: 0 }}>
                Mehr Zeit nötig? Vor Fristende kannst du formlos eine Verlängerung der Beschwerdefrist beantragen (§ 245 Abs. 3 BAO). Bei einer Nachforderung zahlt man trotz Beschwerde,
                außer man beantragt die Aussetzung der Einhebung (§ 212a BAO, im Entwurf enthalten).
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

const DRINGLICH = { hoch: ["badge-red", "Dringend"], mittel: ["badge-orange", "Bald erledigen"], niedrig: ["badge-green", "Kein Stress"] } as const;

function BriefKarte() {
  const { year } = useCase();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [text, setText] = useState("");

  async function run(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const r = await erklaereBrief(await downscale(file), year);
      setPost(r.post);
      setText(r.post.antwortEntwurf);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-lg stack" aria-labelledby="brief-h">
      <div>
        <h2 id="brief-h" className="title-2">✉️ Brief vom Finanzamt</h2>
        <p className="muted small" style={{ margin: "6px 0 0" }}>
          Ergänzungsersuchen, Vorhalt, Zahlungsaufforderung, Mahnung … Foto hochladen – Steuerklar erklärt, was zu tun ist, und schreibt die Antwort.
        </p>
      </div>
      <Upload label="Brief fotografieren" busy={busy} onFile={run} />
      {err && <div className="notice notice-red small"><span>⚠️</span><span>{err}</span></div>}
      {post && (
        <div className="stack fade-in">
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="badge badge-blue">{POST_ARTEN[post.art]}</span>
            <span className={`badge ${DRINGLICH[post.dringlichkeit][0]}`}>{DRINGLICH[post.dringlichkeit][1]}</span>
            {post.frist && <span className="badge">Frist {datumDe(post.frist)}{tageBis(post.frist) >= 0 ? ` · ${tageBis(post.frist)} Tage` : " · abgelaufen"}</span>}
            {post.betrag !== null && <span className="badge">{eur(post.betrag)}</span>}
          </div>
          <p style={{ margin: 0 }}>{post.zusammenfassung}</p>
          {post.fachberatungEmpfohlen && (
            <div className="notice notice-orange small">
              <span>⚖️</span>
              <span>Hier empfehlen wir eine Steuerberatung oder Rechtsanwält:in: Bei Außenprüfungen, Finanzstrafverfahren oder Schätzungen ist eine professionelle Vertretung sinnvoll – und gesetzlich diesen Berufen vorbehalten.</span>
            </div>
          )}
          {post.wasTun.length > 0 && (
            <div>
              <h3 className="small" style={{ margin: "0 0 6px", fontWeight: 600 }}>So gehst du vor</h3>
              <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>{post.wasTun.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}</ol>
            </div>
          )}
          {post.unterlagen.length > 0 && (
            <div>
              <h3 className="small" style={{ margin: "0 0 6px", fontWeight: 600 }}>Benötigte Unterlagen</h3>
              <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>{post.unterlagen.map((u, i) => <li key={i}>{u}</li>)}</ul>
            </div>
          )}
          {post.hinweise.length > 0 && <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{post.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>}
          {post.antwortEntwurf.trim() && <Entwurf title="Entwurf: Antwort" text={text} onChange={setText} />}
        </div>
      )}
    </section>
  );
}


function AntragKarte() {
  const { data, result } = useCase();
  const [a, setA] = useState<AntragInput | null>(null);
  const [text, setText] = useState("");
  if (!data || !result) return null;
  const waehle = (art: AntragArt) => {
    const v = antragVorschlag(art, data, result);
    setA(v);
    setText(antragText(v, data));
  };
  const upd = (patch: Partial<AntragInput>) => {
    if (!a) return;
    const v = { ...a, ...patch };
    setA(v);
    setText(antragText(v, data));
  };
  return (
    <section className="card card-lg stack" aria-labelledby="antrag-h">
      <div>
        <h2 id="antrag-h" className="title-2">📨 Antrag stellen</h2>
        <p className="muted small" style={{ margin: "6px 0 0" }}>Fertige Anträge mit dem richtigen Paragraphen – Werte aus deinem Fall sind schon eingesetzt.</p>
      </div>
      <div className="field">
        <label className="label" htmlFor="antrag-art">Was möchtest du beantragen?</label>
        <select id="antrag-art" className="select" value={a?.art ?? ""} onChange={(e) => e.target.value && waehle(e.target.value as AntragArt)}>
          <option value="">Bitte wählen …</option>
          {(Object.keys(ANTRAEGE) as AntragArt[]).map((k) => <option key={k} value={k}>{ANTRAEGE[k].titel}</option>)}
        </select>
        {a && <span className="help">{ANTRAEGE[a.art].info}</span>}
      </div>
      {a && (
        <div className="stack fade-in">
          {a.art === "herabsetzung" && (
            <div className="grid grid-2">
              <div className="field"><span className="label">Bisherige Vorauszahlung (Jahr)</span><MoneyInput ariaLabel="Bisherige Vorauszahlung" value={a.betrag} onChange={(v) => upd({ betrag: v })} /></div>
              <div className="field"><span className="label">Beantragt (laut Prognose)</span><MoneyInput ariaLabel="Beantragte Vorauszahlung" value={a.beantragt} onChange={(v) => upd({ beantragt: v })} /></div>
            </div>
          )}
          {a.art === "zahlungserleichterung" && (
            <div className="grid grid-2">
              <div className="field"><span className="label">Offener Betrag</span><MoneyInput ariaLabel="Offener Betrag" value={a.betrag} onChange={(v) => upd({ betrag: v })} /></div>
              <div className="field"><span className="label">Monatsraten (0 = Stundung)</span><NumberInput ariaLabel="Monatsraten" value={a.raten} max={24} onChange={(v) => upd({ raten: v })} /></div>
            </div>
          )}
          {a.art === "rueckzahlung" && (
            <div className="grid grid-2">
              <div className="field"><span className="label">Guthaben</span><MoneyInput ariaLabel="Guthaben" value={a.betrag} onChange={(v) => upd({ betrag: v })} /></div>
              <div className="field"><span className="label">IBAN</span><input className="input" aria-label="IBAN" autoComplete="off" value={a.iban} onChange={(e) => upd({ iban: e.target.value.slice(0, 40) })} /></div>
            </div>
          )}
          {(a.art === "beschwerdefrist" || a.art === "erklaerungsfrist") && (
            <div className="field" style={{ maxWidth: 260 }}>
              <span className="label">{a.art === "beschwerdefrist" ? "Datum des Bescheids" : "Verlängern bis"}</span>
              <input className="input" type="date" aria-label="Datum" value={a.datum} onChange={(e) => upd({ datum: e.target.value })} />
            </div>
          )}
          {a.art !== "rueckzahlung" && (
            <div className="field">
              <span className="label">Begründung (optional)</span>
              <textarea className="input" rows={3} aria-label="Begründung" value={a.begruendung} onChange={(e) => upd({ begruendung: e.target.value.slice(0, 2000) })} />
            </div>
          )}
          <Entwurf title={`Entwurf: ${ANTRAEGE[a.art].titel}`} text={text} onChange={setText} />
        </div>
      )}
    </section>
  );
}

export default function Finanzamt() {
  return (
    <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Nach der Abgabe</p>
          <h1 className="title">Finanzamt</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Bescheide prüfen, Briefe verstehen, Antworten schreiben. Die Dokumente werden nur gelesen und nicht gespeichert.</p>
        </div>
      </header>
      <BescheidKarte />
      <BriefKarte />
      <AntragKarte />
      <p className="tiny muted">
        Steuerklar ersetzt keine rechtliche Vertretung. Entwürfe vor dem Absenden lesen und an deine Situation anpassen. Vertretung vor dem Finanzamt, im Finanzstrafverfahren
        und bei Außenprüfungen ist Steuerberater:innen, Wirtschaftsprüfer:innen und Rechtsanwält:innen vorbehalten.
      </p>
    </div>
  );
}
