import { useRouter } from "expo-router";
import { Row, Screen, Section } from "~/components/ui";
import { useCase } from "~/lib/case";

export default function Mehr() {
  const router = useRouter();
  const { data } = useCase();
  const anzahl = data?.betriebe.reduce((a, b) => a + b.buchungen.length, 0) ?? 0;
  return (
    <Screen title="Mehr">
      <Section title="Nach der Abgabe" footer="Bescheid prüfen und Beschwerde schreiben, Briefe vom Finanzamt verstehen und beantworten.">
        <Row label="🏛️  Finanzamt" sublabel="Bescheid prüfen · Brief beantworten" chevron onPress={() => router.push("/mehr/finanzamt")} />
      </Section>
      <Section title="Selbständig" footer="Einnahmen-Ausgaben-Journal mit Belegscan – Gewinn und Umsatzsteuer stehen am Jahresende automatisch fest.">
        <Row
          label="📒  Buchhaltung"
          sublabel={data?.betriebe.length ? `${anzahl} Buchung(en)` : "Zuerst unter „Über dich“ eine Tätigkeit anlegen"}
          chevron
          onPress={() => router.push("/mehr/buchhaltung")}
        />
      </Section>
      <Section>
        <Row label="💬  Fragen an den Steuerassistenten" chevron onPress={() => router.push("/mehr/fragen")} />
        <Row label="⚙️  Konto & Sicherheit" chevron onPress={() => router.push("/mehr/konto")} />
      </Section>
    </Screen>
  );
}
