import { router } from "expo-router";
import { Text, View } from "react-native";
import { Badge, Button, Card, Loading, Notice, Row, Screen, Section, useTextStyles } from "~/components/ui";
import { YearChips, YearsOverview } from "~/components/YearsOverview";
import { NaechsteTermine, RuecklagenPlaner } from "~/components/Planer";
import { useCase } from "~/lib/case";
import { eur } from "~/lib/format";
import { useColors } from "~/lib/theme";
import { insights } from "@core/tax/insights";
import { fragen, mitErsparnis } from "@core/agent/fragen";

export default function Uebersicht() {
  const c = useColors();
  const t = useTextStyles();
  const { data, result, year, documentCount, error, loading, reload } = useCase();

  if (!data || !result) return error ? <Screen webTitle="Übersicht"><Notice tone="red" text={error} /></Screen> : <Loading />;

  const hasLz = data.lohnzettel.length > 0 || data.mietobjekte.length > 0 || data.betriebe.length > 0;
  const hasDeductions = data.pendlerKm > 0 || data.telearbeitstage > 0 || data.werbungskosten.length > 0 || data.children.length > 0;
  const steps = [
    { title: "Über dich", text: "Arbeitsweg, Homeoffice, Kinder", done: !!data.firstName, href: "/profil" as const },
    { title: "Lohnzettel (L16)", text: "Foto oder PDF aus FinanzOnline", done: hasLz, href: "/belege" as const },
    { title: "Weitere Belege", text: "Arbeitsmittel, Fortbildung, Arzt", done: documentCount > 1 || hasDeductions, href: "/belege" as const },
    { title: "Abgeben lassen", text: "Kanzlei prüft und übermittelt", done: false, href: "/mehr/abgabe" as const },
  ];
  const done = steps.filter((s) => s.done).length;
  const refund = result.erstattung;

  const tips: { icon: string; text: string; href: "/profil" | "/belege" | "/ergebnis" }[] = [];
  if (hasLz) for (const x of insights(data, result).tips.filter((x) => x.key !== "grenz").slice(0, 2)) tips.push({ icon: x.icon, text: x.title, href: "/ergebnis" });
  if (hasLz && data.pendlerKm === 0) tips.push({ icon: "🚆", text: "Pendelst du zur Arbeit? Pendlerpauschale und Pendlereuro senken deine Steuer.", href: "/profil" });
  if (hasLz && data.telearbeitstage === 0) tips.push({ icon: "🏠", text: "Im Homeoffice gearbeitet? Bis zu 300 € Telearbeitspauschale plus Mobiliar.", href: "/profil" });
  if (hasLz && data.werbungskosten.length === 0) tips.push({ icon: "💻", text: "Laptop, Fachbücher, Kurse? Werbungskosten über 132 € bringen Geld zurück.", href: "/belege" });
  if (data.children.length === 0) tips.push({ icon: "👶", text: "Kinder? Der Familienbonus Plus bringt bis zu 2.000 € pro Kind und Jahr.", href: "/profil" });

  return (
    <Screen webTitle="Übersicht" onRefresh={reload} refreshing={loading}>
      <YearChips />

      {(() => {
        const offen = mitErsparnis(data, result, fragen(data, result));
        if (!offen.length) return null;
        const summe = offen.reduce((s, f) => s + Math.max(0, f.ersparnis), 0);
        return (
          <Section>
            <Row
              icon="✨"
              label={`Steuer-Check ${year}`}
              sublabel={`${offen.length} kurze Frage(n)${summe >= 20 ? ` · bis zu ca. ${eur(summe, 0)} mehr` : ""}`}
              chevron
              onPress={() => router.navigate("/uebersicht/check" as never)}
            />
          </Section>
        );
      })()}

      <Card style={{ alignItems: "center", gap: 6, paddingVertical: 28 }}>
        <Text style={t.muted}>{refund >= 0 ? "Voraussichtliche Gutschrift" : "Voraussichtliche Nachforderung"}</Text>
        <Text style={[t.big, { color: hasLz ? (refund >= 0 ? c.green : c.red) : c.muted }]} accessibilityLabel={hasLz ? `${eur(Math.abs(refund), 0)}` : "noch kein Ergebnis"}>
          {hasLz ? eur(Math.abs(refund), 0) : "– €"}
        </Text>
        <Text style={[t.muted, { textAlign: "center", fontSize: 13 }]}>
          {hasLz ? `${result.e1Erforderlich ? "Einkommensteuererklärung" : "Arbeitnehmerveranlagung"} ${year} · wird live neu berechnet` : "Lade deinen Lohnzettel hoch, um deine Gutschrift zu sehen."}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <Button title="📸 Beleg fotografieren" onPress={() => router.navigate("/belege")} />
          {hasLz && <Button title="Details" variant="secondary" onPress={() => router.navigate("/ergebnis")} />}
        </View>
      </Card>

      <YearsOverview />

      <NaechsteTermine data={data} result={result} />

      <RuecklagenPlaner data={data} result={result} />

      <Section title={`Fortschritt · ${done} von ${steps.length}`}>
        {steps.map((s) => (
          <Row key={s.title} label={s.title} sublabel={s.text} icon={s.done ? "✅" : "○"} chevron onPress={() => router.navigate(s.href)} />
        ))}
      </Section>

      {tips.length > 0 && (
        <Section title="Geld, das noch liegen könnte">
          {tips.map((x) => (
            <Row key={x.text} icon={x.icon} label={x.text} chevron onPress={() => router.navigate(x.href)} />
          ))}
        </Section>
      )}

      {hasLz && result.pflichtveranlagung.map((p) => <Notice key={p} tone="orange" icon="⚠️" text={p} />)}
      {result.provisional && (
        <View style={{ alignItems: "center" }}>
          <Badge text="Prognose – einzelne Werte noch nicht amtlich verifiziert" tone="orange" />
        </View>
      )}
    </Screen>
  );
}
