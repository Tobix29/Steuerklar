"use client";
import Link from "next/link";
import { useState } from "react";
import { MoneyInput, NumberInput, Toggle, useToast } from "@/components/ui";
import { eur, uid } from "@/lib/client/api";
import { faelligAm, ibanGueltig, kunden, naechsteNummer, neueRechnung, offenePosten, pflichtangaben, rechnungStatus, rechnungSummen, steuerHinweis, type Firma, type Rechnung } from "@/lib/tax/rechnung";
import type { Betrieb } from "@/lib/tax/types";
import { useCase } from "../CaseContext";

const de = (iso: string) => (iso ? iso.split("-").reverse().join(".") : "–");
const STATUS = {
  entwurf: ["Entwurf", ""],
  offen: ["Offen", "badge-blue"],
  ueberfaellig: ["Überfällig", "badge-red"],
  bezahlt: ["Bezahlt", "badge-green"],
  storniert: ["Storniert", ""],
} as const;

function FirmaKarte({ firma, onChange, warnKlein }: { firma: Firma; onChange: (f: Firma) => void; warnKlein: boolean }) {
  const [offen, setOffen] = useState(!firma.name);
  const set = (patch: Partial<Firma>) => onChange({ ...firma, ...patch });
  return (
    <section className="card card-lg stack">
      <div className="row-between">
        <div>
          <h2 className="title-2">Deine Rechnungsdaten</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>{firma.name ? `${firma.name}${firma.uid ? ` · ${firma.uid}` : ""}${firma.kleinunternehmer ? " · Kleinunternehmer:in" : ""}` : "Name, Anschrift und Bankverbindung erscheinen auf jeder Rechnung."}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOffen(!offen)}>{offen ? "Fertig" : "Bearbeiten"}</button>
      </div>
      {offen && (
        <div className="stack fade-in" style={{ "--gap": "12px" } as React.CSSProperties}>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field"><label className="label" htmlFor="f-name">Name / Firma</label><input id="f-name" className="input" value={firma.name} onChange={(e) => set({ name: e.target.value.slice(0, 200) })} placeholder="Anna Muster – Grafikdesign" /></div>
            <div className="field"><label className="label" htmlFor="f-mail">E-Mail</label><input id="f-mail" className="input" type="email" value={firma.email} onChange={(e) => set({ email: e.target.value.slice(0, 200) })} /></div>
          </div>
          <div className="field"><label className="label" htmlFor="f-adr">Anschrift</label><textarea id="f-adr" className="input" rows={2} value={firma.adresse} onChange={(e) => set({ adresse: e.target.value.slice(0, 400) })} placeholder={"Hauptplatz 1\n4020 Linz"} /></div>
          <div className="grid grid-3" style={{ gap: 12 }}>
            <div className="field"><label className="label" htmlFor="f-uid">UID-Nummer</label><input id="f-uid" className="input mono" value={firma.uid} onChange={(e) => set({ uid: e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 20) })} placeholder="ATU12345678" /></div>
            <div className="field">
              <label className="label" htmlFor="f-iban">IBAN</label>
              <input id="f-iban" className="input mono" value={firma.iban} onChange={(e) => set({ iban: e.target.value.toUpperCase().slice(0, 40) })} placeholder="AT61 1904 3002 3457 3201" />
              {firma.iban && !ibanGueltig(firma.iban) && <span className="help" style={{ color: "var(--red)" }}>Prüfziffer stimmt nicht</span>}
            </div>
            <div className="field"><label className="label" htmlFor="f-bic">BIC (optional)</label><input id="f-bic" className="input mono" value={firma.bic} onChange={(e) => set({ bic: e.target.value.toUpperCase().slice(0, 15) })} /></div>
          </div>
          <label className="row small" style={{ gap: 10 }}>
            <Toggle label="Kleinunternehmer:in" checked={firma.kleinunternehmer} onChange={(v) => set({ kleinunternehmer: v })} />
            <span>Kleinunternehmer:in – Rechnungen ohne Umsatzsteuer mit Hinweis nach § 6 Abs. 1 Z 27 UStG</span>
          </label>
        </div>
      )}
      {warnKlein && <div className="notice notice-orange small"><span>⚠️</span><span>Laut Berechnung überschreitest du die Kleinunternehmergrenze – ab dem Überschreiten musst du Umsatzsteuer verrechnen. Prüfe die Einstellung.</span></div>}
    </section>
  );
}

function Editor({ value, firma, vorschlaege, onSave, onAusstellen, onCancel, onDelete }: {
  value: Rechnung; firma: Firma; vorschlaege: Rechnung["kunde"][];
  onSave: (r: Rechnung) => void; onAusstellen: (r: Rechnung) => void; onCancel: () => void; onDelete?: () => void;
}) {
  const [r, setR] = useState(value);
  const s = rechnungSummen(r, firma);
  const p = pflichtangaben({ ...r, nummer: r.nummer || "vorläufig" }, firma);
  const setPos = (i: number, patch: Partial<Rechnung["positionen"][number]>) => setR({ ...r, positionen: r.positionen.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const hinweis = steuerHinweis(r, firma);
  return (
    <section className="card card-lg stack fade-in" aria-label="Rechnung bearbeiten">
      <h2 className="title-2">{value.nummer ? `Rechnung ${value.nummer}` : "Neue Rechnung (Entwurf)"}</h2>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="k-name">Kund:in</label>
          <input id="k-name" className="input" list="kunden" value={r.kunde.name} onChange={(e) => {
            const name = e.target.value.slice(0, 200);
            const k = vorschlaege.find((x) => x.name === name);
            setR({ ...r, kunde: k ? { ...k } : { ...r.kunde, name } });
          }} placeholder="Muster GmbH" />
          <datalist id="kunden">{vorschlaege.map((k) => <option key={k.name} value={k.name} />)}</datalist>
        </div>
        <div className="field"><label className="label" htmlFor="k-uid">UID der Kund:in</label><input id="k-uid" className="input mono" value={r.kunde.uid} onChange={(e) => setR({ ...r, kunde: { ...r.kunde, uid: e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 20) } })} placeholder="nur bei Unternehmen" /></div>
      </div>
      <div className="field"><label className="label" htmlFor="k-adr">Anschrift der Kund:in</label><textarea id="k-adr" className="input" rows={2} value={r.kunde.adresse} onChange={(e) => setR({ ...r, kunde: { ...r.kunde, adresse: e.target.value.slice(0, 400) } })} /></div>
      <div className="grid grid-3" style={{ gap: 12 }}>
        <div className="field"><label className="label" htmlFor="r-dat">Rechnungsdatum</label><input id="r-dat" className="input" type="date" value={r.datum} onChange={(e) => setR({ ...r, datum: e.target.value })} /></div>
        <div className="field"><label className="label" htmlFor="r-von">Leistung am / ab</label><input id="r-von" className="input" type="date" value={r.leistungVon} onChange={(e) => setR({ ...r, leistungVon: e.target.value })} /></div>
        <div className="field"><label className="label" htmlFor="r-bis">bis (optional)</label><input id="r-bis" className="input" type="date" value={r.leistungBis} onChange={(e) => setR({ ...r, leistungBis: e.target.value })} /></div>
      </div>

      <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
        <span className="label">Leistungen</span>
        {r.positionen.map((x, i) => (
          <div key={i} className="card card-flat" style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 3fr) repeat(4, minmax(0, 1fr)) auto", alignItems: "end", padding: 12 }}>
            <div className="field" style={{ gridColumn: "1 / -1" }}><span className="tiny muted">Bezeichnung</span><input className="input" aria-label={`Bezeichnung ${i + 1}`} value={x.text} onChange={(e) => setPos(i, { text: e.target.value.slice(0, 300) })} placeholder="z. B. Webdesign Startseite" /></div>
            <div className="field" style={{ gridColumn: "1 / 2" }}><span className="tiny muted">Menge</span><NumberInput ariaLabel={`Menge ${i + 1}`} value={x.menge} max={1_000_000} onChange={(v) => setPos(i, { menge: v })} /></div>
            <div className="field"><span className="tiny muted">Einheit</span><input className="input" aria-label={`Einheit ${i + 1}`} value={x.einheit} onChange={(e) => setPos(i, { einheit: e.target.value.slice(0, 20) })} /></div>
            <div className="field" style={{ gridColumn: "span 2" }}><span className="tiny muted">Einzelpreis netto</span><MoneyInput ariaLabel={`Einzelpreis ${i + 1}`} value={x.preis} onChange={(v) => setPos(i, { preis: v })} /></div>
            <div className="field">
              <span className="tiny muted">USt</span>
              <select className="select" aria-label={`USt-Satz ${i + 1}`} value={x.ustSatz} disabled={s.ohneUst} onChange={(e) => setPos(i, { ustSatz: Number(e.target.value) as 20 | 13 | 10 | 0 })}>
                {[20, 13, 10, 0].map((v) => <option key={v} value={v}>{v} %</option>)}
              </select>
            </div>
            <button className="btn btn-ghost btn-sm" aria-label={`Position ${i + 1} entfernen`} disabled={r.positionen.length === 1} onClick={() => setR({ ...r, positionen: r.positionen.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} disabled={r.positionen.length >= 50} onClick={() => setR({ ...r, positionen: [...r.positionen, { text: "", menge: 1, einheit: "Stk.", preis: 0, ustSatz: r.positionen.at(-1)?.ustSatz ?? 20 }] })}>+ Position</button>
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field"><span className="label">Zahlungsziel</span><NumberInput ariaLabel="Zahlungsziel in Tagen" value={r.zahlungszielTage} max={365} suffix="Tage" onChange={(v) => setR({ ...r, zahlungszielTage: v })} /></div>
        <label className="row small" style={{ gap: 10, alignSelf: "end" }}>
          <Toggle label="Reverse Charge" checked={r.reverseCharge} onChange={(v) => setR({ ...r, reverseCharge: v })} />
          <span>Reverse Charge (Leistung an Unternehmen im EU-Ausland)</span>
        </label>
      </div>
      <div className="field"><label className="label" htmlFor="r-notiz">Notiz auf der Rechnung (optional)</label><textarea id="r-notiz" className="input" rows={2} value={r.notiz} onChange={(e) => setR({ ...r, notiz: e.target.value.slice(0, 1000) })} placeholder="Danke für den Auftrag!" /></div>

      <div className="list">
        <div className="list-item"><span className="grow">Summe netto</span><span className="num">{eur(s.netto)}</span></div>
        {!s.ohneUst && s.saetze.map((x) => <div key={x.satz} className="list-item"><span className="grow">{x.satz} % USt von {eur(x.netto)}</span><span className="num">{eur(x.ust)}</span></div>)}
        <div className="list-item strong"><span className="grow">Gesamtbetrag</span><span className="value num">{eur(s.brutto)}</span></div>
        {hinweis && <div className="list-item tiny muted">{hinweis}</div>}
      </div>

      {(p.fehler.length > 0 || p.hinweise.length > 0) && (
        <div className={`notice ${p.fehler.length ? "notice-orange" : "notice-blue"} small`}>
          <span>{p.fehler.length ? "📋" : "ℹ️"}</span>
          <div>
            {p.fehler.length > 0 && <><strong>Für eine gültige Rechnung fehlt noch:</strong><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{p.fehler.map((f) => <li key={f}>{f}</li>)}</ul></>}
            {p.hinweise.length > 0 && <ul style={{ margin: p.fehler.length ? "6px 0 0" : 0, paddingLeft: 18 }}>{p.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
          </div>
        </div>
      )}

      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="btn" disabled={p.fehler.length > 0 || s.brutto <= 0} onClick={() => onAusstellen(r)}>✓ Ausstellen</button>
        <button className="btn btn-secondary" onClick={() => onSave(r)}>Entwurf speichern</button>
        <button className="btn btn-ghost" onClick={onCancel}>Abbrechen</button>
        {onDelete && <button className="btn btn-ghost" style={{ color: "var(--red)" }} onClick={onDelete}>Entwurf löschen</button>}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>Beim Ausstellen bekommt die Rechnung die nächste fortlaufende Nummer und kann danach nicht mehr geändert werden – Korrekturen laufen über Storno und neue Rechnung.</p>
    </section>
  );
}

export default function Rechnungen() {
  const { data, update, year, result, saveState } = useCase();
  const [idx, setIdx] = useState(0);
  const [edit, setEdit] = useState<Rechnung | null>(null);
  const [zahlung, setZahlung] = useState<{ id: string; datum: string } | null>(null);
  const toast = useToast();
  if (!data || !result) return <div className="shimmer" style={{ height: 240, borderRadius: 18 }} />;

  const header = (
    <header className="app-header">
      <div>
        <p className="eyebrow">Selbständig · {year}</p>
        <h1 className="title">Rechnungen</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>Rechnungen mit allen Pflichtangaben schreiben, als PDF verschicken – bezahlte Rechnungen landen automatisch im Journal.</p>
      </div>
    </header>
  );
  const i = Math.min(idx, Math.max(0, data.betriebe.length - 1));
  const b = data.betriebe[i];
  if (!b)
    return (
      <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
        {header}
        <div className="notice notice-blue small"><span>💼</span><span>Lege zuerst unter <Link href="/app/profil">Über dich → Weitere Einkünfte</Link> deine selbständige Tätigkeit an.</span></div>
      </div>
    );

  const setB = (fn: (x: Betrieb) => void) => update((d) => fn(d.betriebe[i]!));
  const speichern = (r: Rechnung) => setB((x) => {
    const j = x.rechnungen.findIndex((y) => y.id === r.id);
    if (j >= 0) x.rechnungen[j] = r;
    else x.rechnungen.push(r);
  });
  const ausstellen = (r: Rechnung) => {
    const fertig = { ...r, nummer: naechsteNummer(b.rechnungen.filter((y) => y.ausgestelltAm), Number(r.datum.slice(0, 4)) || year), ausgestelltAm: new Date().toISOString().slice(0, 10) };
    speichern(fertig);
    setEdit(null);
    toast.show(`✓ Rechnung ${fertig.nummer} ausgestellt`);
  };
  const liste = [...b.rechnungen].sort((x, y) => (y.nummer || "~").localeCompare(x.nummer || "~") || y.datum.localeCompare(x.datum));
  const op = offenePosten(b);
  const ueber = op.filter((o) => o.ueberfaellig);
  const pdf = (r: Rechnung) => `/api/rechnungen/pdf?year=${year}&betrieb=${encodeURIComponent(b.id)}&id=${encodeURIComponent(r.id)}`;
  // Vorgabe für neue Rechnungen: heute, außer man arbeitet in einem anderen Steuerjahr
  const standardDatum = new Date().getFullYear() === year ? new Date().toISOString().slice(0, 10) : `${year}-12-31`;
  const warnKlein = b.firma.kleinunternehmer && !!result.umsatzsteuer && !result.umsatzsteuer.kleinunternehmer;

  return (
    <div className="stack fade-in" style={{ "--gap": "24px" } as React.CSSProperties}>
      {header}
      {data.betriebe.length > 1 && (
        <div className="segmented" style={{ alignSelf: "flex-start" }}>
          {data.betriebe.map((x, j) => <button key={x.id} type="button" aria-pressed={j === i} onClick={() => { setIdx(j); setEdit(null); }}>{x.bezeichnung || `Betrieb ${j + 1}`}</button>)}
        </div>
      )}
      <FirmaKarte firma={b.firma} warnKlein={warnKlein} onChange={(f) => setB((x) => void (x.firma = f))} />

      <section className="grid grid-3">
        <div className="card"><div className="tiny muted">Offen</div><div className="title-2 num">{eur(op.reduce((s, o) => s + o.brutto, 0))}</div><div className="tiny muted">{op.length} Rechnung(en)</div></div>
        <div className="card"><div className="tiny muted">Überfällig</div><div className="title-2 num" style={{ color: ueber.length ? "var(--red)" : undefined }}>{eur(ueber.reduce((s, o) => s + o.brutto, 0))}</div><div className="tiny muted">{ueber.length} Rechnung(en)</div></div>
        <div className="card"><div className="tiny muted">Bezahlt {year}</div><div className="title-2 num">{eur(b.rechnungen.filter((r) => rechnungStatus(r) === "bezahlt" && r.bezahltAm.startsWith(`${year}-`)).reduce((s, r) => s + rechnungSummen(r, b.firma).brutto, 0))}</div><div className="tiny muted">im Journal gebucht</div></div>
      </section>

      {edit ? (
        <Editor key={edit.id} value={edit} firma={b.firma} vorschlaege={kunden(b.rechnungen)} onSave={(r) => { speichern(r); setEdit(null); toast.show("Entwurf gespeichert"); }} onAusstellen={ausstellen} onCancel={() => setEdit(null)}
          onDelete={b.rechnungen.some((y) => y.id === edit.id) ? () => { setB((x) => void (x.rechnungen = x.rechnungen.filter((y) => y.id !== edit.id))); setEdit(null); } : undefined} />
      ) : (
        <button className="btn btn-lg" style={{ alignSelf: "flex-start" }} onClick={() => setEdit(neueRechnung(uid(), new Date(`${standardDatum}T12:00:00Z`)))}>+ Neue Rechnung</button>
      )}

      <section className="stack">
        <h2 className="title-2">Alle Rechnungen</h2>
        {liste.length === 0 && <p className="muted">Noch keine Rechnungen.</p>}
        <div className="list">
          {liste.map((r) => {
            const st = rechnungStatus(r);
            const s = rechnungSummen(r, b.firma);
            return (
              <div key={r.id} className="list-item" style={{ flexWrap: "wrap", gap: 10 }}>
                <span className="grow" style={{ minWidth: 180 }}>
                  <strong>{r.nummer || "Entwurf"}</strong> · {r.kunde.name || "ohne Kund:in"}
                  <div className="tiny muted">{de(r.datum)}{st === "offen" || st === "ueberfaellig" ? ` · fällig ${de(faelligAm(r))}` : st === "bezahlt" ? ` · bezahlt ${de(r.bezahltAm)}` : ""}</div>
                </span>
                <span className="num">{eur(s.brutto)}</span>
                <span className={`badge ${STATUS[st][1]}`}>{STATUS[st][0]}</span>
                <span className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                  {st === "entwurf" && <button className="btn btn-secondary btn-sm" onClick={() => setEdit(r)}>Bearbeiten</button>}
                  {st !== "entwurf" && (saveState === "saving" ? <span className="btn btn-ghost btn-sm" aria-disabled="true" style={{ opacity: 0.5 }}>Speichert …</span> : <a className="btn btn-ghost btn-sm" href={pdf(r)}>PDF</a>)}
                  {(st === "offen" || st === "ueberfaellig") && <button className="btn btn-secondary btn-sm" onClick={() => setZahlung({ id: r.id, datum: new Date().toISOString().slice(0, 10) })}>Bezahlt</button>}
                  {st === "bezahlt" && <button className="btn btn-ghost btn-sm" onClick={() => setB((x) => void (x.rechnungen.find((y) => y.id === r.id)!.bezahltAm = ""))}>Zahlung zurücknehmen</button>}
                  {st !== "entwurf" && st !== "storniert" && <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => confirm(`Rechnung ${r.nummer} stornieren?`) && setB((x) => { const y = x.rechnungen.find((z) => z.id === r.id)!; y.storniert = true; })}>Storno</button>}
                  {st !== "entwurf" && <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...r, id: uid(), nummer: "", ausgestelltAm: "", bezahltAm: "", storniert: false, datum: standardDatum })}>Kopieren</button>}
                </span>
                {zahlung?.id === r.id && (
                  <div className="row fade-in" style={{ flexBasis: "100%", flexWrap: "wrap" }}>
                    <label className="small" htmlFor={`z-${r.id}`}>Zahlungseingang am</label>
                    <input id={`z-${r.id}`} className="input" type="date" style={{ maxWidth: 180 }} value={zahlung.datum} onChange={(e) => setZahlung({ id: r.id, datum: e.target.value })} />
                    <button className="btn btn-sm" disabled={!zahlung.datum} onClick={() => {
                      setB((x) => void (x.rechnungen.find((y) => y.id === r.id)!.bezahltAm = zahlung.datum));
                      setZahlung(null);
                      toast.show(zahlung.datum.startsWith(`${year}-`) ? "✓ Bezahlt – als Erlös im Journal gebucht" : `Bezahlt – die Zahlung zählt für ${zahlung.datum.slice(0, 4)}, trag sie dort im Journal ein`);
                    }}>Übernehmen</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setZahlung(null)}>Abbrechen</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          Einnahmen zählen im Jahr der Zahlung (Zufluss-Abfluss-Prinzip). Rechnungen 7 Jahre aufbewahren (§ 132 BAO) – das PDF kannst du jederzeit neu erzeugen. <Link href="/app/buchhaltung">Zum Journal</Link>
        </p>
      </section>
      {toast.node}
    </div>
  );
}
