"use client";
import { useRef, useState } from "react";
import { eur, scanBankStatement, uid } from "@/lib/client/api";
import { applyFindings, BANK_KATEGORIEN, type BankFinding } from "@/lib/ai/bank";
import { useCase } from "../CaseContext";

/** Kontoauszug (CSV) hochladen → KI schlägt absetzbare Ausgaben vor → Auswahl übernehmen. Der Auszug wird nicht gespeichert. */
export function BankImport({ onDone }: { onDone: (msg: string) => void }) {
  const { year, update } = useCase();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [findings, setFindings] = useState<(BankFinding & { key: string; selected: boolean })[] | null>(null);

  async function scan(file: File) {
    setError(null);
    setHinweis(null);
    setFindings(null);
    if (file.size > 2_000_000) {
      setError("Der Kontoauszug ist zu groß. Exportiere bitte nur das Jahr " + year + " als CSV.");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const r = await scanBankStatement(text, year);
      setHinweis(r.hinweis);
      setFindings(r.findings.map((f) => ({ ...f, key: uid(), selected: f.sicherheit !== "niedrig" })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der Kontoauszug konnte nicht ausgewertet werden.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function take() {
    const chosen = (findings ?? []).filter((f) => f.selected);
    let n = 0;
    update((d) => {
      n = applyFindings(d, chosen, uid);
    });
    setFindings(null);
    onDone(`✓ ${chosen.length} Posten übernommen – du findest sie unter „Über dich“`);
    void n;
  }

  const selectedSum = (findings ?? []).filter((f) => f.selected).reduce((a, f) => a + f.betrag * (f.beruflicherAnteil ?? 1), 0);

  return (
    <section className="card stack" style={{ "--gap": "14px" } as React.CSSProperties}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <span className="icon-tile">🏦</span>
        <div className="grow">
          <h2 className="title-2">Kontoauszug durchsuchen</h2>
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            Exportiere deine Umsätze {year} als CSV (z. B. aus George, Mein ELBA oder dem Online-Banking deiner Bank). Die KI sucht Arbeitsmittel, Kurse,
            Spenden, Arztrechnungen & Co. Der Kontoauszug wird nicht gespeichert.
          </p>
        </div>
      </div>
      <div className="row wrap">
        <button className="btn btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <><span className="spinner" /> Wird durchsucht …</> : "CSV-Datei wählen"}
        </button>
        <input ref={input} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => e.target.files?.[0] && void scan(e.target.files[0])} />
      </div>
      {error && <div className="notice notice-red small" role="alert">{error}</div>}
      {hinweis && <div className="notice small"><span>ℹ️</span><span>{hinweis}</span></div>}
      {findings && findings.length === 0 && <div className="notice small">Keine absetzbaren Ausgaben gefunden.</div>}
      {findings && findings.length > 0 && (
        <>
          <div className="list">
            {findings.map((f, i) => (
              <label key={f.key} className="list-item" style={{ cursor: "pointer", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={f.selected}
                  style={{ width: 18, height: 18, marginTop: 3 }}
                  onChange={(e) => setFindings((xs) => xs!.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))}
                />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{f.empfaenger}</div>
                  <div className="small muted">{[f.datum, f.verwendungszweck].filter(Boolean).join(" · ")}</div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>{f.begruendung}</div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <span className="badge badge-blue">{BANK_KATEGORIEN[f.kategorie]}</span>
                    {f.sicherheit !== "hoch" && <span className="badge badge-orange">unsicher</span>}
                    {f.beruflicherAnteil !== null && f.beruflicherAnteil < 1 && <span className="badge">{Math.round(f.beruflicherAnteil * 100)} % beruflich</span>}
                  </div>
                </div>
                <span className="value num">{eur(f.betrag)}</span>
              </label>
            ))}
          </div>
          <div className="row wrap">
            <button className="btn" disabled={!findings.some((f) => f.selected)} onClick={take}>
              {findings.filter((f) => f.selected).length} Posten übernehmen ({eur(selectedSum)})
            </button>
            <button className="btn btn-ghost" onClick={() => setFindings(null)}>Verwerfen</button>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>Bitte prüfe jeden Posten: Absetzbar ist nur, was du beruflich nutzt bzw. was die Voraussetzungen erfüllt. Belege aufbewahren.</p>
        </>
      )}
    </section>
  );
}
