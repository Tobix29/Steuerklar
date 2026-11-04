"use client";
import { MoneyInput, NumberInput, Segmented, Toggle } from "@/components/ui";
import { uid } from "@/lib/client/api";
import { TaxCaseSchema, type TaxCase } from "@/lib/tax/types";

type Verkauf = TaxCase["immobilienverkaeufe"][number];
const newVerkauf = (): Verkauf => TaxCaseSchema.shape.immobilienverkaeufe.unwrap().element.parse({ id: uid() });

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

/** Auslandseinkünfte (L1i) und private Grundstücksverkäufe (ImmoESt). */
export function AuslandImmo({ data, set }: { data: TaxCase; set: (fn: (d: TaxCase) => void) => void }) {
  return (
    <>
      <section className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
        <div className="row-between">
          <div>
            <h2 className="title-2">Einkünfte aus dem Ausland</h2>
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              Z. B. Gehalt aus Deutschland oder eine ausländische Pension. Je nach Doppelbesteuerungsabkommen sind sie in Österreich steuerfrei (erhöhen aber den
              Steuersatz) oder die ausländische Steuer wird angerechnet.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => set((d) => void d.ausland.push({ id: uid(), land: "", art: "nichtselbstaendig", betrag: 0, methode: "befreiung", steuerAusland: 0 }))}>
            + Ausland
          </button>
        </div>
        {data.ausland.map((a, i) => (
          <div key={a.id} className="list">
            <Row label="Land">
              <input className="input input-inline" placeholder="z. B. Deutschland" value={a.land} onChange={(e) => set((d) => void (d.ausland[i]!.land = e.target.value.slice(0, 80)))} />
            </Row>
            <Row label="Art">
              <select className="select input-inline" value={a.art} onChange={(e) => set((d) => void (d.ausland[i]!.art = e.target.value as typeof a.art))}>
                <option value="nichtselbstaendig">Gehalt (nichtselbständig)</option>
                <option value="pension">Pension</option>
                <option value="sonstige">Sonstige Einkünfte</option>
              </select>
            </Row>
            <Row label="Einkünfte in Euro" help="Nach Abzug der ausländischen Sozialversicherung">
              <MoneyInput ariaLabel="Auslandseinkünfte" value={a.betrag} onChange={(v) => set((d) => void (d.ausland[i]!.betrag = v))} />
            </Row>
            <Row label="Methode laut Doppelbesteuerungsabkommen" help="Für Gehalt aus Deutschland meist Befreiung; im Zweifel beim Finanzamt fragen">
              <Segmented label="Methode" value={a.methode} options={[{ value: "befreiung", label: "Befreiung" }, { value: "anrechnung", label: "Anrechnung" }]} onChange={(v) => set((d) => void (d.ausland[i]!.methode = v))} />
            </Row>
            {a.methode === "anrechnung" && (
              <Row label="Im Ausland bezahlte Steuer">
                <MoneyInput ariaLabel="Auslandssteuer" value={a.steuerAusland} onChange={(v) => set((d) => void (d.ausland[i]!.steuerAusland = v))} />
              </Row>
            )}
            <div className="list-item">
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => set((d) => void d.ausland.splice(i, 1))}>Entfernen</button>
            </div>
          </div>
        ))}
      </section>

      <section className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
        <div className="row-between">
          <div>
            <h2 className="title-2">Immobilie verkauft</h2>
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              Meist berechnet und zahlt der Notar die Immobilienertragsteuer (ImmoESt). Steuerklar prüft, ob du mit der Regelbesteuerung Geld zurückbekommst.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => set((d) => void d.immobilienverkaeufe.push(newVerkauf()))}>+ Verkauf</button>
        </div>
        {data.immobilienverkaeufe.map((v, i) => {
          const upd = (fn: (x: Verkauf) => void) => set((d) => fn(d.immobilienverkaeufe[i]!));
          return (
            <div key={v.id} className="list">
              <Row label="Bezeichnung">
                <input className="input input-inline" placeholder="z. B. Wohnung Linz" value={v.bezeichnung} onChange={(e) => upd((x) => void (x.bezeichnung = e.target.value.slice(0, 200)))} />
              </Row>
              <Row label="Verkaufspreis">
                <MoneyInput ariaLabel="Verkaufspreis" value={v.erloes} onChange={(val) => upd((x) => void (x.erloes = val))} />
              </Row>
              <Row label="Hauptwohnsitzbefreiung" help="Seit dem Kauf mindestens 2 Jahre durchgehend oder 5 der letzten 10 Jahre dein Hauptwohnsitz">
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <Toggle label="Hauptwohnsitz" checked={v.hauptwohnsitz} onChange={(val) => upd((x) => void (x.hauptwohnsitz = val))} />
                </div>
              </Row>
              {!v.hauptwohnsitz && (
                <>
                  <Row label="Vor dem 31.3.2002 gekauft (Altvermögen)" help="Dann pauschal 4,2 % vom Verkaufspreis">
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <Toggle label="Altvermögen" checked={v.altvermoegen} onChange={(val) => upd((x) => void (x.altvermoegen = val))} />
                    </div>
                  </Row>
                  {v.altvermoegen ? (
                    <Row label="Nach 1987 in Bauland umgewidmet" help="Dann 18 % statt 4,2 %">
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <Toggle label="Umgewidmet" checked={v.umgewidmet} onChange={(val) => upd((x) => void (x.umgewidmet = val))} />
                      </div>
                    </Row>
                  ) : (
                    <>
                      <Row label="Kaufpreis inkl. Nebenkosten">
                        <MoneyInput ariaLabel="Kaufpreis" value={v.anschaffungskosten} onChange={(val) => upd((x) => void (x.anschaffungskosten = val))} />
                      </Row>
                      <Row label="Herstellungs- und Sanierungskosten">
                        <MoneyInput ariaLabel="Herstellungskosten" value={v.herstellungskosten} onChange={(val) => upd((x) => void (x.herstellungskosten = val))} />
                      </Row>
                      <Row label="Bereits abgesetzte AfA" help="Falls vermietet: Summe der geltend gemachten Abschreibungen">
                        <MoneyInput ariaLabel="AfA geltend" value={v.afaGeltend} onChange={(val) => upd((x) => void (x.afaGeltend = val))} />
                      </Row>
                      <Row label="Selbst errichtetes Gebäude: Gebäudeanteil" help="Herstellerbefreiung – nur der Grund wird besteuert">
                        <NumberInput ariaLabel="Gebäudeanteil" value={v.herstellerGebaeudeanteil} max={100} suffix="%" onChange={(val) => upd((x) => void (x.herstellerGebaeudeanteil = val))} />
                      </Row>
                    </>
                  )}
                  <Row label="Vom Notar abgeführte ImmoESt">
                    <MoneyInput ariaLabel="ImmoESt abgeführt" value={v.abgefuehrt} onChange={(val) => upd((x) => void (x.abgefuehrt = val))} />
                  </Row>
                </>
              )}
              <div className="list-item">
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => set((d) => void d.immobilienverkaeufe.splice(i, 1))}>Entfernen</button>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
