import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Row, Screen, Section } from "~/components/ui";
import { api } from "~/lib/api";
import { useCase } from "~/lib/case";
import { eur } from "~/lib/format";
import { offenePosten } from "@core/tax/rechnung";

export default function Mehr() {
  const router = useRouter();
  const { data, year } = useCase();
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    let aktiv = true;
    api<{ abgaben: { status: string; statusLabel: string }[] }>(`/api/abgaben?year=${year}`)
      .then((r) => aktiv && setStatus((r.abgaben.find((a) => a.status !== "zurueckgezogen") ?? r.abgaben[0])?.statusLabel ?? null))
      .catch(() => aktiv && setStatus(null));
    return () => {
      aktiv = false;
    };
  }, [year]);
  const anzahl = data?.betriebe.reduce((a, b) => a + b.buchungen.length, 0) ?? 0;
  return (
    <Screen title="Mehr">
      <Section title="Abgabe" footer="Deine Partner-Kanzlei prüft deine Erklärung und bringt sie über FinanzOnline beim Finanzamt ein.">
        <Row label="📤  Abgeben lassen" sublabel={status ?? `Steuererklärung ${year} freigeben`} chevron onPress={() => router.push("/mehr/abgabe")} />
      </Section>
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
        <Row
          label="🧾  Rechnungen"
          sublabel={(() => {
            if (!data?.betriebe.length) return "Ausgangsrechnungen mit allen Pflichtangaben";
            const op = data.betriebe.flatMap((b) => offenePosten(b));
            const ue = op.filter((o) => o.ueberfaellig);
            if (!op.length) return "Keine offenen Rechnungen";
            return `${eur(op.reduce((s, o) => s + o.brutto, 0))} offen${ue.length ? ` · ${eur(ue.reduce((s, o) => s + o.brutto, 0))} überfällig` : ""}`;
          })()}
          chevron
          onPress={() => router.push("/mehr/rechnungen")}
        />
      </Section>
      <Section>
        <Row label="💬  Fragen an den Steuerassistenten" chevron onPress={() => router.push("/mehr/fragen")} />
        <Row label="⚙️  Konto & Sicherheit" chevron onPress={() => router.push("/mehr/konto")} />
      </Section>
    </Screen>
  );
}
