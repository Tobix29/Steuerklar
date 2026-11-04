"use client";
import { useEffect, useState } from "react";
import { api, eur } from "@/lib/client/api";
import { fristen, type TaxYear } from "@/lib/tax/constants";
import { useCase } from "./CaseContext";

interface YearRow { year: TaxYear; hasData: boolean; documents: number; erstattung: number | null }

const fmtDate = (d: Date) => d.toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" });

/** Alle Jahre auf einen Blick: Gutschrift je Jahr, Fristen, Sprung ins Jahr. */
export function YearsOverview() {
  const { year, setYear, result, documentCount } = useCase();
  const [rows, setRows] = useState<YearRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ years: YearRow[] }>("/api/years")
      .then((r) => alive && setRows(r.years))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [result?.erstattung, documentCount]);

  if (!rows) return null;
  const visible = rows.filter((r) => fristen(r.year).yearEnded && !fristen(r.year).expired).reverse();
  const urgent = visible.find((r) => fristen(r.year).urgent);
  const total = visible.reduce((a, r) => a + Math.max(0, r.erstattung ?? 0), 0);

  return (
    <section className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
      {urgent && (
        <div className="notice notice-orange small">
          <span>⏳</span>
          <div>
            <strong>
              Noch {fristen(urgent.year).daysLeft} Tage für {urgent.year}
            </strong>
            <div>
              Die Arbeitnehmerveranlagung {urgent.year} ist nur noch bis {fmtDate(fristen(urgent.year).antrag)} möglich.{" "}
              {urgent.year !== year && (
                <button className="btn btn-ghost btn-sm" style={{ padding: 0, minHeight: 0 }} onClick={() => setYear(urgent.year)}>
                  Jetzt {urgent.year} öffnen ›
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="row-between">
        <h2 className="title-2">Deine Jahre</h2>
        {total > 0 && <span className="badge badge-green">insgesamt {eur(total, 0)}</span>}
      </div>
      <p className="muted small" style={{ margin: 0 }}>Die Arbeitnehmerveranlagung geht bis zu fünf Jahre rückwirkend – Geld, das du sonst verschenkst.</p>
      <div className="list">
        {visible.map((r) => {
          const f = fristen(r.year);
          return (
            <button
              key={r.year}
              className="list-item"
              style={{ width: "100%", border: 0, background: r.year === year ? "var(--accent-soft)" : "transparent", textAlign: "left", cursor: "pointer", color: "var(--text)" }}
              onClick={() => setYear(r.year)}
              aria-current={r.year === year ? "true" : undefined}
            >
              <strong className="num" style={{ width: 48 }}>{r.year}</strong>
              <span className="grow small muted">
                {r.hasData ? `${r.documents} Beleg${r.documents === 1 ? "" : "e"}` : "Noch nicht begonnen"} · Frist {fmtDate(f.antrag)}
              </span>
              {r.erstattung !== null ? (
                <span className={`value ${r.erstattung >= 0 ? "refund" : "payment"}`} style={{ fontWeight: 600 }}>{eur(r.erstattung, 0)}</span>
              ) : (
                <span className={`badge ${f.urgent ? "badge-orange" : ""}`}>{f.urgent ? "Frist läuft ab" : "Starten"}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
