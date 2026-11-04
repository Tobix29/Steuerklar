import { useRouter } from "expo-router";
import { Row, Screen, Section } from "~/components/ui";

export default function Mehr() {
  const router = useRouter();
  return (
    <Screen title="Mehr">
      <Section title="Nach der Abgabe" footer="Bescheid prüfen und Beschwerde schreiben, Briefe vom Finanzamt verstehen und beantworten.">
        <Row label="🏛️  Finanzamt" sublabel="Bescheid prüfen · Brief beantworten" chevron onPress={() => router.push("/mehr/finanzamt")} />
      </Section>
      <Section>
        <Row label="💬  Fragen an den Steuerassistenten" chevron onPress={() => router.push("/mehr/fragen")} />
        <Row label="⚙️  Konto & Sicherheit" chevron onPress={() => router.push("/mehr/konto")} />
      </Section>
    </Screen>
  );
}
