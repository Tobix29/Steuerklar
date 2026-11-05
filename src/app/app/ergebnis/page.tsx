"use client";
import { useState } from "react";
import { eur, pct } from "@/lib/client/api";
import type { Line } from "@/lib/tax/types";
import { insights } from "@/lib/tax/insights";
import Link from "next/link";
import { useCase } from "../CaseContext";

function Lines({ items }: { items: Line[] }) {
  return (
    <>
      {items.map((l, i) => (
        <div className="list-item" key={i}>
          <div className="grow">
            <div>{l.label}</div>
            {l.hint && <div className="tiny muted">{l.hint}</div>}
          </div>
          <span className="value">{eur(l.amount)}</span>
        </div>
      ))}
    </>
  );
}

function Item({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className={`list-item${strong ? " strong" : ""}`}>
      <div className="grow">
        <div>{label}</div>
        {hint && <div className="tiny muted">{hint}</div>}
      </div>
      <span className="value">{value}</span>
    </div>
  );
}

export default function Ergebnis() {
  const { result: r, year, data } = useCase();
  const [confirmed, setConfirmed] = useState(false);
  if (!r || !data) return <div className="shimmer" style={{ height: 400, borderRadius: 18 }} />;
  const hasIncome = r.laufendeBezuege > 0 || r.weitereEinkuenfte.length > 0;
  const spar = hasIncome ? insights(data, r) : null;
  const maxEffect = Math.max(1, ...(spar?.contributions.map((c) => c.effect) ?? [1]));

  return (
    <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Schritt 3</p>
          <h1 className="title">{r.e1Erforderlich ? "Deine Einkommensteuererklärung" : "Deine Arbeitnehmerveranlagung"} {year}</h1>
        </div>
      </header>

      <Link href="/app/abgabe" className="list-item card" style={{ color: "var(--text)" }}>
        <span className="icon-tile">📤</span>
        <span className="grow"><strong>Abgeben lassen</strong><div className="tiny muted">Deine Partner-Kanzlei prüft und bringt die Erklärung über FinanzOnline ein – du gibst nur frei.</div></span>
        <span className="muted">›</span>
      </Link>

      {!hasIncome && <div className="notice notice-blue">Lade zuerst deinen Lohnzettel (L16) hoch, um ein Ergebnis zu erhalten.</div>}

      <section className="card card-lg center">
        <p className="muted small" style={{ margin: 0 }}>{r.erstattung >= 0 ? "Voraussichtliche Gutschrift" : "Voraussichtliche Nachforderung"}</p>
        <div className={`big-number ${r.erstattung >= 0 ? "refund" : "payment"}`} style={{ margin: "10px 0" }}>{eur(Math.abs(r.erstattung))}</div>
        <div className="row" style={{ justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <div><div className="tiny muted">Grenzsteuersatz</div><strong className="num">{pct(r.grenzsteuersatz)}</strong></div>
          <div><div className="tiny muted">Durchschnittssteuersatz</div><strong className="num">{pct(r.durchschnittssteuersatz)}</strong></div>
          <div><div className="tiny muted">Einkommen</div><strong className="num">{eur(r.einkommen, 0)}</strong></div>
        </div>
        {r.provisional && <p className="tiny muted" style={{ marginTop: 14 }}>Prognose – einzelne Parameter für {year} sind noch nicht amtlich verifiziert.</p>}
      </section>

      {spar && (spar.contributions.length > 0 || spar.tips.length > 0) && (
        <section className="stack" style={{ "--gap": "10px" } as React.CSSProperties} id="spar-check">
          <h2 className="title-2">Spar-Check</h2>
          {spar.contributions.length > 0 && (
            <div className="list">
              {spar.contributions.map((c) => (
                <div className="list-item" key={c.key} style={{ flexWrap: "wrap", rowGap: 6 }}>
                  <span className="grow">{c.label}</span>
                  <span className="value refund" style={{ fontWeight: 600 }}>+ {eur(c.effect)}</span>
                  <div className="progress" style={{ flexBasis: "100%", height: 4 }}>
                    <div style={{ width: `${(c.effect / maxEffect) * 100}%`, background: "var(--green)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {spar.tips.map((t) => (
            <div key={t.key} className="notice notice-blue small">
              <span>{t.icon}</span>
              <div className="stack" style={{ "--gap": "4px" } as React.CSSProperties}>
                <strong>{t.title}</strong>
                <span>{t.text}</span>
                {t.href && <Link href={t.href}>Jetzt anpassen ›</Link>}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
        <h2 className="title-2">So trägst du es in FinanzOnline ein</h2>
        <p className="muted small" style={{ margin: 0 }}>
          {r.e1Erforderlich
            ? "FinanzOnline → Eingaben → Erklärungen → Einkommensteuererklärung (E1) mit den Beilagen E1a/E1b. Den Lohnzettel hat das Finanzamt bereits."
            : "FinanzOnline → Eingaben → Erklärungen → Arbeitnehmerveranlagung (L1). Den Lohnzettel hat das Finanzamt bereits."}
        </p>
        <div className="list">
          {r.formular.length === 0 && <div className="list-item muted">Keine zusätzlichen Eintragungen nötig – Pauschalen werden automatisch berücksichtigt.</div>}
          {r.formular.map((f, i) => (
            <div className="list-item" key={i}>
              <span className="badge badge-blue" style={{ minWidth: 74, justifyContent: "center" }}>{f.formular}{f.kz !== "—" ? ` · ${f.kz}` : ""}</span>
              <span className="grow">{f.label}</span>
              <span className="value">{f.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="section-label">Steuer im Vergleich</p>
        <div className="list">
          <Item label="Einkommensteuer laut Berechnung" value={eur(r.einkommensteuer)} hint={`davon ${eur(r.steuerSonstigeBezuege)} auf 13./14. Gehalt`} />
          <Item label="Bereits einbehaltene Lohnsteuer" value={eur(r.anrechenbareLohnsteuer)} />
          <Item label={r.erstattung >= 0 ? "Gutschrift" : "Nachforderung"} value={eur(Math.abs(r.erstattung))} strong />
        </div>
      </section>

      <section>
        <p className="section-label">Bezüge & Werbungskosten</p>
        <div className="list">
          <Item label="Laufende steuerpflichtige Bezüge" value={eur(r.laufendeBezuege)} />
          <Lines items={r.werbungskosten} />
          <Item label="Einkünfte aus nichtselbständiger Arbeit" value={eur(r.einkuenfte)} strong />
        </div>
      </section>

      {r.weitereEinkuenfte.length > 0 && (
        <section>
          <p className="section-label">{r.e1Erforderlich ? "Weitere Einkünfte (E1)" : "Weitere Einkünfte"}</p>
          <div className="list">
            {r.weitereEinkuenfte.map((l, i) => (
              <Item key={i} label={l.label} value={eur(l.amount)} hint={l.hint} strong={l.label.startsWith("Einkünfte")} />
            ))}
            {r.veranlagungsfreibetrag > 0 && <Item label="Veranlagungsfreibetrag (Nebeneinkünfte bis 730 €)" value={`− ${eur(r.veranlagungsfreibetrag)}`} />}
            <Item label="Gesamtbetrag der Einkünfte" value={eur(r.gesamtbetragDerEinkuenfte)} strong />
          </div>
        </section>
      )}

      <section>
        <p className="section-label">Vom Einkommen zur Steuer</p>
        <div className="list">
          <Lines items={r.sonderausgaben} />
          <Lines items={r.aussergewoehnlicheBelastungen} />
          <Item label="Einkommen" value={eur(r.einkommen)} strong />
          <Item label="Steuer laut Tarif" value={eur(r.tarifsteuer)} />
          {r.absetzbetraege.map((l, i) => <Item key={i} label={l.label} value={`− ${eur(l.amount)}`} hint={l.hint} />)}
          {r.negativsteuer.map((l, i) => <Item key={`n${i}`} label={l.label} value={`− ${eur(l.amount)}`} hint={l.hint} />)}
          <Item label="Steuer auf sonstige Bezüge (Jahressechstel)" value={`+ ${eur(r.steuerSonstigeBezuege)}`} />
        </div>
      </section>

      {r.immoESt && (
        <section>
          <p className="section-label">Immobilienertragsteuer</p>
          <div className="list">
            {r.immoESt.lines.map((l, i) => <Item key={i} label={l.label} value={eur(l.amount)} hint={l.hint} />)}
            <Item label="ImmoESt gesamt" value={eur(r.immoESt.steuer)} strong />
            <Item label="Vom Notar abgeführt" value={eur(r.immoESt.abgefuehrt)} hint={r.immoESt.regelGuenstiger ? "Regelbesteuerung ist günstiger – Differenz in der Gutschrift enthalten" : undefined} />
          </div>
        </section>
      )}

      {r.umsatzsteuer && (
        <section>
          <p className="section-label">Umsatzsteuer (eigene Erklärung U1)</p>
          <div className="list">
            <Item label={r.umsatzsteuer.kleinunternehmer ? "Kleinunternehmer:in – keine Umsatzsteuer" : "Umsatzsteuerpflichtig"} value={`${eur(r.umsatzsteuer.umsatz, 0)} / ${eur(r.umsatzsteuer.grenze, 0)}`} hint="Umsatz / Kleinunternehmergrenze" />
            {!r.umsatzsteuer.kleinunternehmer && r.umsatzsteuer.lines.map((l, i) => <Item key={i} label={l.label} value={eur(l.amount)} hint={l.hint} />)}
            {!r.umsatzsteuer.kleinunternehmer && <Item label={r.umsatzsteuer.zahllast >= 0 ? "Zahllast" : "Gutschrift"} value={eur(Math.abs(r.umsatzsteuer.zahllast))} strong />}
          </div>
        </section>
      )}

      {(r.hinweise.length > 0 || r.pflichtveranlagung.length > 0) && (
        <section className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
          <h2 className="title-2">Hinweise</h2>
          {r.pflichtveranlagung.map((h) => <div key={h} className="notice notice-orange small"><span>⚠️</span><span>{h}</span></div>)}
          {r.hinweise.map((h) => <div key={h} className="notice small"><span>ℹ️</span><span>{h}</span></div>)}
        </section>
      )}

      <section className="card card-lg stack">
        <h2 className="title-2">Ausfüllhilfe herunterladen</h2>
        <p className="muted" style={{ margin: 0 }}>
          Alle Eintragungen mit Kennzahl, deine Belege und die vollständige Berechnung als PDF – zum Abhaken beim Ausfüllen in FinanzOnline.
        </p>
        <label className="row small" style={{ alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
          <span>Ich habe alle Angaben geprüft. Sie sind nach bestem Wissen vollständig und richtig.</span>
        </label>
        <div className="row wrap">
          <a className="btn btn-lg" aria-disabled={!confirmed || !hasIncome}
            href={confirmed && hasIncome ? `/api/case/pdf?year=${year}` : undefined} style={!confirmed || !hasIncome ? { opacity: 0.45, pointerEvents: "none" } : undefined}>
            ⬇︎ PDF herunterladen
          </a>
          <a className="btn btn-secondary btn-lg" href="https://finanzonline.bmf.gv.at" target="_blank" rel="noopener noreferrer">FinanzOnline öffnen ↗</a>
        </div>
      </section>
    </div>
  );
}
