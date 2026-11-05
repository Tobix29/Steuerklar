"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { MoneyInput, NumberInput, useToast } from "@/components/ui";
import { eur, scanBuchung, uid } from "@/lib/client/api";
import { downscale } from "@/lib/client/image";
import { alleBuchungen, E1A_KATEGORIEN, E1A_KEYS, journalSummen, type Buchung, type E1aKategorie } from "@/lib/tax/journal";
import { useCase } from "../CaseContext";

const MONATE = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const datumDe = (iso: string) => iso.split("-").reverse().join(".");

function Editor({ value, year, onSave, onCancel, onDelete }: { value: Buchung; year: number; onSave: (b: Buchung) => void; onCancel: () => void; onDelete?: () => void }) {
  const [b, setB] = useState(value);
  const k = E1A_KATEGORIEN[b.kategorie];
  const brutto = Math.round((b.netto + b.ust) * 100) / 100;
  return (
    <div className="card card-flat stack fade-in" style={{ "--gap": "12px" } as React.CSSProperties}>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="bu-datum">Datum (Zahlung)</label>
          <input id="bu-datum" className="input" type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={b.datum} onChange={(e) => setB({ ...b, datum: e.target.value })} />
        </div>
        <div className="field">
          <label className="label" htmlFor="bu-kat">Kategorie</label>
          <select id="bu-kat" className="select" value={b.kategorie} onChange={(e) => setB({ ...b, kategorie: e.target.value as E1aKategorie })}>
            <optgroup label="Einnahmen">
              {E1A_KEYS.filter((x) => E1A_KATEGORIEN[x].art === "einnahme").map((x) => <option key={x} value={x}>{E1A_KATEGORIEN[x].label}</option>)}
            </optgroup>
            <optgroup label="Ausgaben">
              {E1A_KEYS.filter((x) => E1A_KATEGORIEN[x].art === "ausgabe").map((x) => <option key={x} value={x}>{E1A_KATEGORIEN[x].label}</option>)}
            </optgroup>
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="bu-text">Beschreibung</label>
        <input id="bu-text" className="input" placeholder={k.art === "einnahme" ? "z. B. Honorarnote 2025-014, Kunde Muster GmbH" : "z. B. Druckerpatronen, Libro"} value={b.beschreibung} onChange={(e) => setB({ ...b, beschreibung: e.target.value.slice(0, 200) })} />
      </div>
      <div className="grid grid-3" style={{ gap: 12 }}>
        <div className="field"><span className="label">Netto</span><MoneyInput ariaLabel="Netto" value={b.netto} onChange={(v) => setB({ ...b, netto: v })} /></div>
        <div className="field"><span className="label">{k.art === "einnahme" ? "Umsatzsteuer" : "Vorsteuer"}</span><MoneyInput ariaLabel="Umsatzsteuer" value={b.ust} onChange={(v) => setB({ ...b, ust: v })} /></div>
        {k.art === "ausgabe" ? (
          <div className="field"><span className="label">Privatanteil</span><NumberInput ariaLabel="Privatanteil" value={b.privatanteil} max={100} suffix="%" onChange={(v) => setB({ ...b, privatanteil: v })} /></div>
        ) : (
          <div className="field"><span className="label">Brutto</span><div className="input num" style={{ display: "flex", alignItems: "center" }}>{eur(brutto)}</div></div>
        )}
      </div>
      {"anteil" in k && <p className="tiny muted" style={{ margin: 0 }}>Geschäftsessen sind nur zur Hälfte absetzbar (§ 20 Abs. 1 Z 3 EStG) und nur, wenn sie überwiegend der Werbung dienen. Notiere Anlass und Gäste.</p>}
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="btn" disabled={!b.datum.startsWith(`${year}-`) || b.netto <= 0} onClick={() => onSave(b)}>Speichern</button>
        <button className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
        {onDelete && <button className="btn btn-ghost" style={{ color: "var(--red)" }} onClick={onDelete}>Löschen</button>}
      </div>
      {!b.datum.startsWith(`${year}-`) && <p className="tiny" style={{ margin: 0, color: "var(--orange)" }}>Das Datum muss im Jahr {year} liegen – es zählt der Tag der Zahlung (Zufluss-Abfluss-Prinzip).</p>}
    </div>
  );
}

export default function Buchhaltung() {
  const { data, update, year } = useCase();
  const [idx, setIdx] = useState(0);
  const [edit, setEdit] = useState<Buchung | null>(null);
  const [busy, setBusy] = useState(false);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  if (!data) return <div className="shimmer" style={{ height: 200, borderRadius: 18 }} />;

  const betriebe = data.betriebe;
  const i = Math.min(idx, Math.max(0, betriebe.length - 1));
  const betrieb = betriebe[i];
  const header = (
    <header className="app-header">
      <div>
        <p className="eyebrow">Selbständig · {year}</p>
        <h1 className="title">Buchhaltung</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>Einnahmen-Ausgaben-Journal: Rechnung fotografieren, prüfen, fertig. Am Jahresende stehen Gewinn und Umsatzsteuer automatisch fest.</p>
      </div>
    </header>
  );
  if (!betrieb)
    return (
      <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
        {header}
        <div className="notice notice-blue small"><span>💼</span><span>Lege zuerst unter <Link href="/app/profil">Über dich → Weitere Einkünfte</Link> deine selbständige Tätigkeit an.</span></div>
      </div>
    );

  const alle = alleBuchungen(betrieb);
  const s = journalSummen(alle, year);
  const buchungen = alle.filter((b) => b.datum.startsWith(`${year}-`)).sort((a, b) => b.datum.localeCompare(a.datum));
  const save = (b: Buchung) => {
    update((d) => {
      const list = d.betriebe[i]!.buchungen;
      const j = list.findIndex((x) => x.id === b.id);
      if (j >= 0) list[j] = b;
      else list.push(b);
    });
    setEdit(null);
    toast.show("✓ Gebucht");
  };
  const remove = (id: string) => {
    update((d) => void (d.betriebe[i]!.buchungen = d.betriebe[i]!.buchungen.filter((x) => x.id !== id)));
    setEdit(null);
  };
  const leer = (): Buchung => ({ id: uid(), datum: `${year}-${String(Math.min(12, new Date().getMonth() + 1)).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`, kategorie: "sonstige", beschreibung: "", netto: 0, ust: 0, privatanteil: 0 });

  async function scan(file: File) {
    setBusy(true);
    setHinweise([]);
    try {
      const { buchung: v } = await scanBuchung(await downscale(file), year);
      const base = leer();
      setEdit({
        ...base,
        datum: v.datum && v.datum.startsWith(`${year}-`) ? v.datum : base.datum,
        kategorie: v.kategorie,
        beschreibung: [v.beschreibung, v.partner].filter(Boolean).join(" · ").slice(0, 200),
        netto: v.netto ?? 0,
        ust: v.ust ?? 0,
        privatanteil: v.privatanteilVorschlag ?? 0,
      });
      setHinweise([...(v.datum && !v.datum.startsWith(`${year}-`) ? [`Der Beleg ist vom ${datumDe(v.datum)} – gebucht wird nach dem Zahlungsdatum im Jahr ${year}.`] : []), ...v.hinweise]);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  const monate = new Map<number, Buchung[]>();
  for (const b of buchungen) {
    const m = Number(b.datum.slice(5, 7));
    monate.set(m, [...(monate.get(m) ?? []), b]);
  }
  const ustSaldo = Math.round((s.ustEinnahmen - s.vorsteuer) * 100) / 100;

  return (
    <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
      {header}
      {betriebe.length > 1 && (
        <div className="segmented" style={{ alignSelf: "flex-start" }}>
          {betriebe.map((b, j) => <button key={b.id} type="button" aria-pressed={j === i} onClick={() => setIdx(j)}>{b.bezeichnung || `Betrieb ${j + 1}`}</button>)}
        </div>
      )}
      {betrieb.gewinnermittlung !== "ear" && (
        <div className="notice notice-orange small"><span>ℹ️</span><span>Bei Pauschalierung zählen nur die Einnahmen aus dem Journal – die Ausgaben sind in der Pauschale enthalten. Das Journal hilft dir trotzdem beim Vergleich, ob sich die Einnahmen-Ausgaben-Rechnung mehr lohnt.</span></div>
      )}

      <section className="grid grid-3">
        <div className="card"><div className="tiny muted">Einnahmen (netto)</div><div className="title-2 num">{eur(s.einnahmen, 0)}</div></div>
        <div className="card"><div className="tiny muted">Ausgaben inkl. SVS</div><div className="title-2 num">{eur(s.ausgaben + s.svs, 0)}</div></div>
        <div className="card">
          <div className="tiny muted">Überschuss vor AfA und Freibeträgen</div>
          <div className="title-2 num" style={{ color: s.einnahmen - s.ausgaben - s.svs >= 0 ? undefined : "var(--red)" }}>{eur(s.einnahmen - s.ausgaben - s.svs, 0)}</div>
        </div>
      </section>

      <section className="card card-lg stack">
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn" disabled={busy} onClick={() => camRef.current?.click()}>{busy ? <span className="spinner" /> : "📸"} {busy ? "KI liest …" : "Beleg fotografieren"}</button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>PDF oder Bild</button>
          <button className="btn btn-secondary" onClick={() => { setHinweise([]); setEdit(leer()); }}>+ Manuell buchen</button>
          <Link className="btn btn-secondary" href="/app/rechnungen">🧾 Rechnung schreiben</Link>
          {buchungen.length > 0 && <a className="btn btn-ghost" href={`/api/buchhaltung/csv?year=${year}&betrieb=${encodeURIComponent(betrieb.id)}`}>⬇︎ CSV-Export</a>}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void scan(f); }} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void scan(f); }} />
        </div>
        {hinweise.length > 0 && <div className="notice notice-orange small"><span>💡</span><ul style={{ margin: 0, paddingLeft: 18 }}>{hinweise.map((h, j) => <li key={j}>{h}</li>)}</ul></div>}
        {edit && <Editor key={edit.id} value={edit} year={year} onSave={save} onCancel={() => setEdit(null)} onDelete={betrieb.buchungen.some((x) => x.id === edit.id) ? () => remove(edit.id) : undefined} />}
        <p className="tiny muted" style={{ margin: 0 }}>
          Sobald du buchst, ersetzen die Buchungen die von Hand eingetragenen Summen (Einnahmen, Ausgaben, Vorsteuer, SVS). Belege 7 Jahre aufbewahren (§ 132 BAO) – Steuerklar speichert keine Bilder.
        </p>
      </section>

      {s.kategorien.length > 0 && (
        <section className="stack">
          <h2 className="title-2">Nach Kategorien (Beilage E1a)</h2>
          <div className="list">
            {s.kategorien.map((k) => (
              <div key={k.key} className="list-item">
                <span className="grow">{k.label}<div className="tiny muted">{k.anzahl} Buchung(en){k.kz ? ` · KZ ${k.kz}` : " · Kennzahl laut Formular E1a"}</div></span>
                <span className="num" style={{ color: k.art === "einnahme" ? "var(--green)" : undefined }}>{k.art === "einnahme" ? "+" : "−"}{eur(k.betrag)}</span>
              </div>
            ))}
            <div className="list-item strong">
              <span className="grow">Umsatzsteuer abzüglich Vorsteuer<div className="tiny muted">nur ohne Kleinunternehmerbefreiung – siehe Ergebnis</div></span>
              <span className="num">{eur(ustSaldo)}</span>
            </div>
          </div>
          {s.hinweise.map((h) => <div key={h} className="notice notice-orange small"><span>⚠️</span><span>{h}</span></div>)}
        </section>
      )}

      <section className="stack">
        <h2 className="title-2">Buchungen {year}</h2>
        {buchungen.length === 0 && <p className="muted">Noch keine Buchungen. Fotografiere deine erste Rechnung – die KI schlägt Kategorie, Netto und Vorsteuer vor.</p>}
        {[...monate.entries()].map(([m, list]) => (
          <div key={m} className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
            <p className="section-label" style={{ margin: "0 0 0 16px" }}>{MONATE[m - 1]}</p>
            <div className="list">
              {list.map((b) => {
                const k = E1A_KATEGORIEN[b.kategorie];
                return (
                  <button key={b.id} className="list-item" style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", color: "var(--text)" }} onClick={() => { if (b.id.startsWith("re-")) { toast.show("Diese Buchung kommt aus einer bezahlten Rechnung – ändere sie unter Rechnungen."); return; } setHinweise([]); setEdit(b); }}>
                    <span className="tiny muted" style={{ width: 44, flexShrink: 0 }}>{datumDe(b.datum).slice(0, 6)}</span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.beschreibung || k.label}</div>
                      <div className="tiny muted">{k.label}{b.privatanteil ? ` · ${b.privatanteil} % privat` : ""}{b.id.startsWith("re-") ? " · aus Rechnung" : ""}</div>
                    </span>
                    <span className="num" style={{ color: k.art === "einnahme" ? "var(--green)" : undefined }}>{k.art === "einnahme" ? "+" : "−"}{eur(b.netto + b.ust)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      {toast.node}
    </div>
  );
}
