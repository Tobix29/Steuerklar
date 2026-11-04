"use client";
import { MoneyInput, NumberInput, Segmented, Toggle } from "@/components/ui";
import { eur, uid } from "@/lib/client/api";
import { BUNDESLAENDER, YEAR_PARAMS } from "@/lib/tax/constants";
import { emptyPerson, type Expense, type TaxCase } from "@/lib/tax/types";
import { useCase } from "../CaseContext";

type ListKey = "spenden" | "krankheitskosten" | "handwerkerleistungen" | "haushaltsnaheDienstleistungen";

function ExpenseList({ items, onChange, placeholder }: { items: Expense[]; onChange: (xs: Expense[]) => void; placeholder: string }) {
  return (
    <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
      {items.map((x, i) => (
        <div key={x.id} className="row" style={{ gap: 8 }}>
          <input
            className="input input-inline"
            style={{ flex: 2 }}
            aria-label="Bezeichnung"
            value={x.label}
            placeholder={placeholder}
            disabled={!!x.documentId}
            onChange={(e) => onChange(items.map((y, j) => (j === i ? { ...y, label: e.target.value.slice(0, 200) } : y)))}
          />
          <div style={{ flex: 1, minWidth: 110 }}>
            {x.documentId ? (
              <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                <span className="badge badge-blue">Beleg</span>
                <span className="num">{eur(x.amount)}</span>
              </div>
            ) : (
              <MoneyInput inline ariaLabel="Betrag" value={x.amount} onChange={(v) => onChange(items.map((y, j) => (j === i ? { ...y, amount: v } : y)))} />
            )}
          </div>
          {!x.documentId && (
            <button className="btn btn-ghost btn-sm" aria-label="Eintrag entfernen" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          )}
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...items, { id: uid(), label: "", amount: 0 }])}>
        + Eintrag hinzufügen
      </button>
    </div>
  );
}

function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="list-item" style={{ flexWrap: "wrap" }}>
      <div className="grow" style={{ minWidth: 180 }}>
        <div>{label}</div>
        {help && <div className="tiny muted">{help}</div>}
      </div>
      <div style={{ minWidth: 150 }}>{children}</div>
    </div>
  );
}

export default function Profil() {
  const { data, update, year } = useCase();
  if (!data) return <div className="shimmer" style={{ height: 400, borderRadius: 18 }} />;
  const p = YEAR_PARAMS[year];
  const joint = data.filing === "joint";
  const persons = joint ? data.persons : data.persons.slice(0, 1);
  const set = (fn: (d: TaxCase) => void) => update(fn);

  return (
    <div className="stack fade-in" style={{ "--gap": "32px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Schritt 1</p>
          <h1 className="title">Über dich</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Ein paar Angaben – alles wird automatisch gespeichert.</p>
        </div>
      </header>

      <section>
        <p className="section-label">Veranlagung</p>
        <div className="list">
          <Row label="Familienstand" help="Verheiratete können die Zusammenveranlagung (Splitting) wählen.">
            <Segmented
              label="Veranlagungsart"
              value={data.filing}
              options={[{ value: "single", label: "Einzeln" }, { value: "joint", label: "Zusammen" }]}
              onChange={(v) =>
                set((d) => {
                  d.filing = v;
                  if (v === "joint" && d.persons.length < 2) d.persons.push(emptyPerson());
                  if (v === "joint") d.alleinerziehend = false;
                })
              }
            />
          </Row>
          <Row label="Bundesland" help="Bestimmt u. a. den Kirchensteuersatz.">
            <select className="select input-inline" value={data.bundesland} onChange={(e) => set((d) => void (d.bundesland = e.target.value))}>
              {BUNDESLAENDER.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </Row>
        </div>
      </section>

      {persons.map((person, i) => (
        <section key={i} className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
          <h2 className="title-2">{i === 0 ? (joint ? "Person 1" : "Persönliches") : "Ehepartner:in"}</h2>
          <div className="list">
            <Row label="Vorname">
              <input className="input input-inline" value={person.firstName} autoComplete={i === 0 ? "given-name" : "off"} onChange={(e) => set((d) => void (d.persons[i]!.firstName = e.target.value.slice(0, 100)))} />
            </Row>
            <Row label="Nachname">
              <input className="input input-inline" value={person.lastName} autoComplete={i === 0 ? "family-name" : "off"} onChange={(e) => set((d) => void (d.persons[i]!.lastName = e.target.value.slice(0, 100)))} />
            </Row>
            <Row label="Kirchenmitglied" help="Evangelisch, katholisch o. ä. (kirchensteuerpflichtig)">
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Toggle label="Kirchenmitglied" checked={person.churchMember} onChange={(v) => set((d) => void (d.persons[i]!.churchMember = v))} />
              </div>
            </Row>
          </div>

          <div>
            <p className="section-label">Arbeitsweg & Homeoffice</p>
            <div className="list">
              <Row label="Entfernung zur Arbeit" help="Einfache Strecke, kürzeste Straßenverbindung">
                <NumberInput ariaLabel="Entfernung in km" value={person.commuteKm} max={1000} suffix="km" onChange={(v) => set((d) => void (d.persons[i]!.commuteKm = v))} />
              </Row>
              <Row label="Tage im Büro" help="Typisch: 5-Tage-Woche ≈ 220 Tage">
                <NumberInput ariaLabel="Bürotage" value={person.commuteDays} suffix="Tage" onChange={(v) => set((d) => void (d.persons[i]!.commuteDays = v))} />
              </Row>
              <Row label="Tage im Homeoffice" help={`${p.homeofficePerDay} € pro Tag, max. ${p.homeofficeMaxDays} Tage`}>
                <NumberInput ariaLabel="Homeoffice-Tage" value={person.homeofficeDays} suffix="Tage" onChange={(v) => set((d) => void (d.persons[i]!.homeofficeDays = v))} />
              </Row>
              <Row label="Kontoführungspauschale" help="16 € werden ohne Nachweis anerkannt">
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <Toggle label="Kontoführungspauschale" checked={person.kontofuehrung} onChange={(v) => set((d) => void (d.persons[i]!.kontofuehrung = v))} />
                </div>
              </Row>
            </div>
            {person.commuteDays + person.homeofficeDays > 250 && (
              <div className="notice notice-orange small" style={{ marginTop: 10 }}>Büro- und Homeoffice-Tage zusammen wirken hoch. Bitte prüfen – das Finanzamt fragt hier häufig nach.</div>
            )}
          </div>

          <div>
            <p className="section-label">Weitere Werbungskosten</p>
            <div className="card">
              <ExpenseList
                placeholder="z. B. Fachbuch, Fortbildung, Bewerbung"
                items={person.workExpenses}
                onChange={(xs) => set((d) => void (d.persons[i]!.workExpenses = xs))}
              />
            </div>
          </div>

          <div>
            <p className="section-label">Lohnersatzleistungen</p>
            <div className="list">
              <Row label="Elterngeld, Arbeitslosengeld I, Krankengeld" help="Steuerfrei, erhöht aber den Steuersatz (Progressionsvorbehalt)">
                <MoneyInput ariaLabel="Lohnersatzleistungen" value={person.weitereLohnersatzleistungen} onChange={(v) => set((d) => void (d.persons[i]!.weitereLohnersatzleistungen = v))} />
              </Row>
            </div>
          </div>
        </section>
      ))}

      <section className="stack" style={{ "--gap": "16px" } as React.CSSProperties}>
        <div className="row-between">
          <h2 className="title-2">Kinder</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => set((d) => void d.children.push({ id: uid(), firstName: "", birthYear: year - 3, months: 12, share: joint ? 1 : 0.5, betreuungskosten: 0 }))}
          >
            + Kind hinzufügen
          </button>
        </div>
        {data.children.length === 0 && <p className="muted small" style={{ margin: 0 }}>Keine Kinder eingetragen.</p>}
        {data.children.map((c, i) => (
          <div key={c.id} className="list">
            <Row label="Vorname">
              <input className="input input-inline" value={c.firstName} onChange={(e) => set((d) => void (d.children[i]!.firstName = e.target.value.slice(0, 100)))} />
            </Row>
            <Row label="Geburtsjahr">
              <NumberInput ariaLabel="Geburtsjahr" value={c.birthYear} max={year} onChange={(v) => set((d) => void (d.children[i]!.birthYear = Math.max(1950, v)))} />
            </Row>
            <Row label="Monate mit Kindergeld">
              <NumberInput ariaLabel="Monate" value={c.months} max={12} suffix="Mon." onChange={(v) => set((d) => void (d.children[i]!.months = v))} />
            </Row>
            {!joint && (
              <Row label="Kinderfreibetrag" help="Halb, wenn der andere Elternteil ebenfalls Anspruch hat">
                <Segmented label="Freibetrag" value={c.share} options={[{ value: 0.5, label: "Halb" }, { value: 1, label: "Voll" }]} onChange={(v) => set((d) => void (d.children[i]!.share = v))} />
              </Row>
            )}
            <Row label="Kinderbetreuungskosten" help={`Kita, Tagesmutter (unter 14 J.), ${Math.round(p.kinderbetreuung.share * 100)} % bis ${eur(p.kinderbetreuung.max, 0)}`}>
              <MoneyInput ariaLabel="Betreuungskosten" value={c.betreuungskosten} onChange={(v) => set((d) => void (d.children[i]!.betreuungskosten = v))} />
            </Row>
            <div className="list-item">
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => set((d) => void d.children.splice(i, 1))}>Kind entfernen</button>
            </div>
          </div>
        ))}
        {!joint && data.children.length > 0 && (
          <div className="list">
            <Row label="Alleinerziehend" help={`Entlastungsbetrag ab ${eur(p.entlastungAlleinerziehend.base, 0)}, wenn kein anderer Erwachsener im Haushalt lebt`}>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Toggle label="Alleinerziehend" checked={data.alleinerziehend} onChange={(v) => set((d) => void (d.alleinerziehend = v))} />
              </div>
            </Row>
          </div>
        )}
      </section>

      <section className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
        <div>
          <h2 className="title-2">Weitere Abzüge</h2>
          <p className="muted small" style={{ margin: "4px 0 0" }}>Am einfachsten: Belege fotografieren. Du kannst Beträge aber auch direkt eintragen.</p>
        </div>
        {(
          [
            ["spenden", "Spenden & Mitgliedsbeiträge", "z. B. Kinderhilfswerk"],
            ["krankheitskosten", "Krankheitskosten", "z. B. Brille, Zahnersatz, Zuzahlungen"],
            ["handwerkerleistungen", "Handwerkerleistungen (nur Arbeitskosten)", "z. B. Malerarbeiten"],
            ["haushaltsnaheDienstleistungen", "Haushaltsnahe Dienstleistungen (nur Arbeitskosten)", "z. B. Reinigung, Gartenpflege"],
          ] as [ListKey, string, string][]
        ).map(([key, label, ph]) => (
          <div key={key}>
            <p className="section-label">{label}</p>
            <div className="card">
              <ExpenseList placeholder={ph} items={data[key]} onChange={(xs) => set((d) => void (d[key] = xs))} />
            </div>
          </div>
        ))}
        <div className="list">
          <Row label="Minijob im Privathaushalt" help="Jährliche Aufwendungen (z. B. Haushaltshilfe über Haushaltsscheck)">
            <MoneyInput ariaLabel="Minijob" value={data.minijobImHaushalt} onChange={(v) => set((d) => void (d.minijobImHaushalt = v))} />
          </Row>
        </div>
      </section>
    </div>
  );
}
