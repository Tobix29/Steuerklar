"use client";
import Link from "next/link";
import { eur } from "@/lib/client/api";
import { useCase } from "./CaseContext";

export default function Overview() {
  const { data, result, year, documentCount, error } = useCase();
  if (error && !data) return <div className="notice notice-red">{error}</div>;
  if (!data || !result) return <Skeleton />;

  const p = data.persons[0]!;
  const hasProfile = !!p.firstName;
  const hasIncome = data.persons.some((x) => x.employments.length > 0);
  const hasDeductions = p.commuteDays > 0 || p.homeofficeDays > 0 || p.workExpenses.length > 0;
  const steps = [
    { href: "/app/profil", title: "Über dich", text: "Familie, Arbeitsweg, Homeoffice", done: hasProfile },
    { href: "/app/belege", title: "Lohnsteuerbescheinigung", text: "Foto oder PDF hochladen", done: hasIncome },
    { href: "/app/belege", title: "Weitere Belege", text: "Spenden, Handwerker, Arbeitsmittel", done: documentCount > 1 || hasDeductions },
    { href: "/app/ergebnis", title: "Prüfen & abgeben", text: "Erklärung herunterladen", done: false },
  ];
  const done = steps.filter((s) => s.done).length;
  const refund = result.erstattung;

  const tips: { icon: string; text: string; href: string }[] = [];
  if (hasIncome && p.homeofficeDays === 0) tips.push({ icon: "🏠", text: "Im Homeoffice gearbeitet? Bis zu 1.260 € Pauschale sind möglich.", href: "/app/profil" });
  if (hasIncome && p.commuteDays === 0) tips.push({ icon: "🚗", text: "Trage deinen Arbeitsweg ein – jeder Kilometer zählt.", href: "/app/profil" });
  if (hasIncome && p.workExpenses.length === 0) tips.push({ icon: "💻", text: "Laptop, Fachbücher, Fortbildung? Arbeitsmittel senken deine Steuer.", href: "/app/belege" });
  if (data.handwerkerleistungen.length === 0 && data.haushaltsnaheDienstleistungen.length === 0)
    tips.push({ icon: "🛠️", text: "Nebenkostenabrechnung oder Handwerker? 20 % der Arbeitskosten gibt’s direkt zurück.", href: "/app/belege" });

  return (
    <div className="stack fade-in" style={{ "--gap": "28px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Steuerjahr {year}</p>
          <h1 className="title">{hasProfile ? `Hallo ${p.firstName}.` : "Willkommen bei Steuerklar."}</h1>
        </div>
      </header>

      <section className="card card-lg center">
        <p className="muted small" style={{ margin: 0 }}>{refund >= 0 ? "Voraussichtliche Erstattung" : "Voraussichtliche Nachzahlung"}</p>
        <div className={`big-number ${hasIncome ? (refund >= 0 ? "refund" : "payment") : ""}`} style={{ margin: "8px 0" }}>
          {hasIncome ? eur(Math.abs(refund), 0) : "– €"}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {hasIncome ? "Wird bei jeder Eingabe live neu berechnet." : "Lade deine Lohnsteuerbescheinigung hoch, um deine Erstattung zu sehen."}
        </p>
        <div className="row" style={{ justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
          <Link className="btn" href="/app/belege">📸 Beleg hinzufügen</Link>
          {hasIncome && <Link className="btn btn-secondary" href="/app/ergebnis">Details ansehen</Link>}
        </div>
      </section>

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
            <strong>Mögliche Abgabepflicht</strong>
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
