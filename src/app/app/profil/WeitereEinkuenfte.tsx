"use client";
import { MoneyInput, NumberInput, Segmented, Toggle } from "@/components/ui";
import { eur, uid } from "@/lib/client/api";
import { YEAR_PARAMS } from "@/lib/tax/constants";
import { betrieb, gebaeudeAfa, vermietung } from "@/lib/tax/einkuenfte";
import { BetriebSchema, MietobjektSchema, type TaxCase } from "@/lib/tax/types";
import type { TaxYear } from "@/lib/tax/constants";

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

/** Vermietung (E1b) und selbständige/gewerbliche Einkünfte (E1a). */
export function WeitereEinkuenfte({ data, set, year }: { data: TaxCase; set: (fn: (d: TaxCase) => void) => void; year: TaxYear }) {
  const p = YEAR_PARAMS[year];
  return (
    <section className="stack" style={{ "--gap": "16px" } as React.CSSProperties}>
      <div>
        <h2 className="title-2">Weitere Einkünfte</h2>
        <p className="muted small" style={{ margin: "4px 0 0" }}>
          Vermietest du eine Wohnung oder arbeitest du nebenbei selbständig? Dann gibst du statt L1 die Erklärung E1 ab – Steuerklar rechnet beides mit.
          Bis 730 € Nebeneinkünfte im Jahr bleiben neben dem Gehalt steuerfrei.
        </p>
      </div>

      {data.mietobjekte.map((o, i) => {
        const r = vermietung(o, year);
        const afa = gebaeudeAfa(o, year);
        const upd = (fn: (x: (typeof data.mietobjekte)[number]) => void) => set((d) => fn(d.mietobjekte[i]!));
        return (
          <div key={o.id} className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
            <p className="section-label" style={{ margin: "0 0 0 16px" }}>🏠 Vermietung {i + 1}</p>
            <div className="list">
              <Row label="Bezeichnung">
                <input className="input input-inline" placeholder="z. B. Wohnung Graz" value={o.bezeichnung} onChange={(e) => upd((x) => void (x.bezeichnung = e.target.value.slice(0, 200)))} />
              </Row>
              <Row label="Mieteinnahmen im Jahr" help="Netto ohne USt, inkl. weiterverrechneter Betriebskosten">
                <MoneyInput ariaLabel="Mieteinnahmen" value={o.einnahmen} onChange={(v) => upd((x) => void (x.einnahmen = v))} />
              </Row>
              <Row label="Kaufpreis bzw. Herstellungskosten" help="inkl. Grund, Nebenkosten (Grunderwerbsteuer, Notar, Makler)">
                <MoneyInput ariaLabel="Anschaffungskosten" value={o.anschaffungskosten} onChange={(v) => upd((x) => void (x.anschaffungskosten = v))} />
              </Row>
              <Row label="Anteil Grund und Boden" help="Pauschal 20 % (Gemeinde < 100.000 Einw., Bodenpreis < 400 €/m²), sonst 30 % bzw. 40 %">
                <Segmented label="Grundanteil" value={o.grundanteil} options={[{ value: 20, label: "20 %" }, { value: 30, label: "30 %" }, { value: 40, label: "40 %" }]} onChange={(v) => upd((x) => void (x.grundanteil = v))} />
              </Row>
              <Row label="Gekauft bzw. fertiggestellt im">
                <div className="row" style={{ gap: 6 }}>
                  <NumberInput ariaLabel="Monat" value={o.anschaffungsmonat} max={12} suffix="Mon." onChange={(v) => upd((x) => void (x.anschaffungsmonat = Math.max(1, v)))} />
                  <NumberInput ariaLabel="Jahr" value={o.anschaffungsjahr} max={2100} onChange={(v) => upd((x) => void (x.anschaffungsjahr = Math.max(1900, v)))} />
                </div>
              </Row>
              <Row label="Neubau-Wohngebäude, fertiggestellt 2024–2026" help="Dreifache AfA in den ersten drei Jahren">
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <Toggle label="Neubau 2024–2026" checked={o.neubau2024bis2026} onChange={(v) => upd((x) => void (x.neubau2024bis2026 = v))} />
                </div>
              </Row>
              <Row label="AfA (Abschreibung)" help={o.afaManuell > 0 ? "manuell eingetragen" : afa.hinweis ? afa.hinweis : "1,5 % vom Gebäudeanteil – oder Betrag aus dem Vorjahresbescheid eintragen"}>
                <MoneyInput ariaLabel="AfA manuell" value={o.afaManuell || afa.afa} onChange={(v) => upd((x) => void (x.afaManuell = v))} />
              </Row>
              <Row label="Kreditzinsen">
                <MoneyInput ariaLabel="Zinsen" value={o.zinsen} onChange={(v) => upd((x) => void (x.zinsen = v))} />
              </Row>
              <Row label="Instandhaltung" help="Laufende Reparaturen, Ausmalen – sofort absetzbar">
                <MoneyInput ariaLabel="Instandhaltung" value={o.instandhaltung} onChange={(v) => upd((x) => void (x.instandhaltung = v))} />
              </Row>
              <Row label="Betriebskosten & Hausverwaltung" help="Soweit du sie selbst trägst">
                <MoneyInput ariaLabel="Betriebskosten" value={o.betriebskosten} onChange={(v) => upd((x) => void (x.betriebskosten = v))} />
              </Row>
              <Row label="Sonstige Werbungskosten" help="Versicherung, Inserate, Fahrten, Steuerberatung für die Vermietung">
                <MoneyInput ariaLabel="Sonstige Werbungskosten Vermietung" value={o.sonstigeWerbungskosten} onChange={(v) => upd((x) => void (x.sonstigeWerbungskosten = v))} />
              </Row>
              <div className="list-item" style={{ flexWrap: "wrap", gap: 8 }}>
                <div className="grow" style={{ minWidth: 180 }}>
                  <div>Instandsetzungen</div>
                  <div className="tiny muted">Größere Sanierungen (Fenster, Heizung, Leitungen) – werden auf 15 Jahre verteilt</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => upd((x) => void x.instandsetzungen.push({ id: uid(), jahr: year, betrag: 0 }))}>+ Instandsetzung</button>
              </div>
              {o.instandsetzungen.map((inst, j) => (
                <div key={inst.id} className="list-item" style={{ gap: 8 }}>
                  <div style={{ width: 110 }}>
                    <NumberInput ariaLabel="Jahr der Instandsetzung" value={inst.jahr} max={2100} onChange={(v) => upd((x) => void (x.instandsetzungen[j]!.jahr = Math.max(1990, v)))} />
                  </div>
                  <div className="grow">
                    <MoneyInput ariaLabel="Betrag Instandsetzung" value={inst.betrag} onChange={(v) => upd((x) => void (x.instandsetzungen[j]!.betrag = v))} />
                  </div>
                  <button className="btn btn-ghost btn-sm" aria-label="Instandsetzung entfernen" onClick={() => upd((x) => void x.instandsetzungen.splice(j, 1))}>✕</button>
                </div>
              ))}
              <div className="list-item strong">
                <span className="grow">{r.ergebnis >= 0 ? "Überschuss" : "Verlust"} {year}</span>
                <span className="value">{eur(r.ergebnis)}</span>
              </div>
              <div className="list-item">
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => set((d) => void d.mietobjekte.splice(i, 1))}>Objekt entfernen</button>
              </div>
            </div>
          </div>
        );
      })}

      {data.betriebe.map((b, i) => {
        const r = betrieb(b, p);
        const upd = (fn: (x: (typeof data.betriebe)[number]) => void) => set((d) => fn(d.betriebe[i]!));
        return (
          <div key={b.id} className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
            <p className="section-label" style={{ margin: "0 0 0 16px" }}>💼 Selbständig / Gewerbe {i + 1}</p>
            <div className="list">
              <Row label="Bezeichnung">
                <input className="input input-inline" placeholder="z. B. Grafikdesign" value={b.bezeichnung} onChange={(e) => upd((x) => void (x.bezeichnung = e.target.value.slice(0, 200)))} />
              </Row>
              <Row label="Art">
                <Segmented label="Art" value={b.art} options={[{ value: "selbstaendig", label: "Selbständig" }, { value: "gewerbe", label: "Gewerbe" }]} onChange={(v) => upd((x) => void (x.art = v))} />
              </Row>
              <Row label="Betriebseinnahmen" help="Netto ohne USt">
                <MoneyInput ariaLabel="Betriebseinnahmen" value={b.einnahmen} onChange={(v) => upd((x) => void (x.einnahmen = v))} />
              </Row>
              <Row label="Gewinnermittlung">
                <select className="select input-inline" value={b.gewinnermittlung} onChange={(e) => upd((x) => void (x.gewinnermittlung = e.target.value as typeof b.gewinnermittlung))}>
                  <option value="ear">Einnahmen-Ausgaben-Rechnung</option>
                  <option value="basis">Basispauschalierung ({(p.basispauschalierung.rate * 100).toLocaleString("de-AT")} %)</option>
                  <option value="klein">Kleinunternehmerpauschalierung (bis {eur(p.kleinunternehmerGrenze, 0)})</option>
                </select>
              </Row>
              {b.gewinnermittlung === "ear" && (
                <Row label="Betriebsausgaben" help="Ohne Sozialversicherung">
                  <MoneyInput ariaLabel="Betriebsausgaben" value={b.ausgaben} onChange={(v) => upd((x) => void (x.ausgaben = v))} />
                </Row>
              )}
              {b.gewinnermittlung === "basis" && (
                <Row label="Beratung, Vortrag, schriftstellerische Tätigkeit" help={`Reduzierter Satz ${(p.basispauschalierung.reduziert * 100).toLocaleString("de-AT")} %`}>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <Toggle label="Reduzierter Satz" checked={b.reduzierterSatz} onChange={(v) => upd((x) => void (x.reduzierterSatz = v))} />
                  </div>
                </Row>
              )}
              {b.gewinnermittlung === "klein" && (
                <Row label="Dienstleistungsbetrieb" help="20 % statt 45 % Pauschale">
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <Toggle label="Dienstleistung" checked={b.dienstleistung} onChange={(v) => upd((x) => void (x.dienstleistung = v))} />
                  </div>
                </Row>
              )}
              {b.gewinnermittlung === "ear" && b.einnahmen - b.ausgaben - b.sozialversicherung > p.gewinnfreibetrag.bis && (
                <Row label="Begünstigte Investitionen" help="Für den investitionsbedingten Gewinnfreibetrag: neue abnutzbare Anlagen oder begünstigte Wertpapiere">
                  <MoneyInput ariaLabel="Investitionen" value={b.investitionen} onChange={(v) => upd((x) => void (x.investitionen = v))} />
                </Row>
              )}
              <Row label="SVS-Beiträge bezahlt" help="Sind immer zusätzlich absetzbar">
                <MoneyInput ariaLabel="SVS-Beiträge" value={b.sozialversicherung} onChange={(v) => upd((x) => void (x.sozialversicherung = v))} />
              </Row>
              <div className="list-item strong">
                <span className="grow">Gewinn {year} (nach Gewinnfreibetrag)</span>
                <span className="value">{eur(r.gewinn)}</span>
              </div>
              {r.hinweise.map((h) => (
                <div key={h} className="list-item small" style={{ color: "var(--orange)" }}>{h}</div>
              ))}
              <div className="list-item">
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => set((d) => void d.betriebe.splice(i, 1))}>Entfernen</button>
              </div>
            </div>
          </div>
        );
      })}

      {data.betriebe.length > 0 && (
        <div className="list">
          <Row label="Verlustvortrag aus Vorjahren" help="Noch nicht verrechnete Verluste aus selbständiger oder gewerblicher Tätigkeit – max. 75 % des Gesamtbetrags der Einkünfte pro Jahr">
            <MoneyInput ariaLabel="Verlustvortrag" value={data.verlustvortrag} onChange={(v) => set((d) => void (d.verlustvortrag = v))} />
          </Row>
        </div>
      )}

      <div className="row wrap">
        <button className="btn btn-secondary btn-sm" onClick={() => set((d) => void d.mietobjekte.push(MietobjektSchema.parse({ id: uid(), anschaffungsjahr: year - 5 })))}>+ Vermietung</button>
        <button className="btn btn-secondary btn-sm" onClick={() => set((d) => void d.betriebe.push(BetriebSchema.parse({ id: uid() })))}>+ Selbständig / Gewerbe</button>
      </div>
    </section>
  );
}
