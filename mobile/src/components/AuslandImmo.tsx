import { Text, View } from "react-native";
import { ChoiceRow, MoneyRow, NumberRow, Row, Section, Segmented, SwitchRow, TextRow } from "~/components/ui";
import { uid } from "~/lib/format";
import { useColors } from "~/lib/theme";
import type { TaxCase } from "~/lib/types";

type Ausland = TaxCase["ausland"][number];
type Verkauf = TaxCase["immobilienverkaeufe"][number];

const neuesAusland = (): Ausland => ({ id: uid(), land: "", art: "nichtselbstaendig", betrag: 0, methode: "befreiung", steuerAusland: 0 });
const neuerVerkauf = (): Verkauf => ({
  id: uid(), bezeichnung: "", erloes: 0, anschaffungskosten: 0, herstellungskosten: 0, afaGeltend: 0, anschaffungsjahr: 2010,
  altvermoegen: false, umgewidmet: false, hauptwohnsitz: false, herstellerGebaeudeanteil: 0, abgefuehrt: 0,
});

/** Auslandseinkünfte (L1i) und private Grundstücksverkäufe (ImmoESt). */
export function AuslandImmo({ data, set }: { data: TaxCase; set: (fn: (d: TaxCase) => void) => void }) {
  const c = useColors();
  return (
    <>
      <Section
        title="Einkünfte aus dem Ausland"
        footer="Je nach Doppelbesteuerungsabkommen sind sie in Österreich steuerfrei (erhöhen aber den Steuersatz) oder die ausländische Steuer wird angerechnet."
      >
        <Row label="+ Auslandseinkünfte" onPress={() => set((d) => void d.ausland.push(neuesAusland()))} />
      </Section>
      {data.ausland.map((a, i) => {
        const upd = (fn: (x: Ausland) => void) => set((d) => fn(d.ausland[i]!));
        return (
          <Section key={a.id} title={`🌍 Ausland ${i + 1}`}>
            <TextRow label="Land" value={a.land} placeholder="z. B. Deutschland" onChangeText={(v) => upd((x) => void (x.land = v.slice(0, 80)))} />
            <ChoiceRow
              label="Art"
              value={a.art}
              onChange={(v) => upd((x) => void (x.art = v))}
              options={[
                { value: "nichtselbstaendig", label: "Gehalt (nichtselbständig)" },
                { value: "pension", label: "Pension" },
                { value: "sonstige", label: "Sonstige Einkünfte" },
              ]}
            />
            <MoneyRow label="Einkünfte in Euro" sublabel="nach ausländischer Sozialversicherung" value={a.betrag} onChange={(v) => upd((x) => void (x.betrag = v))} />
            <View style={{ padding: 12, gap: 8 }}>
              <Text style={{ color: c.text, fontSize: 15 }}>Methode laut Doppelbesteuerungsabkommen</Text>
              <Segmented value={a.methode} onChange={(v) => upd((x) => void (x.methode = v))} options={[{ value: "befreiung", label: "Befreiung" }, { value: "anrechnung", label: "Anrechnung" }]} />
            </View>
            {a.methode === "anrechnung" && <MoneyRow label="Im Ausland bezahlte Steuer" value={a.steuerAusland} onChange={(v) => upd((x) => void (x.steuerAusland = v))} />}
            <Row label="Entfernen" destructive onPress={() => set((d) => void d.ausland.splice(i, 1))} />
          </Section>
        );
      })}

      <Section
        title="Immobilie verkauft"
        footer="Meist berechnet und zahlt der Notar die Immobilienertragsteuer (ImmoESt). Steuerklar prüft, ob du mit der Regelbesteuerung Geld zurückbekommst."
      >
        <Row label="+ Verkauf" onPress={() => set((d) => void d.immobilienverkaeufe.push(neuerVerkauf()))} />
      </Section>
      {data.immobilienverkaeufe.map((v, i) => {
        const upd = (fn: (x: Verkauf) => void) => set((d) => fn(d.immobilienverkaeufe[i]!));
        return (
          <Section key={v.id} title={`🏡 Verkauf ${i + 1}`}>
            <TextRow label="Bezeichnung" value={v.bezeichnung} placeholder="z. B. Wohnung Linz" onChangeText={(t) => upd((x) => void (x.bezeichnung = t.slice(0, 200)))} />
            <MoneyRow label="Verkaufspreis" value={v.erloes} onChange={(val) => upd((x) => void (x.erloes = val))} />
            <SwitchRow
              label="Hauptwohnsitzbefreiung"
              sublabel="2 Jahre seit Kauf durchgehend oder 5 der letzten 10 Jahre Hauptwohnsitz"
              value={v.hauptwohnsitz}
              onValueChange={(val) => upd((x) => void (x.hauptwohnsitz = val))}
            />
            {!v.hauptwohnsitz && (
              <>
                <SwitchRow label="Vor dem 31.3.2002 gekauft" sublabel="Altvermögen: pauschal 4,2 % vom Verkaufspreis" value={v.altvermoegen} onValueChange={(val) => upd((x) => void (x.altvermoegen = val))} />
                {v.altvermoegen ? (
                  <SwitchRow label="Nach 1987 in Bauland umgewidmet" sublabel="dann 18 % statt 4,2 %" value={v.umgewidmet} onValueChange={(val) => upd((x) => void (x.umgewidmet = val))} />
                ) : (
                  <>
                    <MoneyRow label="Kaufpreis inkl. Nebenkosten" value={v.anschaffungskosten} onChange={(val) => upd((x) => void (x.anschaffungskosten = val))} />
                    <MoneyRow label="Herstellungs- und Sanierungskosten" value={v.herstellungskosten} onChange={(val) => upd((x) => void (x.herstellungskosten = val))} />
                    <MoneyRow label="Bereits abgesetzte AfA" sublabel="falls vermietet" value={v.afaGeltend} onChange={(val) => upd((x) => void (x.afaGeltend = val))} />
                    <NumberRow
                      label="Selbst gebaut: Gebäudeanteil"
                      sublabel="Herstellerbefreiung – nur der Grund wird besteuert"
                      value={v.herstellerGebaeudeanteil}
                      max={100}
                      suffix="%"
                      onChange={(val) => upd((x) => void (x.herstellerGebaeudeanteil = val))}
                    />
                  </>
                )}
                <MoneyRow label="Vom Notar abgeführte ImmoESt" value={v.abgefuehrt} onChange={(val) => upd((x) => void (x.abgefuehrt = val))} />
              </>
            )}
            <Row label="Entfernen" destructive onPress={() => set((d) => void d.immobilienverkaeufe.splice(i, 1))} />
          </Section>
        );
      })}
    </>
  );
}
