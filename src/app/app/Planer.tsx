"use client";
import { eur } from "@/lib/client/api";
import { planung, termine, type Termin } from "@/lib/tax/planer";
import type { TaxCase, TaxResult } from "@/lib/tax/types";

const ART_ICON: Record<Termin["art"], string> = { erklaerung: "📝", zahlung: "💶", uva: "🧾", svs: "🩺", frist: "⏳" };
const MONATE = ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Nächste Steuertermine (Erklärungen, Vorauszahlungen, SVS, UVA) mit Kalender-Export. */
export function NaechsteTermine({ data, result, limit = 6 }: { data: TaxCase; result: TaxResult; limit?: number }) {
  const list = termine(data, result);
  if (!list.length) return null;
  return (
    <section className="stack">
      <div className="row-between">
        <h2 className="title-2">Nächste Termine</h2>
        <a className="small" href={`/api/calendar?year=${data.year}&alle=1`}>📅 Alle in den Kalender</a>
      </div>
      <div className="list">
        {list.slice(0, limit).map((t) => {
          const [y, m, d] = t.datum.split("-").map(Number) as [number, number, number];
          return (
            <div key={t.datum + t.titel} className="list-item">
              <div className="center" style={{ width: 46, flexShrink: 0 }}>
                <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>{MONATE[m - 1]}</div>
                <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>{d}</div>
                <div className="tiny muted">{y}</div>
              </div>
              <span aria-hidden="true">{ART_ICON[t.art]}</span>
              <span className="grow">{t.titel}</span>
              {t.betrag ? <span className="num small">{eur(t.betrag, 0)}</span> : null}
            </div>
          );
        })}
      </div>
      {list.length > limit && <p className="tiny muted" style={{ margin: 0 }}>+ {list.length - limit} weitere Termine in den nächsten 12 Monaten</p>}
    </section>
  );
}

/** Rücklagen-Planer für Selbständige und Vermieter:innen. */
export function RuecklagenPlaner({ data, result }: { data: TaxCase; result: TaxResult }) {
  if (!data.betriebe.length && !data.mietobjekte.length) return null;
  const p = planung(data, result);
  if (p.ruecklageMonat <= 0 && !p.svs) return null;
  return (
    <section className="card card-lg stack">
      <div>
        <h2 className="title-2">💰 Rücklagen-Planer</h2>
        <p className="muted small" style={{ margin: "6px 0 0" }}>So viel solltest du monatlich zur Seite legen, damit Nachzahlungen und Vorauszahlungen dich nicht überraschen.</p>
      </div>
      <div className="center" style={{ padding: "6px 0" }}>
        <div className="big-number" style={{ fontSize: 44 }}>{eur(p.ruecklageMonat, 0)}</div>
        <div className="muted small">pro Monat</div>
      </div>
      <div className="list">
        {p.estAufNebeneinkuenfte > 0 && (
          <div className="list-item">
            <span className="grow">Einkommensteuer auf Gewinn und Vermietung<div className="tiny muted">Das Finanzamt setzt danach Vorauszahlungen fest: ca. {eur(p.vorauszahlungQuartal, 0)} pro Quartal (15.2., 15.5., 15.8., 15.11.)</div></span>
            <span className="num">{eur(p.estAufNebeneinkuenfte, 0)}</span>
          </div>
        )}
        {p.svs && (
          <div className="list-item">
            <span className="grow">
              SVS-Beiträge (Pension, Kranken, Vorsorge, Unfall)
              <div className="tiny muted">
                Beitragsgrundlage {eur(p.svs.beitragsgrundlage, 0)}{p.svs.mindest ? " (Mindestbeitragsgrundlage)" : p.svs.hoechst ? " (Höchstbeitragsgrundlage)" : ""} · {eur(p.svs.quartal, 0)} pro Quartal.
                Die SVS rechnet mit vorläufigen Beiträgen und holt die Differenz nach dem Steuerbescheid nach.
              </div>
            </span>
            <span className="num">{eur(p.svs.summe, 0)}</span>
          </div>
        )}
        {p.uva && (
          <div className="list-item">
            <span className="grow">
              Umsatzsteuer-Zahllast ({p.uva.zeitraum})
              <div className="tiny muted">
                {p.uva.abgabepflicht ? "UVA-Abgabe über FinanzOnline verpflichtend" : "UVA muss nicht abgegeben, aber die Zahllast bezahlt werden"} · fällig am 15. des zweitfolgenden Monats
              </div>
            </span>
            <span className="num">{eur(p.uva.zahllastJeZeitraum, 0)}</span>
          </div>
        )}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>Schätzung auf Basis des gewählten Jahres. Vorauszahlungen kannst du bei sinkendem Gewinn bis 30.9. herabsetzen lassen (§ 45 Abs. 4 EStG).</p>
    </section>
  );
}
