import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, ChoiceRow, MoneyRow, NumberRow, Row, Section, Segmented, SwitchRow, TextRow } from "~/components/ui";
import { eur, uid } from "~/lib/format";
import { useColors } from "~/lib/theme";
import { YEAR_PARAMS, type Betrieb, type Mietobjekt, type TaxCase, type TaxYear } from "~/lib/types";
import { betrieb, gebaeudeAfa, vermietung } from "@core/tax/einkuenfte";

const neuesObjekt = (year: number): Mietobjekt => ({
  id: uid(), bezeichnung: "", einnahmen: 0, anschaffungskosten: 0, grundanteil: 20, anschaffungsjahr: year - 5, anschaffungsmonat: 1,
  neubau2024bis2026: false, afaManuell: 0, zinsen: 0, instandhaltung: 0, instandsetzungen: [], betriebskosten: 0, sonstigeWerbungskosten: 0, ustSatz: 10, vorsteuer: 0,
});

const neuerBetrieb = (): Betrieb => ({
  id: uid(), bezeichnung: "", art: "selbstaendig", einnahmen: 0, gewinnermittlung: "ear", ausgaben: 0, sozialversicherung: 0, reduzierterSatz: false, dienstleistung: false, investitionen: 0, ustSatz: 20, vorsteuer: 0,
});

/** Vermietung (E1b) und Selbständig/Gewerbe (E1a) – Hauptfelder; Instandsetzungen u. ä. in der Web-Version. */
export function WeitereEinkuenfte({ data, set, year }: { data: TaxCase; set: (fn: (d: TaxCase) => void) => void; year: TaxYear }) {
  const c = useColors();
  const p = YEAR_PARAMS[year];
  return (
    <>
      <Section
        title="Weitere Einkünfte"
        footer="Vermietest du oder arbeitest du nebenbei selbständig, gibst du statt L1 die Erklärung E1 ab. Bis 730 € Nebeneinkünfte bleiben neben dem Gehalt steuerfrei."
      >
        <Row label="+ Vermietung" onPress={() => set((d) => void d.mietobjekte.push(neuesObjekt(year)))} />
        <Row label="+ Selbständig / Gewerbe" onPress={() => set((d) => void d.betriebe.push(neuerBetrieb()))} />
      </Section>

      {data.mietobjekte.map((o, i) => {
        const r = vermietung(o, year);
        const afa = gebaeudeAfa(o, year);
        const upd = (fn: (x: Mietobjekt) => void) => set((d) => fn(d.mietobjekte[i]!));
        return (
          <Section
            key={o.id}
            title={`🏠 Vermietung ${i + 1}`}
            footer={o.instandsetzungen.length ? `${o.instandsetzungen.length} Instandsetzung(en) – Bearbeiten in der Web-Version.` : "Instandsetzungen (Verteilung auf 15 Jahre) trägst du in der Web-Version ein."}
          >
            <TextRow label="Bezeichnung" value={o.bezeichnung} placeholder="z. B. Wohnung Graz" onChangeText={(v) => upd((x) => void (x.bezeichnung = v.slice(0, 200)))} />
            <MoneyRow label="Mieteinnahmen" sublabel="netto, inkl. weiterverrechneter Betriebskosten" value={o.einnahmen} onChange={(v) => upd((x) => void (x.einnahmen = v))} />
            <MoneyRow label="Kaufpreis / Herstellungskosten" sublabel="inkl. Grund und Nebenkosten" value={o.anschaffungskosten} onChange={(v) => upd((x) => void (x.anschaffungskosten = v))} />
            <View style={{ padding: 12, gap: 8 }}>
              <Text style={{ color: c.text, fontSize: 15 }}>Anteil Grund und Boden</Text>
              <Segmented
                value={o.grundanteil}
                onChange={(v) => upd((x) => void (x.grundanteil = v))}
                options={[{ value: 20, label: "20 %" }, { value: 30, label: "30 %" }, { value: 40, label: "40 %" }]}
              />
            </View>
            <NumberRow label="Gekauft im Jahr" value={o.anschaffungsjahr} max={2100} onChange={(v) => upd((x) => void (x.anschaffungsjahr = Math.max(1900, v)))} />
            <NumberRow label="Monat" value={o.anschaffungsmonat} max={12} onChange={(v) => upd((x) => void (x.anschaffungsmonat = Math.max(1, v)))} />
            <SwitchRow label="Neubau 2024–2026" sublabel="Dreifache AfA in den ersten drei Jahren" value={o.neubau2024bis2026} onValueChange={(v) => upd((x) => void (x.neubau2024bis2026 = v))} />
            <MoneyRow
              label="AfA"
              sublabel={o.afaManuell > 0 ? "manuell eingetragen" : (afa.hinweis ?? "1,5 % vom Gebäudeanteil")}
              value={o.afaManuell || afa.afa}
              onChange={(v) => upd((x) => void (x.afaManuell = v))}
            />
            <MoneyRow label="Kreditzinsen" value={o.zinsen} onChange={(v) => upd((x) => void (x.zinsen = v))} />
            <MoneyRow label="Instandhaltung" sublabel="laufende Reparaturen" value={o.instandhaltung} onChange={(v) => upd((x) => void (x.instandhaltung = v))} />
            <MoneyRow label="Betriebskosten & Verwaltung" value={o.betriebskosten} onChange={(v) => upd((x) => void (x.betriebskosten = v))} />
            <MoneyRow label="Sonstige Werbungskosten" value={o.sonstigeWerbungskosten} onChange={(v) => upd((x) => void (x.sonstigeWerbungskosten = v))} />
            <Row label={r.ergebnis >= 0 ? `Überschuss ${year}` : `Verlust ${year}`} value={eur(r.ergebnis)} strong />
            <Row label="Objekt entfernen" destructive onPress={() => set((d) => void d.mietobjekte.splice(i, 1))} />
          </Section>
        );
      })}

      {data.betriebe.map((b, i) => {
        const r = betrieb(b, p);
        const upd = (fn: (x: Betrieb) => void) => set((d) => fn(d.betriebe[i]!));
        return (
          <Section key={b.id} title={`💼 Selbständig / Gewerbe ${i + 1}`} footer={r.hinweise.join(" ") || undefined}>
            <TextRow label="Bezeichnung" value={b.bezeichnung} placeholder="z. B. Grafikdesign" onChangeText={(v) => upd((x) => void (x.bezeichnung = v.slice(0, 200)))} />
            <View style={{ padding: 12 }}>
              <Segmented value={b.art} onChange={(v) => upd((x) => void (x.art = v))} options={[{ value: "selbstaendig", label: "Selbständig" }, { value: "gewerbe", label: "Gewerbe" }]} />
            </View>
            <MoneyRow label="Betriebseinnahmen" sublabel="netto ohne USt" value={b.einnahmen} onChange={(v) => upd((x) => void (x.einnahmen = v))} />
            <ChoiceRow
              label="Gewinnermittlung"
              value={b.gewinnermittlung}
              onChange={(v) => upd((x) => void (x.gewinnermittlung = v))}
              options={[
                { value: "ear", label: "Einnahmen-Ausgaben-Rechnung" },
                { value: "basis", label: `Basispauschalierung (${(p.basispauschalierung.rate * 100).toLocaleString("de-DE")} %)` },
                { value: "klein", label: `Kleinunternehmerpauschalierung (bis ${eur(p.kleinunternehmerGrenze, 0)})` },
              ]}
            />
            {b.gewinnermittlung === "ear" && <MoneyRow label="Betriebsausgaben" sublabel="ohne Sozialversicherung" value={b.ausgaben} onChange={(v) => upd((x) => void (x.ausgaben = v))} />}
            {b.gewinnermittlung === "basis" && (
              <SwitchRow label="Beratung, Vortrag, Schriftsteller" sublabel={`reduzierter Satz ${(p.basispauschalierung.reduziert * 100).toLocaleString("de-DE")} %`} value={b.reduzierterSatz} onValueChange={(v) => upd((x) => void (x.reduzierterSatz = v))} />
            )}
            {b.gewinnermittlung === "klein" && (
              <SwitchRow label="Dienstleistungsbetrieb" sublabel="20 % statt 45 % Pauschale" value={b.dienstleistung} onValueChange={(v) => upd((x) => void (x.dienstleistung = v))} />
            )}
            <MoneyRow label="SVS-Beiträge" sublabel="immer zusätzlich absetzbar" value={b.sozialversicherung} onChange={(v) => upd((x) => void (x.sozialversicherung = v))} />
            {b.gewinnermittlung === "ear" && b.einnahmen - b.ausgaben - b.sozialversicherung > p.gewinnfreibetrag.bis && (
              <MoneyRow
                label="Begünstigte Investitionen"
                sublabel={`für den investitionsbedingten Gewinnfreibetrag (Gewinn über ${eur(p.gewinnfreibetrag.bis, 0)})`}
                value={b.investitionen}
                onChange={(v) => upd((x) => void (x.investitionen = v))}
              />
            )}
            <Row label={`Gewinn ${year}`} sublabel="nach Gewinnfreibetrag" value={eur(r.gewinn)} strong />
            <Row label="Entfernen" destructive onPress={() => set((d) => void d.betriebe.splice(i, 1))} />
          </Section>
        );
      })}

      {data.betriebe.length > 0 && (
        <Section footer="Noch nicht verrechnete betriebliche Verluste aus Vorjahren laut Bescheid.">
          <MoneyRow label="Verlustvortrag" value={data.verlustvortrag} onChange={(v) => set((d) => void (d.verlustvortrag = v))} />
        </Section>
      )}

      {(data.mietobjekte.length > 0 || data.betriebe.length > 0) && <Button title="Ergebnis ansehen ›" variant="ghost" onPress={() => router.navigate("/ergebnis")} />}
    </>
  );
}
