"use client";
import { useState } from "react";
import { eur, pct } from "@/lib/client/api";
import type { Line } from "@/lib/tax/types";
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
  const { result: r, data, year } = useCase();
  const [confirmed, setConfirmed] = useState(false);
  if (!r || !data) return <div className="shimmer" style={{ height: 400, borderRadius: 18 }} />;
  const hasIncome = r.persons.some((p) => p.bruttoarbeitslohn > 0);

  return (
    <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Schritt 3</p>
          <h1 className="title">Dein Ergebnis {year}</h1>
        </div>
      </header>

      {!hasIncome && <div className="notice notice-blue">Lade zuerst deine Lohnsteuerbescheinigung hoch, um ein Ergebnis zu erhalten.</div>}

      <section className="card card-lg center">
        <p className="muted small" style={{ margin: 0 }}>{r.erstattung >= 0 ? "Voraussichtliche Erstattung" : "Voraussichtliche Nachzahlung"}</p>
        <div className={`big-number ${r.erstattung >= 0 ? "refund" : "payment"}`} style={{ margin: "10px 0" }}>{eur(Math.abs(r.erstattung))}</div>
        <div className="row" style={{ justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <div><div className="tiny muted">Grenzsteuersatz</div><strong className="num">{pct(r.grenzsteuersatz)}</strong></div>
          <div><div className="tiny muted">Durchschnittssteuersatz</div><strong className="num">{pct(r.durchschnittssteuersatz)}</strong></div>
          <div><div className="tiny muted">Zu versteuerndes Einkommen</div><strong className="num">{eur(r.zuVersteuerndesEinkommen, 0)}</strong></div>
        </div>
        {r.provisional && <p className="tiny muted" style={{ marginTop: 14 }}>Prognose mit vorläufigen Parametern.</p>}
      </section>

      {r.erstattung < 0 && hasIncome && r.pflichtveranlagung.length === 0 && (
        <div className="notice notice-blue small">
          <span>💡</span>
          <span>Ohne Abgabepflicht ist die Erklärung freiwillig (Antragsveranlagung). Bei einer Nachzahlung kannst du den Antrag bis zur Bestandskraft des Bescheids zurücknehmen.</span>
        </div>
      )}

      <section>
        <p className="section-label">Steuer im Vergleich</p>
        <div className="list">
          <Item label="Festzusetzende Einkommensteuer" value={eur(r.festzusetzen.einkommensteuer)} />
          <Item label="Solidaritätszuschlag" value={eur(r.festzusetzen.soli)} />
          <Item label="Kirchensteuer" value={eur(r.festzusetzen.kirchensteuer)} />
          <Item label="Steuer laut Berechnung" value={eur(r.festzusetzen.summe)} strong />
          <Item label="Bereits über den Lohn gezahlt" value={eur(r.bereitsGezahlt.summe)} hint={`Lohnsteuer ${eur(r.bereitsGezahlt.lohnsteuer)} · Soli ${eur(r.bereitsGezahlt.soli)} · KiSt ${eur(r.bereitsGezahlt.kirchensteuer)}`} />
          <Item label={r.erstattung >= 0 ? "Erstattung" : "Nachzahlung"} value={eur(Math.abs(r.erstattung))} strong />
        </div>
      </section>

      {r.persons.map((p) => (
        <section key={p.name}>
          <p className="section-label">Arbeitslohn & Werbungskosten · {p.name}</p>
          <div className="list">
            <Item label="Bruttoarbeitslohn" value={eur(p.bruttoarbeitslohn)} />
            <Lines items={p.werbungskostenDetails} />
            <Item
              label="Angesetzte Werbungskosten"
              value={`− ${eur(p.werbungskostenAngesetzt)}`}
              strong
              hint={p.werbungskostenAngesetzt > p.werbungskostenTatsaechlich ? "Arbeitnehmer-Pauschbetrag (höher als deine Einzelkosten)" : undefined}
            />
            <Item label="Einkünfte" value={eur(p.einkuenfte)} strong />
            {p.progressionsvorbehalt > 0 && <Item label="Lohnersatzleistungen (Progressionsvorbehalt)" value={eur(p.progressionsvorbehalt)} />}
          </div>
        </section>
      ))}

      <section>
        <p className="section-label">Vom Gesamtbetrag der Einkünfte zum zu versteuernden Einkommen</p>
        <div className="list">
          <Item label="Gesamtbetrag der Einkünfte" value={eur(r.gesamtbetragDerEinkuenfte)} strong />
          {r.entlastungsbetragAlleinerziehend > 0 && <Item label="Entlastungsbetrag Alleinerziehende" value={`− ${eur(r.entlastungsbetragAlleinerziehend)}`} />}
          <Lines items={r.sonderausgaben} />
          <Lines items={r.aussergewoehnlicheBelastungen} />
          {r.kinderfreibetraegeAngesetzt && <Item label="Freibeträge für Kinder" value={`− ${eur(r.kinderfreibetraege)}`} hint="günstiger als das Kindergeld" />}
          <Item label="Zu versteuerndes Einkommen" value={eur(r.zuVersteuerndesEinkommen, 0)} strong />
          <Item label={r.filing === "joint" ? "Tarifliche Einkommensteuer (Splitting)" : "Tarifliche Einkommensteuer"} value={eur(r.tariflicheEinkommensteuer)}
            hint={r.steuersatzProgression !== null ? `Besonderer Steuersatz: ${(r.steuersatzProgression * 100).toFixed(2)} %` : undefined} />
          {r.steuerermaessigung35a.map((l, i) => <Item key={i} label={l.label} value={`− ${eur(l.amount)}`} />)}
          {r.kindergeldHinzurechnung > 0 && <Item label="Hinzurechnung Kindergeld" value={`+ ${eur(r.kindergeldHinzurechnung)}`} />}
        </div>
      </section>

      {(r.hinweise.length > 0 || r.pflichtveranlagung.length > 0) && (
        <section className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
          <h2 className="title-2">Hinweise</h2>
          {r.pflichtveranlagung.map((h) => <div key={h} className="notice notice-orange small"><span>⚠️</span><span>{h}</span></div>)}
          {r.hinweise.map((h) => <div key={h} className="notice small"><span>ℹ️</span><span>{h}</span></div>)}
        </section>
      )}

      <section className="card card-lg stack">
        <h2 className="title-2">Erklärung herunterladen</h2>
        <p className="muted" style={{ margin: 0 }}>
          Du erhältst eine vollständige Ausfüllhilfe mit allen Werten, zugeordnet zu Hauptvordruck, Anlage N, Vorsorgeaufwand, Sonderausgaben
          und Kind – zur Übertragung in Mein ELSTER. Die direkte elektronische Übermittlung folgt.
        </p>
        <label className="row small" style={{ alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
          <span>Ich habe alle Angaben geprüft. Sie sind nach bestem Wissen vollständig und richtig.</span>
        </label>
        <div className="row wrap">
          <a className={`btn btn-lg${confirmed && hasIncome ? "" : " disabled"}`} aria-disabled={!confirmed || !hasIncome}
            href={confirmed && hasIncome ? `/api/case/pdf?year=${year}` : undefined} style={!confirmed || !hasIncome ? { opacity: 0.45, pointerEvents: "none" } : undefined}>
            ⬇︎ PDF herunterladen
          </a>
          <a className="btn btn-secondary btn-lg" href="https://www.elster.de/eportal/start" target="_blank" rel="noopener noreferrer">Mein ELSTER öffnen ↗</a>
        </div>
      </section>
    </div>
  );
}
