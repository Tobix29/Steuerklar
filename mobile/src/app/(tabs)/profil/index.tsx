import { Text, View } from "react-native";
import { Button, ChoiceRow, Loading, MoneyRow, NumberRow, Row, Screen, Section, Segmented, SwitchRow, TextRow } from "~/components/ui";
import { useCase } from "~/lib/case";
import { eur, uid } from "~/lib/format";
import { BUNDESLAENDER, WK_LABELS, type WkKategorie } from "~/lib/labels";
import { useColors } from "~/lib/theme";
import type { TaxCase } from "~/lib/types";

const WK_OPTIONS = (Object.keys(WK_LABELS) as WkKategorie[]).map((k) => ({ value: k, label: WK_LABELS[k] }));

export default function Profil() {
  const c = useColors();
  const { data, update, year, saveState, error } = useCase();
  if (!data) return <Loading />;
  const set = (fn: (d: TaxCase) => void) => update(fn);

  return (
    <Screen webTitle="Über dich">
      <Text style={{ color: saveState === "error" ? c.red : c.muted, fontSize: 13, textAlign: "center" }}>
        {saveState === "saving" ? "Speichert …" : saveState === "saved" ? "✓ Automatisch gespeichert" : saveState === "error" ? error ?? "Fehler beim Speichern" : `Arbeitnehmerveranlagung ${year}`}
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
          <Row label="Kind entfernen" destructive onPress={() => set((d) => void d.children.splice(i, 1))} />
        </Section>
      ))}
      <Button
        title="+ Kind hinzufügen"
        variant="secondary"
        onPress={() => set((d) => void d.children.push({ id: uid(), firstName: "", birthYear: year - 3, months: 12, familienbonusShare: 1, auswaertigeAusbildungMonate: 0 }))}
      />

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
        <MoneyRow label="Kirchenbeitrag" sublabel="max. 600 € pro Jahr" value={data.kirchenbeitrag} onChange={(v) => set((d) => void (d.kirchenbeitrag = v))} />
      </Section>
    </Screen>
  );
}
