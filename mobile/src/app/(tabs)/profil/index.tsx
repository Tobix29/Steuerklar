import { Text, View } from "react-native";
import { Button, ChoiceRow, Loading, MoneyRow, NumberRow, Row, Screen, Section, Segmented, SwitchRow, TextRow } from "~/components/ui";
import { useCase } from "~/lib/case";
import { eur, uid } from "~/lib/format";
import { BUNDESLAENDER, WK_LABELS, type WkKategorie } from "~/lib/labels";
import { useColors } from "~/lib/theme";
import { YEAR_PARAMS, type TaxCase } from "~/lib/types";
import { WeitereEinkuenfte } from "~/components/WeitereEinkuenfte";
import { behinderungPauschbetrag } from "@core/tax/calculate";

const WK_OPTIONS = (Object.keys(WK_LABELS) as WkKategorie[]).map((k) => ({ value: k, label: WK_LABELS[k] }));

export default function Profil() {
  const c = useColors();
  const { data, update, year, saveState, error } = useCase();
  if (!data) return <Loading />;
  const set = (fn: (d: TaxCase) => void) => update(fn);
  const p = YEAR_PARAMS[year];
  const hasPension = data.lohnzettel.some((l) => l.art === "pension");

  return (
    <Screen webTitle="Über dich">
      <Text style={{ color: saveState === "error" ? c.red : c.muted, fontSize: 13, textAlign: "center" }}>
        {saveState === "saving" ? "Speichert …" : saveState === "saved" ? "✓ Automatisch gespeichert" : saveState === "error" ? error ?? "Fehler beim Speichern" : `${data.mietobjekte.length || data.betriebe.length ? "Einkommensteuererklärung" : "Arbeitnehmerveranlagung"} ${year}`}
      </Text>

      <Section title="Persönliches">
        <TextRow label="Vorname" value={data.firstName} onChangeText={(v) => set((d) => void (d.firstName = v.slice(0, 100)))} textContentType="givenName" autoComplete="given-name" />
        <TextRow label="Nachname" value={data.lastName} onChangeText={(v) => set((d) => void (d.lastName = v.slice(0, 100)))} textContentType="familyName" autoComplete="family-name" />
        <ChoiceRow label="Bundesland" value={data.bundesland} options={BUNDESLAENDER.map((b) => ({ value: b.code as string, label: b.name }))} onChange={(v) => set((d) => void (d.bundesland = v))} />
      </Section>

      <Section title="Arbeitsweg" footer="Die Entfernung ermittelst du am besten mit dem Pendlerrechner des BMF – dessen Ergebnis ist für das Finanzamt verbindlich.">
        <NumberRow label="Einfache Strecke" value={data.pendlerKm} max={1000} suffix="km" onChange={(v) => set((d) => void (d.pendlerKm = v))} />
        <SwitchRow
          label="Öffis zumutbar"
          sublabel="Aus: großes Pendlerpauschale (z. B. keine Verbindung)"
          value={data.oeffiZumutbar}
          onValueChange={(v) => set((d) => void (d.oeffiZumutbar = v))}
        />
        <NumberRow label="Fahrten pro Monat" sublabel="ab 11: voll · 8–10: ⅔ · 4–7: ⅓" value={data.fahrtenProMonat} max={31} onChange={(v) => set((d) => void (d.fahrtenProMonat = v))} />
      </Section>

      <Section title="Homeoffice (Telearbeit)">
        <NumberRow label="Telearbeitstage" sublabel="3 € pro Tag, max. 100 Tage" value={data.telearbeitstage} suffix="Tage" onChange={(v) => set((d) => void (d.telearbeitstage = v))} />
        <MoneyRow label="Davon vom Arbeitgeber bezahlt" value={data.telearbeitspauschaleArbeitgeber} onChange={(v) => set((d) => void (d.telearbeitspauschaleArbeitgeber = v))} />
        <MoneyRow label="Ergonomisches Mobiliar" sublabel="Schreibtisch, Sessel – max. 300 € (ab 26 Tagen)" value={data.mobiliar} onChange={(v) => set((d) => void (d.mobiliar = v))} />
      </Section>

      <Section title="Familie">
        <View style={{ padding: 12 }}>
          <Segmented
            value={data.familienstatus}
            onChange={(v) => set((d) => void (d.familienstatus = v))}
            options={[
              { value: "keine", label: "Standard" },
              { value: "alleinverdiener", label: "Alleinverdiener" },
              { value: "alleinerzieher", label: "Alleinerzieher" },
            ]}
          />
        </View>
        {data.familienstatus === "alleinverdiener" && (
          <MoneyRow label="Einkünfte Partner:in" sublabel="Für den Alleinverdienerabsetzbetrag" value={data.partnerEinkuenfte} onChange={(v) => set((d) => void (d.partnerEinkuenfte = v))} />
        )}
      </Section>

      {data.children.map((k, i) => (
        <Section key={k.id} title={`Kind ${i + 1}`}>
          <TextRow label="Vorname" value={k.firstName} onChangeText={(v) => set((d) => void (d.children[i]!.firstName = v.slice(0, 100)))} />
          <NumberRow label="Geburtsjahr" value={k.birthYear} max={year} onChange={(v) => set((d) => void (d.children[i]!.birthYear = Math.max(1950, v)))} />
          <NumberRow label="Monate Familienbeihilfe" value={k.months} max={12} onChange={(v) => set((d) => void (d.children[i]!.months = v))} />
          <View style={{ padding: 12, gap: 8 }}>
            <Text style={{ color: c.text, fontSize: 15 }}>Familienbonus Plus</Text>
            <Segmented
              value={k.familienbonusShare}
              onChange={(v) => set((d) => void (d.children[i]!.familienbonusShare = v))}
              options={[
                { value: 1, label: "Ganz für mich" },
                { value: 0.5, label: "Hälfte (aufgeteilt)" },
              ]}
            />
          </View>
          {year - k.birthYear >= 15 && (
            <NumberRow
              label="Auswärtige Berufsausbildung"
              sublabel="Monate, kein Ausbildungsort im Umkreis von 80 km – 110 € pro Monat"
              value={k.auswaertigeAusbildungMonate}
              max={12}
              suffix="Mon."
              onChange={(v) => set((d) => void (d.children[i]!.auswaertigeAusbildungMonate = v))}
            />
          )}
          <Row label="Kind entfernen" destructive onPress={() => set((d) => void d.children.splice(i, 1))} />
        </Section>
      ))}
      <Button
        title="+ Kind hinzufügen"
        variant="secondary"
        onPress={() => set((d) => void d.children.push({ id: uid(), firstName: "", birthYear: year - 3, months: 12, familienbonusShare: 1, auswaertigeAusbildungMonate: 0 }))}
      />

      <Section title="Unterhalt" footer="Für Kinder, die nicht bei dir wohnen und für die du gesetzlichen Unterhalt zahlst (Unterhaltsabsetzbetrag). Zusätzlich kannst du den halben Familienbonus beantragen – das Kind dafür oben mit „Hälfte“ eintragen.">
        {data.unterhaltKinder.map((k, i) => (
          <View key={k.id}>
            <TextRow label={`Kind ${i + 1}`} value={k.firstName} placeholder="Vorname" onChangeText={(v) => set((d) => void (d.unterhaltKinder[i]!.firstName = v.slice(0, 100)))} />
            <NumberRow
              label="Monate mit Unterhalt"
              sublabel={`${eur(p.uab[Math.min(i, 2)]!)} pro Monat`}
              value={k.months}
              max={12}
              suffix="Mon."
              onChange={(v) => set((d) => void (d.unterhaltKinder[i]!.months = v))}
            />
            <Row label="Entfernen" destructive onPress={() => set((d) => void d.unterhaltKinder.splice(i, 1))} />
          </View>
        ))}
        <Row label="+ Kind mit Unterhalt" onPress={() => set((d) => void d.unterhaltKinder.push({ id: uid(), firstName: "", months: 12 }))} />
      </Section>

      {hasPension && (
        <Section title="Pension">
          <SwitchRow
            label="Erhöhter Pensionistenabsetzbetrag"
            sublabel={`Ehe/Partnerschaft, Partnereinkünfte bis ${eur(p.pension.partnerLimit, 0)}, kein Alleinverdienerabsetzbetrag`}
            value={data.pensionErhoeht}
            onValueChange={(v) => set((d) => void (d.pensionErhoeht = v))}
          />
          {data.pensionErhoeht && <MoneyRow label="Einkünfte Partner:in" value={data.partnerEinkuenfte} onChange={(v) => set((d) => void (d.partnerEinkuenfte = v))} />}
        </Section>
      )}

      <Section title="Arbeiten fern von zu Hause">
        <MoneyRow label="Doppelte Haushaltsführung" sublabel="Zweitwohnung am Arbeitsort (KZ 723)" value={data.doppelteHaushaltsfuehrung} onChange={(v) => set((d) => void (d.doppelteHaushaltsfuehrung = v))} />
        <MoneyRow label="Familienheimfahrten" sublabel={`max. ${eur(p.pendlerGross.from60, 0)} pro Jahr (KZ 300)`} value={data.familienheimfahrten} onChange={(v) => set((d) => void (d.familienheimfahrten = v))} />
      </Section>

      <Section title="Behinderung" footer="Ab 25 % laut Bescheid des Sozialministeriumservice – Pauschbetrag ohne Selbstbehalt.">
        <NumberRow
          label="Grad der Behinderung"
          sublabel={data.behinderungGrad >= 25 ? `Pauschbetrag ${eur(behinderungPauschbetrag(data.behinderungGrad), 0)} pro Jahr` : undefined}
          value={data.behinderungGrad}
          max={100}
          suffix="%"
          onChange={(v) => set((d) => void (d.behinderungGrad = v))}
        />
        {data.behinderungGrad >= 25 && (
          <SwitchRow label="Eigenes Kfz wegen Gehbehinderung" sublabel="190 € pro Monat" value={data.behinderungKfz} onValueChange={(v) => set((d) => void (d.behinderungKfz = v))} />
        )}
      </Section>

      <Section title="Kapitalerträge" footer="Bei niedrigem Einkommen bekommst du mit der Regelbesteuerungsoption KESt zurück – Steuerklar rechnet, ob es sich lohnt.">
        <MoneyRow label="Erträge mit 27,5 % KESt" sublabel="Dividenden, Fonds, Kursgewinne" value={data.kapital.ertraege275} onChange={(v) => set((d) => void (d.kapital.ertraege275 = v))} />
        <MoneyRow label="Zinsen mit 25 % KESt" sublabel="Sparbuch, Festgeld" value={data.kapital.ertraege25} onChange={(v) => set((d) => void (d.kapital.ertraege25 = v))} />
        <MoneyRow label="Bereits abgezogene KESt" value={data.kapital.kestBezahlt} onChange={(v) => set((d) => void (d.kapital.kestBezahlt = v))} />
      </Section>

      <WeitereEinkuenfte data={data} set={set} year={year} />

      <Section title="Werbungskosten" footer="Am einfachsten: Rechnungen unter „Belege“ fotografieren. Bis 132 € gilt automatisch die Pauschale.">
        {data.werbungskosten.map((w, i) =>
          w.documentId ? (
            <Row key={w.id} label={w.label} sublabel={`Aus Beleg · ${WK_LABELS[w.category ?? "sonstige"]}`} value={eur(w.amount)} />
          ) : (
            <View key={w.id}>
              <TextRow label="Bezeichnung" value={w.label} placeholder="z. B. Fachbuch" onChangeText={(v) => set((d) => void (d.werbungskosten[i]!.label = v.slice(0, 200)))} />
              <MoneyRow label="Betrag" value={w.amount} onChange={(v) => set((d) => void (d.werbungskosten[i]!.amount = v))} />
              <ChoiceRow label="Kategorie" value={w.category ?? "sonstige"} options={WK_OPTIONS} onChange={(v) => set((d) => void (d.werbungskosten[i]!.category = v))} />
              <Row label="Eintrag entfernen" destructive onPress={() => set((d) => void d.werbungskosten.splice(i, 1))} />
            </View>
          ),
        )}
        <Row label="+ Eintrag hinzufügen" onPress={() => set((d) => void d.werbungskosten.push({ id: uid(), label: "", amount: 0, category: "sonstige" }))} />
      </Section>

      <Section title="Sonderausgaben" footer="Kirchenbeitrag und Spenden werden von Kirche bzw. Organisation automatisch ans Finanzamt gemeldet – hier nur für die Prognose.">
        <MoneyRow label="Kirchenbeitrag" sublabel={`max. ${eur(p.kirchenbeitragMax, 0)} pro Jahr (${year})`} value={data.kirchenbeitrag} onChange={(v) => set((d) => void (d.kirchenbeitrag = v))} />
      </Section>
    </Screen>
  );
}
