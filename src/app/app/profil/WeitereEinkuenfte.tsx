"use client";
import Link from "next/link";
import { MoneyInput, NumberInput, Segmented, Toggle } from "@/components/ui";
import { eur, uid } from "@/lib/client/api";
import { gwgGrenze, YEAR_PARAMS } from "@/lib/tax/constants";
import { anlageAfa, betrieb, gebaeudeAfa, vermietung } from "@/lib/tax/einkuenfte";
import { alleBuchungen, hatJournal, mitJournal } from "@/lib/tax/journal";
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
              <Row label="Umsatzsteuer" help="Wohnung 10 %, Geschäftsraum/Garage 20 % – bei Kleinunternehmer:innen keine USt">
                <Segmented label="USt-Satz Vermietung" value={o.ustSatz} options={[{ value: 10, label: "10 %" }, { value: 20, label: "20 %" }, { value: 0, label: "frei" }]} onChange={(v) => upd((x) => void (x.ustSatz = v))} />
              </Row>
              <Row label="Vorsteuer" help="Umsatzsteuer aus Rechnungen für das Objekt (nur ohne Kleinunternehmerbefreiung)">
                <MoneyInput ariaLabel="Vorsteuer Vermietung" value={o.vorsteuer} onChange={(v) => upd((x) => void (x.vorsteuer = v))} />
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
        const r = betrieb(hatJournal(b) ? mitJournal(data).betriebe[i]! : b, p);
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
              <div className="list-item" style={{ flexWrap: "wrap", gap: 8 }}>
                <div className="grow" style={{ minWidth: 180 }}>
                  <div>📒 Buchhaltung (Einnahmen-Ausgaben-Journal)</div>
                  <div className="tiny muted">{hatJournal(b) ? `${alleBuchungen(b).length} Buchung(en) – Summen kommen aus dem Journal` : "Belege laufend fotografieren statt Summen am Jahresende eintragen"}</div>
                </div>
                <Link className="btn btn-secondary btn-sm" href="/app/buchhaltung">Öffnen</Link>
                <Link className="btn btn-ghost btn-sm" href="/app/rechnungen">Rechnungen</Link>
              </div>
              {!hatJournal(b) && (
              <Row label="Betriebseinnahmen" help="Netto ohne USt">
                <MoneyInput ariaLabel="Betriebseinnahmen" value={b.einnahmen} onChange={(v) => upd((x) => void (x.einnahmen = v))} />
              </Row>
              )}
              <Row label="Gewinnermittlung">
                <select className="select input-inline" value={b.gewinnermittlung} onChange={(e) => upd((x) => void (x.gewinnermittlung = e.target.value as typeof b.gewinnermittlung))}>
                  <option value="ear">Einnahmen-Ausgaben-Rechnung</option>
                  <option value="basis">Basispauschalierung ({(p.basispauschalierung.rate * 100).toLocaleString("de-DE")} %)</option>
                  <option value="klein">Kleinunternehmerpauschalierung (bis {eur(p.kleinunternehmerGrenze, 0)})</option>
                </select>
              </Row>
              {b.gewinnermittlung === "ear" && !hatJournal(b) && (
                <Row label="Betriebsausgaben" help="Ohne Sozialversicherung">
                  <MoneyInput ariaLabel="Betriebsausgaben" value={b.ausgaben} onChange={(v) => upd((x) => void (x.ausgaben = v))} />
                </Row>
              )}
              {b.gewinnermittlung === "basis" && (
                <Row label="Beratung, Vortrag, schriftstellerische Tätigkeit" help={`Reduzierter Satz ${(p.basispauschalierung.reduziert * 100).toLocaleString("de-DE")} %`}>
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
              <Row label="Umsatzsteuer-Satz" help="Meist 20 %; z. B. 10 % für Bücher, 13 % für Kunst">
                <Segmented label="USt-Satz Betrieb" value={b.ustSatz} options={[{ value: 20, label: "20 %" }, { value: 13, label: "13 %" }, { value: 10, label: "10 %" }, { value: 0, label: "frei" }]} onChange={(v) => upd((x) => void (x.ustSatz = v))} />
              </Row>
              {!hatJournal(b) && (
                <>
                  <Row label="Vorsteuer" help="Umsatzsteuer aus Eingangsrechnungen (nur ohne Kleinunternehmerbefreiung)">
                    <MoneyInput ariaLabel="Vorsteuer Betrieb" value={b.vorsteuer} onChange={(v) => upd((x) => void (x.vorsteuer = v))} />
                  </Row>
                  <Row label="SVS-Beiträge bezahlt" help="Sind immer zusätzlich absetzbar">
                    <MoneyInput ariaLabel="SVS-Beiträge" value={b.sozialversicherung} onChange={(v) => upd((x) => void (x.sozialversicherung = v))} />
                  </Row>
                </>
              )}
              {b.gewinnermittlung === "ear" && (
                <>
                  <div className="list-item" style={{ flexWrap: "wrap", gap: 8 }}>
                    <div className="grow" style={{ minWidth: 180 }}>
                      <div>Anlagenverzeichnis</div>
                      <div className="tiny muted">Laptop, Möbel, Auto … über {eur(gwgGrenze(year), 0)} werden über die Nutzungsdauer abgeschrieben, darunter sofort (geringwertige Wirtschaftsgüter)</div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => upd((x) => void x.anlagen.push({ id: uid(), bezeichnung: "", anschaffungsjahr: year, anschaffungsmonat: 1, kosten: 0, nutzungsdauer: 3, privatanteil: 0, pkw: false }))}
                    >
                      + Wirtschaftsgut
                    </button>
                  </div>
                  {b.anlagen.map((a, j) => {
                    const afa = anlageAfa(a, year);
                    const ua = (fn: (x: (typeof b.anlagen)[number]) => void) => upd((x) => fn(x.anlagen[j]!));
                    return (
                      <div key={a.id} className="list-item" style={{ flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
                        <div className="field" style={{ flex: "2 1 180px" }}>
                          <span className="tiny muted">Bezeichnung</span>
                          <input className="input input-inline" aria-label="Bezeichnung Wirtschaftsgut" placeholder="z. B. Laptop" value={a.bezeichnung} onChange={(e) => ua((x) => void (x.bezeichnung = e.target.value.slice(0, 200)))} />
                        </div>
                        <div className="field" style={{ flex: "1 1 130px" }}>
                          <span className="tiny muted">Kosten (netto)</span>
                          <MoneyInput ariaLabel="Anschaffungskosten" value={a.kosten} onChange={(v) => ua((x) => void (x.kosten = v))} />
                        </div>
                        <div className="field" style={{ flex: "1 1 90px" }}>
                          <span className="tiny muted">Jahr</span>
                          <NumberInput ariaLabel="Anschaffungsjahr" value={a.anschaffungsjahr} max={2100} onChange={(v) => ua((x) => void (x.anschaffungsjahr = Math.max(1990, v)))} />
                        </div>
                        <div className="field" style={{ flex: "1 1 80px" }}>
                          <span className="tiny muted">Monat</span>
                          <NumberInput ariaLabel="Anschaffungsmonat" value={a.anschaffungsmonat} max={12} onChange={(v) => ua((x) => void (x.anschaffungsmonat = Math.min(12, Math.max(1, v))))} />
                        </div>
                        <div className="field" style={{ flex: "1 1 90px" }}>
                          <span className="tiny muted">Nutzungsdauer</span>
                          <NumberInput ariaLabel="Nutzungsdauer in Jahren" value={a.nutzungsdauer} max={50} suffix="J." onChange={(v) => ua((x) => void (x.nutzungsdauer = Math.max(1, v)))} />
                        </div>
                        <div className="field" style={{ flex: "1 1 90px" }}>
                          <span className="tiny muted">Privatanteil</span>
                          <NumberInput ariaLabel="Privatanteil in Prozent" value={a.privatanteil} max={100} suffix="%" onChange={(v) => ua((x) => void (x.privatanteil = v))} />
                        </div>
                        <label className="row small" style={{ gap: 6, flex: "0 0 auto" }}>
                          <Toggle label="Pkw" checked={a.pkw} onChange={(v) => ua((x) => void (x.pkw = v))} /> Pkw
                        </label>
                        <div className="grow tiny muted" style={{ flexBasis: "100%" }}>
                          AfA {year}: <strong className="num">{eur(afa.afa * (1 - a.privatanteil / 100))}</strong>
                          {afa.gwg ? " · sofort abgeschrieben (GWG)" : ` · Restwert ${eur(afa.restwert)}`}
                          {a.pkw ? " · Pkw: max. 40.000 €, mind. 8 Jahre; Vorsteuer nur bei E-Autos" : ""}
                          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} aria-label="Wirtschaftsgut entfernen" onClick={() => upd((x) => void x.anlagen.splice(j, 1))}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
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

      {(data.betriebe.length > 0 || data.mietobjekte.length > 0) && (
        <div className="list">
          <Row label="Auf die Kleinunternehmerbefreiung verzichten" help="Dann verrechnest du Umsatzsteuer und bekommst die Vorsteuer zurück (bindet 5 Jahre)">
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Toggle label="USt-Verzicht" checked={data.ustVerzicht} onChange={(v) => set((d) => void (d.ustVerzicht = v))} />
            </div>
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
