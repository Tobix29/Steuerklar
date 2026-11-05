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
import { insights } from "@core/tax/insights";
import { router } from "expo-router";

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
  const { result: r, data, year, reload, loading } = useCase();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!r || !data) return <Loading />;
  const hasIncome = r.laufendeBezuege > 0 || r.weitereEinkuenfte.length > 0;
  const spar = hasIncome ? insights(data, r) : null;
  const maxEffect = Math.max(1, ...(spar?.contributions.map((x) => x.effect) ?? [1]));
  const formName = r.e1Erforderlich ? "Einkommensteuererklärung" : "Arbeitnehmerveranlagung";
  const refund = r.erstattung;

  async function sharePdf() {
    setBusy(true);
    setError(null);
    try {
      if (Platform.OS === "web") throw new Error("Das PDF kann in der Web-Vorschau nicht geteilt werden – bitte die App verwenden.");
      const uri = await downloadPdf(year);
      if (!(await Sharing.isAvailableAsync())) throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: `${formName} ${year}` });
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

      <Section>
        <Row icon="📤" label="Abgeben lassen" sublabel="Partner-Kanzlei prüft und übermittelt – du gibst nur frei" chevron onPress={() => router.navigate("/mehr/abgabe")} />
      </Section>

      {spar && spar.contributions.length > 0 && (
        <Section title="Spar-Check · was dir was bringt">
          {spar.contributions.map((x) => (
            <View key={x.key} style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{x.label}</Text>
                <Text style={{ color: c.green, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] }}>+ {eur(x.effect)}</Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surface2, overflow: "hidden" }}>
                <View style={{ width: `${Math.max(2, (x.effect / maxEffect) * 100)}%`, height: 4, backgroundColor: c.green }} />
              </View>
            </View>
          ))}
        </Section>
      )}
      {spar?.tips.map((x) => (
        <Card key={x.key} style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{x.icon}  {x.title}</Text>
          <Text style={t.muted}>{x.text}</Text>
          {x.href && (
            <Text style={{ color: c.accent, fontSize: 15 }} onPress={() => router.navigate(x.href === "/app/belege" ? "/belege" : "/profil")} accessibilityRole="link">
              Jetzt anpassen ›
            </Text>
          )}
        </Card>
      ))}

      <Section title="Einkünfte">
        <Row label="Laufende Bezüge" sublabel="KZ 245 laut Lohnzettel" value={eur(r.laufendeBezuege)} />
        <Lines items={r.werbungskosten} sign="−" />
        <Row label="Einkünfte" value={eur(r.einkuenfte)} strong />
      </Section>

      {r.weitereEinkuenfte.length > 0 && (
        <Section title={r.e1Erforderlich ? "Weitere Einkünfte (E1)" : "Weitere Einkünfte"}>
          {r.weitereEinkuenfte.map((l, i) => (
            <Row key={`${l.label}-${i}`} label={l.label} sublabel={l.hint} value={eur(l.amount)} strong={l.label.startsWith("Einkünfte")} />
          ))}
          {r.veranlagungsfreibetrag > 0 ? <Row label="Veranlagungsfreibetrag" sublabel="Nebeneinkünfte bis 730 € steuerfrei" value={minus(r.veranlagungsfreibetrag)} /> : null}
          <Row label="Gesamtbetrag der Einkünfte" value={eur(r.gesamtbetragDerEinkuenfte)} strong />
        </Section>
      )}

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

      {r.immoESt && (
        <Section title="Immobilienertragsteuer" footer={r.immoESt.regelGuenstiger ? "Die Regelbesteuerung ist günstiger – die Differenz ist in der Gutschrift enthalten." : undefined}>
          {r.immoESt.lines.map((l, i) => (
            <Row key={`immo-${i}`} label={l.label} sublabel={l.hint} value={eur(l.amount)} />
          ))}
          <Row label="ImmoESt gesamt" value={eur(r.immoESt.steuer)} strong />
          <Row label="Vom Notar abgeführt" value={eur(r.immoESt.abgefuehrt)} />
        </Section>
      )}

      {r.umsatzsteuer && (
        <Section title="Umsatzsteuer (eigene Erklärung U1)" footer="Die Umsatzsteuer ist nicht Teil der Einkommensteuer-Gutschrift.">
          <Row
            label={r.umsatzsteuer.kleinunternehmer ? "Kleinunternehmer:in – keine USt" : "Umsatzsteuerpflichtig"}
            sublabel="Umsatz / Kleinunternehmergrenze"
            value={`${eur(r.umsatzsteuer.umsatz, 0)} / ${eur(r.umsatzsteuer.grenze, 0)}`}
          />
          {!r.umsatzsteuer.kleinunternehmer &&
            r.umsatzsteuer.lines.map((l, i) => <Row key={`ust-${i}`} label={l.label} sublabel={l.hint} value={eur(l.amount)} />)}
          {!r.umsatzsteuer.kleinunternehmer && (
            <Row label={r.umsatzsteuer.zahllast >= 0 ? "Zahllast" : "Gutschrift"} value={eur(Math.abs(r.umsatzsteuer.zahllast))} strong />
          )}
        </Section>
      )}

      {r.formular.length > 0 && (
        <Section
          title="So trägst du es in FinanzOnline ein"
          footer={
            r.e1Erforderlich
              ? "Einkommensteuererklärung E1 mit den Beilagen E1a (Betrieb) bzw. E1b (Vermietung), je Kind L1k. Daten aus dem Lohnzettel, Spenden und Kirchenbeitrag hat das Finanzamt bereits."
              : "Formular L1 (Arbeitnehmerveranlagung) und je Kind L1k. Daten aus dem Lohnzettel, Spenden und Kirchenbeitrag hat das Finanzamt bereits."
          }
        >
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
