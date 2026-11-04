import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { Button, Card, Checkbox, Loading, Notice, Row, Screen, Section, useTextStyles } from "~/components/ui";
import { downloadPdf, removeLocalFile } from "~/lib/api";
import { useSensitiveScreen } from "~/lib/appLock";
import { useCase } from "~/lib/case";
import { FINANZONLINE_URL } from "~/lib/config";
import { eur, pct } from "~/lib/format";
import { useColors } from "~/lib/theme";
import type { Line } from "~/lib/types";

const minus = (n: number) => `− ${eur(n)}`;

function Lines({ items, sign = "" }: { items: Line[]; sign?: "−" | "" }) {
  return (
    <>
      {items.map((l, i) => (
        <Row key={`${l.label}-${i}`} label={l.label} sublabel={[l.kz ? `KZ ${l.kz}` : null, l.hint].filter(Boolean).join(" · ") || undefined} value={sign ? minus(l.amount) : eur(l.amount)} />
      ))}
    </>
  );
}

export default function Ergebnis() {
  useSensitiveScreen("ergebnis");
  const c = useColors();
  const t = useTextStyles();
  const { result: r, year, reload, loading } = useCase();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!r) return <Loading />;
  const hasIncome = r.laufendeBezuege > 0;
  const refund = r.erstattung;

  async function sharePdf() {
    setBusy(true);
    setError(null);
    try {
      if (Platform.OS === "web") throw new Error("Das PDF kann in der Web-Vorschau nicht geteilt werden – bitte die App verwenden.");
      const uri = await downloadPdf(year);
      if (!(await Sharing.isAvailableAsync())) throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: `Arbeitnehmerveranlagung ${year}` });
      removeLocalFile(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das PDF konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen webTitle="Ergebnis" onRefresh={reload} refreshing={loading}>
      {!hasIncome && <Notice tone="blue" icon="ℹ️" text="Lade zuerst deinen Lohnzettel hoch, um ein Ergebnis zu erhalten." />}

      <Card style={{ alignItems: "center", gap: 6, paddingVertical: 26 }}>
        <Text style={t.muted}>{refund >= 0 ? "Voraussichtliche Gutschrift" : "Voraussichtliche Nachforderung"}</Text>
        <Text style={[t.big, { color: refund >= 0 ? c.green : c.red }]}>{eur(Math.abs(refund))}</Text>
        <View style={{ flexDirection: "row", gap: 22, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Stat label="Grenzsteuersatz" value={pct(r.grenzsteuersatz)} />
          <Stat label="Durchschnitt" value={pct(r.durchschnittssteuersatz)} />
          <Stat label="Einkommen" value={eur(r.einkommen, 0)} />
        </View>
        {r.provisional && <Text style={[t.muted, { fontSize: 12, marginTop: 8 }]}>Prognose – einzelne Parameter noch nicht amtlich verifiziert.</Text>}
      </Card>

      <Section title="Einkünfte">
        <Row label="Laufende Bezüge" sublabel="KZ 245 laut Lohnzettel" value={eur(r.laufendeBezuege)} />
        <Lines items={r.werbungskosten} sign="−" />
        <Row label="Einkünfte" value={eur(r.einkuenfte)} strong />
      </Section>

      {(r.sonderausgaben.length > 0 || r.aussergewoehnlicheBelastungen.length > 0) && (
        <Section title="Sonderausgaben & Belastungen">
          <Lines items={r.sonderausgaben} sign="−" />
          <Lines items={r.aussergewoehnlicheBelastungen} sign="−" />
          <Row label="Einkommen" value={eur(r.einkommen)} strong />
        </Section>
      )}

      <Section title="Steuer">
        <Row label="Tarifsteuer" value={eur(r.tarifsteuer)} />
        <Lines items={r.absetzbetraege} sign="−" />
        {r.negativsteuer.map((l, i) => (
          <Row key={i} label={l.label} sublabel={l.hint} value={`+ ${eur(l.amount)}`} valueColor={c.green} />
        ))}
        {r.sonstigeBezuege > 0 && <Row label="Steuer 13./14. Gehalt" sublabel={`auf ${eur(r.sonstigeBezuege)} sonstige Bezüge`} value={eur(r.steuerSonstigeBezuege)} />}
        <Row label="Einkommensteuer" value={eur(r.einkommensteuer)} strong />
        <Row label="Bereits bezahlte Lohnsteuer" sublabel="KZ 260" value={eur(r.anrechenbareLohnsteuer)} />
        <Row label={refund >= 0 ? "Gutschrift" : "Nachforderung"} value={eur(Math.abs(refund))} strong valueColor={refund >= 0 ? c.green : c.red} />
      </Section>

      {r.formular.length > 0 && (
        <Section title="So trägst du es in FinanzOnline ein" footer="Formular L1 (Arbeitnehmerveranlagung) und je Kind L1k. Daten aus dem Lohnzettel, Spenden und Kirchenbeitrag hat das Finanzamt bereits.">
          {r.formular.map((f, i) => (
            <Row key={i} label={f.label} sublabel={`${f.formular}${f.kz && f.kz !== "—" ? ` · KZ ${f.kz}` : ""}`} value={f.value} />
          ))}
        </Section>
      )}

      {r.pflichtveranlagung.map((h) => <Notice key={h} tone="orange" icon="⚠️" text={h} />)}
      {r.hinweise.map((h) => <Notice key={h} icon="ℹ️" text={h} />)}

      <Card style={{ gap: 14 }}>
        <Text style={t.title2}>Abgeben</Text>
        <Text style={t.muted}>Lade die Ausfüllhilfe mit allen Kennzahlen und übertrage die Werte in FinanzOnline.</Text>
        <Checkbox checked={confirmed} onChange={setConfirmed} label="Ich habe alle Angaben geprüft. Sie sind nach bestem Wissen vollständig und richtig." />
        {error && <Notice tone="red" text={error} />}
        <Button title="Ausfüllhilfe (PDF) teilen" onPress={() => void sharePdf()} loading={busy} disabled={!confirmed || !hasIncome} />
        <Button title="FinanzOnline öffnen ↗" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(FINANZONLINE_URL)} />
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}
