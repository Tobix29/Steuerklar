"use client";
import { MoneyInput, NumberInput, Segmented, Toggle } from "@/components/ui";
import { eur, uid } from "@/lib/client/api";
import { AGB_PAUSCHALEN, BUNDESLAENDER, WK_KATEGORIEN, YEAR_PARAMS, type WkKategorie } from "@/lib/tax/constants";
import { behinderungPauschbetrag, pendlerpauschale } from "@/lib/tax/calculate";
import type { Expense, TaxCase } from "@/lib/tax/types";
import { useCase } from "../CaseContext";
import { WeitereEinkuenfte } from "./WeitereEinkuenfte";
import { AuslandImmo } from "./AuslandImmo";

type ListKey = "spenden" | "krankheitskosten" | "steuerberatung" | "werbungskosten";

function ExpenseList({ items, onChange, placeholder, withCategory }: { items: Expense[]; onChange: (xs: Expense[]) => void; placeholder: string; withCategory?: boolean }) {
  return (
    <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
      {items.map((x, i) => (
        <div key={x.id} className="row wrap" style={{ gap: 8 }}>
          <input
            className="input input-inline"
            style={{ flex: "2 1 160px" }}
            aria-label="Bezeichnung"
            value={x.label}
            placeholder={placeholder}
            disabled={!!x.documentId}
            onChange={(e) => onChange(items.map((y, j) => (j === i ? { ...y, label: e.target.value.slice(0, 200) } : y)))}
          />
          {withCategory && (
            <select
              className="select input-inline"
              style={{ flex: "1 1 160px", width: "auto" }}
              aria-label="Kategorie"
              value={x.category ?? "sonstige"}
              disabled={!!x.documentId}
              onChange={(e) => onChange(items.map((y, j) => (j === i ? { ...y, category: e.target.value as WkKategorie } : y)))}
            >
              {Object.entries(WK_KATEGORIEN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
          <div style={{ flex: "1 1 110px" }}>
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
      <button
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: "flex-start" }}
        onClick={() => onChange([...items, { id: uid(), label: "", amount: 0, ...(withCategory ? { category: "sonstige" as const } : {}) }])}
      >
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
  const set = (fn: (d: TaxCase) => void) => update(fn);
  const pp = pendlerpauschale(data.pendlerKm, data.oeffiZumutbar, data.fahrtenProMonat, p);

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
        <p className="section-label">Persönliches</p>
        <div className="list">
          <Row label="Vorname">
            <input className="input input-inline" value={data.firstName} autoComplete="given-name" onChange={(e) => set((d) => void (d.firstName = e.target.value.slice(0, 100)))} />
          </Row>
          <Row label="Nachname">
            <input className="input input-inline" value={data.lastName} autoComplete="family-name" onChange={(e) => set((d) => void (d.lastName = e.target.value.slice(0, 100)))} />
          </Row>
          <Row label="Bundesland">
            <select className="select input-inline" value={data.bundesland} onChange={(e) => set((d) => void (d.bundesland = e.target.value))}>
              {BUNDESLAENDER.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </Row>
        </div>
      </section>

      <section>
        <p className="section-label">Arbeitsweg</p>
        <div className="list">
          <Row label="Einfache Strecke zur Arbeit" help="Am besten den Wert aus dem Pendlerrechner des BMF übernehmen">
            <NumberInput ariaLabel="Entfernung in km" value={data.pendlerKm} max={1000} suffix="km" onChange={(v) => set((d) => void (d.pendlerKm = v))} />
          </Row>
          <Row label="Öffentliche Verkehrsmittel zumutbar?" help="Nein → großes Pendlerpauschale (z. B. keine Verbindung, lange Fahrzeit)">
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Toggle label="Öffis zumutbar" checked={data.oeffiZumutbar} onChange={(v) => set((d) => void (d.oeffiZumutbar = v))} />
            </div>
          </Row>
          <Row label="Fahrten pro Monat" help="Ab 11 Fahrten volles Pauschale, 8–10: zwei Drittel, 4–7: ein Drittel">
            <NumberInput ariaLabel="Fahrten pro Monat" value={data.fahrtenProMonat} max={31} suffix="Tage" onChange={(v) => set((d) => void (d.fahrtenProMonat = v))} />
          </Row>
          {data.pendlerKm > 0 && (
            <div className="list-item strong">
              <span className="grow">Pendlerpauschale {year}</span>
              <span className="value">{pp > 0 ? eur(pp) : "kein Anspruch"}</span>
            </div>
          )}
        </div>
      </section>

      <section>
        <p className="section-label">Homeoffice (Telearbeit)</p>
        <div className="list">
          <Row label="Telearbeitstage" help={`${p.telearbeit.perDay} € pro Tag, max. ${p.telearbeit.maxDays} Tage – steht meist am Lohnzettel`}>
            <NumberInput ariaLabel="Telearbeitstage" value={data.telearbeitstage} suffix="Tage" onChange={(v) => set((d) => void (d.telearbeitstage = v))} />
          </Row>
          <Row label="Davon vom Arbeitgeber steuerfrei bezahlt">
            <MoneyInput ariaLabel="Telearbeitspauschale Arbeitgeber" value={data.telearbeitspauschaleArbeitgeber} onChange={(v) => set((d) => void (d.telearbeitspauschaleArbeitgeber = v))} />
          </Row>
          <Row label="Ergonomisches Mobiliar" help={`Schreibtisch, Bürosessel, Beleuchtung – max. ${p.mobiliarMax} € (ab 26 Telearbeitstagen)`}>
            <MoneyInput ariaLabel="Mobiliar" value={data.mobiliar} onChange={(v) => set((d) => void (d.mobiliar = v))} />
          </Row>
        </div>
      </section>

      <section>
        <p className="section-label">Werbungskosten</p>
        <div className="card">
          <ExpenseList withCategory placeholder="z. B. Laptop, Fachbuch, Sprachkurs" items={data.werbungskosten} onChange={(xs) => set((d) => void (d.werbungskosten = xs))} />
          <p className="tiny muted" style={{ margin: "10px 0 0" }}>Insgesamt mindestens {p.werbungskostenpauschale} € – darunter gilt automatisch die Werbungskostenpauschale.</p>
        </div>
      </section>

      <section>
        <p className="section-label">Arbeiten fern von zu Hause</p>
        <div className="list">
          <Row label="Doppelte Haushaltsführung" help="Miete und Betriebskosten der Zweitwohnung am Arbeitsort, wenn der Familienwohnsitz weit entfernt ist (KZ 723)">
            <MoneyInput ariaLabel="Doppelte Haushaltsführung" value={data.doppelteHaushaltsfuehrung} onChange={(v) => set((d) => void (d.doppelteHaushaltsfuehrung = v))} />
          </Row>
          <Row label="Familienheimfahrten" help={`Fahrten zum Familienwohnsitz, max. ${eur(p.pendlerGross.from60, 0)} pro Jahr (KZ 300)`}>
            <MoneyInput ariaLabel="Familienheimfahrten" value={data.familienheimfahrten} onChange={(v) => set((d) => void (d.familienheimfahrten = v))} />
          </Row>
        </div>
      </section>

      <section>
        <p className="section-label">Behinderung</p>
        <div className="list">
          <Row label="Grad der Behinderung" help={data.behinderungGrad >= 25 ? `Pauschbetrag ${eur(behinderungPauschbetrag(data.behinderungGrad), 0)} pro Jahr, ohne Selbstbehalt` : "Ab 25 % laut Bescheid des Sozialministeriumservice"}>
            <NumberInput ariaLabel="Grad der Behinderung" value={data.behinderungGrad} max={100} suffix="%" onChange={(v) => set((d) => void (d.behinderungGrad = v))} />
          </Row>
          {data.behinderungGrad >= 25 && (
            <Row label="Eigenes Kfz wegen Gehbehinderung" help={`Freibetrag ${AGB_PAUSCHALEN.kfzBehinderungMonat} € pro Monat (Eintrag „Unzumutbarkeit öffentlicher Verkehrsmittel“ im Behindertenpass)`}>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Toggle label="Kfz-Freibetrag" checked={data.behinderungKfz} onChange={(v) => set((d) => void (d.behinderungKfz = v))} />
              </div>
            </Row>
          )}
        </div>
      </section>

      <section className="stack" style={{ "--gap": "16px" } as React.CSSProperties}>
        <div className="row-between">
          <h2 className="title-2">Kinder & Familie</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => set((d) => void d.children.push({ id: uid(), firstName: "", birthYear: year - 3, months: 12, familienbonusShare: 1, auswaertigeAusbildungMonate: 0 }))}>
            + Kind hinzufügen
          </button>
        </div>
        {data.children.length === 0 && <p className="muted small" style={{ margin: 0 }}>Keine Kinder eingetragen.</p>}
        {data.children.map((c, i) => (
          <div key={c.id} className="list">
            <Row label="Vorname">
              <input className="input input-inline" value={c.firstName} onChange={(e) => set((d) => void (d.children[i]!.firstName = e.target.value.slice(0, 100)))} />
            </Row>
            <Row label="Geburtsjahr" help={year - c.birthYear >= 18 ? `ab 18: Familienbonus ${eur(p.familienbonus.over18)} / Jahr` : `unter 18: Familienbonus ${eur(p.familienbonus.under18)} / Jahr`}>
              <NumberInput ariaLabel="Geburtsjahr" value={c.birthYear} max={year} onChange={(v) => set((d) => void (d.children[i]!.birthYear = Math.max(1950, v)))} />
            </Row>
            <Row label="Monate mit Familienbeihilfe">
              <NumberInput ariaLabel="Monate" value={c.months} max={12} suffix="Mon." onChange={(v) => set((d) => void (d.children[i]!.months = v))} />
            </Row>
            <Row label="Familienbonus Plus" help="Ganz oder je zur Hälfte mit dem anderen Elternteil">
              <Segmented label="Familienbonus" value={c.familienbonusShare} options={[{ value: 1, label: "Ganz" }, { value: 0.5, label: "Hälfte" }]} onChange={(v) => set((d) => void (d.children[i]!.familienbonusShare = v))} />
            </Row>
            {year - c.birthYear >= 15 && (
              <Row label="Auswärtige Berufsausbildung" help={`Monate mit Ausbildung außerhalb des Wohnorts (kein Ausbildungsort im Umkreis von 80 km) – ${AGB_PAUSCHALEN.auswaertigeAusbildungMonat} € pro Monat`}>
                <NumberInput ariaLabel="Monate auswärtige Ausbildung" value={c.auswaertigeAusbildungMonate} max={12} suffix="Mon." onChange={(v) => set((d) => void (d.children[i]!.auswaertigeAusbildungMonate = v))} />
              </Row>
            )}
            <div className="list-item">
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => set((d) => void d.children.splice(i, 1))}>Kind entfernen</button>
            </div>
          </div>
        ))}
        {data.children.length > 0 && (
          <div className="list">
            <Row label="Familienstatus" help="Für den Alleinverdiener- bzw. Alleinerzieherabsetzbetrag">
              <select className="select input-inline" value={data.familienstatus} onChange={(e) => set((d) => void (d.familienstatus = e.target.value as TaxCase["familienstatus"]))}>
                <option value="keine">Kein Anspruch</option>
                <option value="alleinverdiener">Alleinverdiener:in</option>
                <option value="alleinerzieher">Alleinerzieher:in</option>
              </select>
            </Row>
            {data.familienstatus === "alleinverdiener" && (
              <Row label="Einkünfte der Partnerin/des Partners" help={`Grenze ${eur(p.avabPartnerIncomeLimit, 0)} pro Jahr`}>
                <MoneyInput ariaLabel="Partnereinkünfte" value={data.partnerEinkuenfte} onChange={(v) => set((d) => void (d.partnerEinkuenfte = v))} />
              </Row>
            )}
          </div>
        )}
      </section>

      <section className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
        <div className="row-between">
          <div>
            <h2 className="title-2">Unterhalt</h2>
            <p className="muted small" style={{ margin: "4px 0 0" }}>Für Kinder, die nicht bei dir wohnen und für die du gesetzlichen Unterhalt zahlst (Unterhaltsabsetzbetrag).</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => set((d) => void d.unterhaltKinder.push({ id: uid(), firstName: "", months: 12 }))}>+ Kind</button>
        </div>
        {data.unterhaltKinder.map((k, i) => (
          <div key={k.id} className="list">
            <Row label={`Kind ${i + 1}`} help={`${eur(p.uab[Math.min(i, 2)]!)} pro Monat`}>
              <input className="input input-inline" aria-label="Vorname" placeholder="Vorname" value={k.firstName} onChange={(e) => set((d) => void (d.unterhaltKinder[i]!.firstName = e.target.value.slice(0, 100)))} />
            </Row>
            <Row label="Monate mit Unterhaltszahlung">
              <NumberInput ariaLabel="Monate Unterhalt" value={k.months} max={12} suffix="Mon." onChange={(v) => set((d) => void (d.unterhaltKinder[i]!.months = v))} />
            </Row>
            <div className="list-item">
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => set((d) => void d.unterhaltKinder.splice(i, 1))}>Entfernen</button>
            </div>
          </div>
        ))}
        {data.unterhaltKinder.length > 0 && <p className="tiny muted" style={{ margin: 0 }}>Tipp: Als unterhaltszahlender Elternteil kannst du zusätzlich den halben Familienbonus Plus beantragen – trage das Kind dafür auch unter „Kinder & Familie“ mit „Hälfte“ ein.</p>}
      </section>

      {data.lohnzettel.some((l) => l.art === "pension") && (
        <section>
          <p className="section-label">Pension</p>
          <div className="list">
            <Row label="Erhöhter Pensionistenabsetzbetrag" help={`Verheiratet bzw. eingetragene Partnerschaft, Partnereinkünfte bis ${eur(p.pension.partnerLimit, 0)} und kein Alleinverdienerabsetzbetrag`}>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Toggle label="Erhöhter Pensionistenabsetzbetrag" checked={data.pensionErhoeht} onChange={(v) => set((d) => void (d.pensionErhoeht = v))} />
              </div>
            </Row>
            {data.pensionErhoeht && (
              <Row label="Einkünfte der Partnerin/des Partners">
                <MoneyInput ariaLabel="Partnereinkünfte" value={data.partnerEinkuenfte} onChange={(v) => set((d) => void (d.partnerEinkuenfte = v))} />
              </Row>
            )}
          </div>
        </section>
      )}

      <section>
        <p className="section-label">Kapitalerträge (Sparbuch, Depot)</p>
        <div className="list">
          <Row label="Erträge mit 27,5 % KESt" help="Dividenden, Fonds, Kursgewinne – steht im Steuerreport deiner Bank">
            <MoneyInput ariaLabel="Erträge 27,5 %" value={data.kapital.ertraege275} onChange={(v) => set((d) => void (d.kapital.ertraege275 = v))} />
          </Row>
          <Row label="Zinsen mit 25 % KESt" help="Sparbuch, Festgeld, Girokonto">
            <MoneyInput ariaLabel="Zinsen 25 %" value={data.kapital.ertraege25} onChange={(v) => set((d) => void (d.kapital.ertraege25 = v))} />
          </Row>
          <Row label="Realisierte Verluste aus anderen Depots" help="Kursverluste, die deine Bank nicht schon mit Gewinnen verrechnet hat (Verlustausgleich)">
            <MoneyInput ariaLabel="Verluste Kapital" value={data.kapital.verluste275} onChange={(v) => set((d) => void (d.kapital.verluste275 = v))} />
          </Row>
          <Row label="Bereits abgezogene KESt">
            <MoneyInput ariaLabel="KESt bezahlt" value={data.kapital.kestBezahlt} onChange={(v) => set((d) => void (d.kapital.kestBezahlt = v))} />
          </Row>
        </div>
        <p className="tiny muted" style={{ margin: "8px 0 0 16px" }}>Bei niedrigem Einkommen bekommst du mit der Regelbesteuerungsoption KESt zurück. Steuerklar rechnet automatisch, ob es sich lohnt.</p>
      </section>

      <WeitereEinkuenfte data={data} set={set} year={year} />

      <AuslandImmo data={data} set={set} />

      <section className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
        <div>
          <h2 className="title-2">Sonderausgaben & Krankheitskosten</h2>
          <p className="muted small" style={{ margin: "4px 0 0" }}>Kirchenbeitrag und Spenden übermitteln Kirche und Organisationen automatisch – hier nur für die Berechnung.</p>
        </div>
        <div className="list">
          <Row label="Kirchenbeitrag" help={`max. ${p.kirchenbeitragMax} € absetzbar (${year})`}>
            <MoneyInput ariaLabel="Kirchenbeitrag" value={data.kirchenbeitrag} onChange={(v) => set((d) => void (d.kirchenbeitrag = v))} />
          </Row>
        </div>
        {(
          [
            ["spenden", "Spenden", "z. B. Rotes Kreuz"],
            ["krankheitskosten", "Krankheitskosten (mit Selbstbehalt)", "z. B. Zahnarzt, Brille, Selbstbehalte"],
            ["steuerberatung", "Steuerberatungskosten", "z. B. Steuerberatung, Steuersoftware"],
          ] as [ListKey, string, string][]
        ).map(([key, label, ph]) => (
          <div key={key}>
            <p className="section-label">{label}</p>
            <div className="card">
              <ExpenseList placeholder={ph} items={data[key]} onChange={(xs) => set((d) => void (d[key] = xs))} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
