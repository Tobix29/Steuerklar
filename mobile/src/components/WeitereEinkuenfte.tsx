import { router } from "expo-router";
import { Fragment } from "react";
import { Text, View } from "react-native";
import { Button, ChoiceRow, MoneyRow, NumberRow, Row, Section, Segmented, SwitchRow, TextRow } from "~/components/ui";
import { eur, uid } from "~/lib/format";
import { useColors } from "~/lib/theme";
import { gwgGrenze } from "@core/tax/constants";
import { YEAR_PARAMS, type Betrieb, type Mietobjekt, type TaxCase, type TaxYear } from "~/lib/types";
import { anlageAfa, betrieb, gebaeudeAfa, vermietung } from "@core/tax/einkuenfte";
import { mitJournal } from "@core/tax/journal";

const neuesObjekt = (year: number): Mietobjekt => ({
  id: uid(), bezeichnung: "", einnahmen: 0, anschaffungskosten: 0, grundanteil: 20, anschaffungsjahr: year - 5, anschaffungsmonat: 1,
  neubau2024bis2026: false, afaManuell: 0, zinsen: 0, instandhaltung: 0, instandsetzungen: [], betriebskosten: 0, sonstigeWerbungskosten: 0, ustSatz: 10, vorsteuer: 0,
});

const neuerBetrieb = (): Betrieb => ({
  id: uid(), bezeichnung: "", art: "selbstaendig", einnahmen: 0, gewinnermittlung: "ear", ausgaben: 0, sozialversicherung: 0, reduzierterSatz: false, dienstleistung: false, investitionen: 0, ustSatz: 20, vorsteuer: 0, anlagen: [], buchungen: [], rechnungen: [],
  firma: { name: "", adresse: "", uid: "", iban: "", bic: "", email: "", kleinunternehmer: true },
});

/** Vermietung (E1b) und Selbständig/Gewerbe (E1a) inkl. Instandsetzungen und Umsatzsteuer. */
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
          <Section key={o.id} title={`🏠 Vermietung ${i + 1}`}>
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
            {o.instandsetzungen.map((inst, j) => (
              <View key={inst.id}>
                <NumberRow label={`Instandsetzung ${j + 1}: Jahr`} sublabel="wird auf 15 Jahre verteilt" value={inst.jahr} max={2100} onChange={(v) => upd((x) => void (x.instandsetzungen[j]!.jahr = Math.max(1990, v)))} />
                <MoneyRow label={`Instandsetzung ${j + 1}: Betrag`} sublabel={`davon ${year}: ${eur(year >= inst.jahr && year < inst.jahr + 15 ? inst.betrag / 15 : 0)}`} value={inst.betrag} onChange={(v) => upd((x) => void (x.instandsetzungen[j]!.betrag = v))} />
                <Row label="Instandsetzung entfernen" destructive onPress={() => upd((x) => void x.instandsetzungen.splice(j, 1))} />
              </View>
            ))}
            <Row label="+ Instandsetzung" sublabel="Fenster, Heizung, Leitungen – größere Sanierungen" onPress={() => upd((x) => void x.instandsetzungen.push({ id: uid(), jahr: year, betrag: 0 }))} />
            <View style={{ padding: 12, gap: 8 }}>
              <Text style={{ color: c.text, fontSize: 15 }}>Umsatzsteuer</Text>
              <Segmented value={o.ustSatz} onChange={(v) => upd((x) => void (x.ustSatz = v))} options={[{ value: 10, label: "10 % Wohnung" }, { value: 20, label: "20 %" }, { value: 0, label: "frei" }]} />
            </View>
            <MoneyRow label="Vorsteuer" sublabel="nur ohne Kleinunternehmerbefreiung" value={o.vorsteuer} onChange={(v) => upd((x) => void (x.vorsteuer = v))} />
            <Row label={r.ergebnis >= 0 ? `Überschuss ${year}` : `Verlust ${year}`} value={eur(r.ergebnis)} strong />
            <Row label="Objekt entfernen" destructive onPress={() => set((d) => void d.mietobjekte.splice(i, 1))} />
          </Section>
        );
      })}

      {data.betriebe.map((b, i) => {
        const journal = b.buchungen.length > 0;
        const eff = journal ? mitJournal(data).betriebe[i]! : b;
        const r = betrieb(eff, p);
        const upd = (fn: (x: Betrieb) => void) => set((d) => fn(d.betriebe[i]!));
        return (
          <Fragment key={b.id}>
          <Section title={`💼 Selbständig / Gewerbe ${i + 1}`} footer={r.hinweise.join(" ") || undefined}>
            <TextRow label="Bezeichnung" value={b.bezeichnung} placeholder="z. B. Grafikdesign" onChangeText={(v) => upd((x) => void (x.bezeichnung = v.slice(0, 200)))} />
            <View style={{ padding: 12 }}>
              <Segmented value={b.art} onChange={(v) => upd((x) => void (x.art = v))} options={[{ value: "selbstaendig", label: "Selbständig" }, { value: "gewerbe", label: "Gewerbe" }]} />
            </View>
            <Row
              label="📒 Buchhaltung"
              sublabel={journal ? `${b.buchungen.length} Buchung(en) – Summen kommen aus dem Journal` : "Belege laufend fotografieren statt Summen eintragen"}
              chevron
              onPress={() => router.push("/mehr/buchhaltung")}
            />
            <Row label="🧾 Rechnungen" sublabel={b.rechnungen.length ? `${b.rechnungen.length} Rechnung(en)` : "Ausgangsrechnungen schreiben und als PDF verschicken"} chevron onPress={() => router.push("/mehr/rechnungen")} />
            {!journal && <MoneyRow label="Betriebseinnahmen" sublabel="netto ohne USt" value={b.einnahmen} onChange={(v) => upd((x) => void (x.einnahmen = v))} />}
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
            {b.gewinnermittlung === "ear" && !journal && <MoneyRow label="Betriebsausgaben" sublabel="ohne Sozialversicherung" value={b.ausgaben} onChange={(v) => upd((x) => void (x.ausgaben = v))} />}
            {b.gewinnermittlung === "basis" && (
              <SwitchRow label="Beratung, Vortrag, Schriftsteller" sublabel={`reduzierter Satz ${(p.basispauschalierung.reduziert * 100).toLocaleString("de-DE")} %`} value={b.reduzierterSatz} onValueChange={(v) => upd((x) => void (x.reduzierterSatz = v))} />
            )}
            {b.gewinnermittlung === "klein" && (
              <SwitchRow label="Dienstleistungsbetrieb" sublabel="20 % statt 45 % Pauschale" value={b.dienstleistung} onValueChange={(v) => upd((x) => void (x.dienstleistung = v))} />
            )}
            {!journal && <MoneyRow label="SVS-Beiträge" sublabel="immer zusätzlich absetzbar" value={b.sozialversicherung} onChange={(v) => upd((x) => void (x.sozialversicherung = v))} />}
            <View style={{ padding: 12, gap: 8 }}>
              <Text style={{ color: c.text, fontSize: 15 }}>Umsatzsteuer-Satz</Text>
              <Segmented value={b.ustSatz} onChange={(v) => upd((x) => void (x.ustSatz = v))} options={[{ value: 20, label: "20 %" }, { value: 13, label: "13 %" }, { value: 10, label: "10 %" }, { value: 0, label: "frei" }]} />
            </View>
            {!journal && <MoneyRow label="Vorsteuer" sublabel="nur ohne Kleinunternehmerbefreiung" value={b.vorsteuer} onChange={(v) => upd((x) => void (x.vorsteuer = v))} />}
            {b.gewinnermittlung === "ear" && eff.einnahmen - eff.ausgaben - eff.sozialversicherung > p.gewinnfreibetrag.bis && (
              <MoneyRow
                label="Begünstigte Investitionen"
                sublabel={`für den investitionsbedingten Gewinnfreibetrag (Gewinn über ${eur(p.gewinnfreibetrag.bis, 0)})`}
                value={b.investitionen}
                onChange={(v) => upd((x) => void (x.investitionen = v))}
              />
            )}
            {b.gewinnermittlung === "ear" && (
              <Row
                label="+ Wirtschaftsgut (Anlagenverzeichnis)"
                sublabel={`Laptop, Möbel, Auto … über ${eur(gwgGrenze(year), 0)} über die Nutzungsdauer abschreiben, darunter sofort`}
                onPress={() => upd((x) => void x.anlagen.push({ id: uid(), bezeichnung: "", anschaffungsjahr: year, anschaffungsmonat: 1, kosten: 0, nutzungsdauer: 3, privatanteil: 0, pkw: false }))}
              />
            )}
            <Row label={`Gewinn ${year}`} sublabel="nach Gewinnfreibetrag" value={eur(r.gewinn)} strong />
            <Row label="Entfernen" destructive onPress={() => set((d) => void d.betriebe.splice(i, 1))} />
          </Section>
          {b.gewinnermittlung === "ear" &&
            b.anlagen.map((a, j) => {
              const afa = anlageAfa(a, year);
              const ua = (fn: (x: Betrieb["anlagen"][number]) => void) => upd((x) => fn(x.anlagen[j]!));
              return (
                <Section key={a.id} title={`🖥️ Wirtschaftsgut ${j + 1}${b.bezeichnung ? ` · ${b.bezeichnung}` : ""}`}>
                  <TextRow label="Bezeichnung" value={a.bezeichnung} placeholder="z. B. Laptop" onChangeText={(v) => ua((x) => void (x.bezeichnung = v.slice(0, 200)))} />
                  <MoneyRow label="Anschaffungskosten" sublabel="netto" value={a.kosten} onChange={(v) => ua((x) => void (x.kosten = v))} />
                  <NumberRow label="Anschaffungsjahr" value={a.anschaffungsjahr} max={2100} onChange={(v) => ua((x) => void (x.anschaffungsjahr = Math.max(1990, v)))} />
                  <NumberRow label="Anschaffungsmonat" sublabel="ab Juli: Halbjahres-AfA" value={a.anschaffungsmonat} max={12} onChange={(v) => ua((x) => void (x.anschaffungsmonat = Math.min(12, Math.max(1, v))))} />
                  <NumberRow label="Nutzungsdauer" value={a.nutzungsdauer} max={50} suffix="Jahre" onChange={(v) => ua((x) => void (x.nutzungsdauer = Math.max(1, v)))} />
                  <NumberRow label="Privatanteil" value={a.privatanteil} max={100} suffix="%" onChange={(v) => ua((x) => void (x.privatanteil = v))} />
                  <SwitchRow label="Pkw" sublabel="max. 40.000 € absetzbar, mind. 8 Jahre" value={a.pkw} onValueChange={(v) => ua((x) => void (x.pkw = v))} />
                  <Row
                    label={`AfA ${year}`}
                    sublabel={afa.gwg ? "sofort abgeschrieben (GWG)" : `Restwert ${eur(afa.restwert)}`}
                    value={eur(afa.afa * (1 - a.privatanteil / 100))}
                    strong
                  />
                  <Row label="Entfernen" destructive onPress={() => upd((x) => void x.anlagen.splice(j, 1))} />
                </Section>
              );
            })}
          </Fragment>
        );
      })}

      {data.betriebe.length > 0 && (
        <Section footer="Noch nicht verrechnete betriebliche Verluste aus Vorjahren laut Bescheid.">
          <MoneyRow label="Verlustvortrag" value={data.verlustvortrag} onChange={(v) => set((d) => void (d.verlustvortrag = v))} />
        </Section>
      )}

      {(data.mietobjekte.length > 0 || data.betriebe.length > 0) && (
        <Section title="Umsatzsteuer" footer={`Kleinunternehmergrenze ${year >= 2025 ? "55.000 € brutto" : "35.000 € netto"}. Mit Verzicht verrechnest du Umsatzsteuer und bekommst die Vorsteuer zurück (bindet 5 Jahre).`}>
          <SwitchRow label="Auf Kleinunternehmerbefreiung verzichten" value={data.ustVerzicht} onValueChange={(v) => set((d) => void (d.ustVerzicht = v))} />
        </Section>
      )}

      {(data.mietobjekte.length > 0 || data.betriebe.length > 0) && <Button title="Ergebnis ansehen ›" variant="ghost" onPress={() => router.navigate("/ergebnis")} />}
    </>
  );
}
