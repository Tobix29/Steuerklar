"use client";
import Link from "next/link";
import { eur } from "@/lib/client/api";
import { insights } from "@/lib/tax/insights";
import { useCase } from "./CaseContext";
import { YearsOverview } from "./YearsOverview";

export default function Overview() {
  const { data, result, year, documentCount, error, storagePersistent } = useCase();
  if (error && !data) return <div className="notice notice-red">{error}</div>;
  if (!data || !result) return <Skeleton />;

  const hasProfile = !!data.firstName;
  const hasIncome = data.lohnzettel.length > 0;
  const hasDeductions = data.pendlerKm > 0 || data.telearbeitstage > 0 || data.werbungskosten.length > 0;
  const steps = [
    { href: "/app/profil", title: "Über dich", text: "Arbeitsweg, Telearbeit, Kinder", done: hasProfile },
    { href: "/app/belege", title: "Lohnzettel (L16)", text: "PDF aus FinanzOnline oder Foto", done: hasIncome },
    { href: "/app/belege", title: "Weitere Belege", text: "Arbeitsmittel, Fortbildung, Arzt", done: documentCount > 1 || hasDeductions },
    { href: "/app/ergebnis", title: "In FinanzOnline abgeben", text: "Kennzahlen übertragen", done: false },
  ];
  const done = steps.filter((s) => s.done).length;
  const refund = result.erstattung;

  const tips: { icon: string; text: string; href: string }[] = [];
  if (hasIncome) for (const t of insights(data, result).tips.filter((t) => t.key !== "grenz").slice(0, 2)) tips.push({ icon: t.icon, text: t.title, href: "/app/ergebnis" });
  if (hasIncome && data.pendlerKm === 0) tips.push({ icon: "🚆", text: "Weiter Arbeitsweg? Pendlerpauschale und Pendlereuro bringen oft mehrere hundert Euro.", href: "/app/profil" });
  if (hasIncome && data.telearbeitstage === 0) tips.push({ icon: "🏠", text: "Im Homeoffice gearbeitet? Telearbeitspauschale und Mobiliar bis 300 € sind absetzbar.", href: "/app/profil" });
  if (hasIncome && data.werbungskosten.length === 0) tips.push({ icon: "💻", text: "Laptop, Fachbücher, Kurse? Werbungskosten über 132 € senken deine Steuer.", href: "/app/belege" });
  if (data.children.length === 0) tips.push({ icon: "👶", text: "Kinder? Der Familienbonus Plus bringt bis zu 2.000 € pro Kind und Jahr.", href: "/app/profil" });

  return (
    <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Steuerjahr {year}</p>
          <h1 className="title">{hasProfile ? `Servus ${data.firstName}.` : "Willkommen bei Steuerklar."}</h1>
        </div>
      </header>

      {!storagePersistent && (
        <div className="notice notice-orange small">
          <span>🧪</span>
          <span><strong>Vorschau ohne Datenbank:</strong> Deine Eingaben werden nicht dauerhaft gespeichert. Für den echten Betrieb eine Postgres-Datenbank verbinden.</span>
        </div>
      )}

      <section className="card card-lg center">
        <p className="muted small" style={{ margin: 0 }}>{refund >= 0 ? "Voraussichtliche Gutschrift" : "Voraussichtliche Nachforderung"}</p>
        <div className={`big-number ${hasIncome ? (refund >= 0 ? "refund" : "payment") : ""}`} style={{ margin: "8px 0" }}>
          {hasIncome ? eur(Math.abs(refund), 0) : "– €"}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {hasIncome ? "Wird bei jeder Eingabe live neu berechnet." : "Lade deinen Lohnzettel hoch, um deine Gutschrift zu sehen."}
        </p>
        <div className="row" style={{ justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
          <Link className="btn" href="/app/belege">📸 Beleg hinzufügen</Link>
          {hasIncome && <Link className="btn btn-secondary" href="/app/ergebnis">Details ansehen</Link>}
        </div>
      </section>

      <YearsOverview />

      <section className="stack">
        <div className="row-between">
          <h2 className="title-2">Dein Fortschritt</h2>
          <span className="muted small">{done} von {steps.length}</span>
        </div>
        <div className="progress"><div style={{ width: `${(done / steps.length) * 100}%` }} /></div>
        <div className="steps">
          {steps.map((s) => (
            <Link key={s.title} href={s.href} className={`step${s.done ? " done" : ""}`}>
              <span className="check">{s.done ? "✓" : ""}</span>
              <strong style={{ fontSize: 16 }}>{s.title}</strong>
              <span className="small muted">{s.text}</span>
            </Link>
          ))}
        </div>
      </section>

      {tips.length > 0 && (
        <section className="stack">
          <h2 className="title-2">Geld, das noch liegen könnte</h2>
          <div className="list">
            {tips.map((t) => (
              <Link key={t.text} href={t.href} className="list-item" style={{ color: "var(--text)" }}>
                <span className="icon-tile">{t.icon}</span>
                <span className="grow">{t.text}</span>
                <span className="muted">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {result.pflichtveranlagung.length > 0 && hasIncome && (
        <div className="notice notice-orange small">
          <span>⚠️</span>
          <div>
            <strong>Mögliche Pflichtveranlagung</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {result.pflichtveranlagung.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
      <div className="shimmer" style={{ height: 40, width: 280 }} />
      <div className="shimmer" style={{ height: 220, borderRadius: 28 }} />
      <div className="shimmer" style={{ height: 120, borderRadius: 18 }} />
    </div>
  );
}
