import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { Badge, Button, Card, Checkbox, Notice, useTextStyles } from "~/components/ui";
import { api, removeLocalFile } from "~/lib/api";
import { useCase } from "~/lib/case";
import { eur, uid } from "~/lib/format";
import { useColors } from "~/lib/theme";
import type { BankFinding } from "~/lib/types";
import { applyFindings, BANK_KATEGORIEN, MAX_CSV_CHARS } from "@core/ai/bank";

type Finding = BankFinding & { key: string; selected: boolean };

async function readText(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === "web") return asset.file ? asset.file.text() : (await fetch(asset.uri)).text();
  const f = new File(asset.uri);
  try {
    return await f.text();
  } finally {
    removeLocalFile(asset.uri);
  }
}

/** Kontoauszug (CSV) durchsuchen: Die KI schlägt absetzbare Ausgaben vor, ausgewählte Posten werden übernommen. Der Auszug wird nicht gespeichert. */
export function BankImport({ onDone }: { onDone: (msg: string) => void }) {
  const c = useColors();
  const t = useTextStyles();
  const { year, update } = useCase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);

  async function pick() {
    setError(null);
    setHinweis(null);
    setFindings(null);
    const r = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "application/csv"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (r.canceled || !r.assets[0]) return;
    const asset = r.assets[0];
    if (asset.size && asset.size > 2_000_000) {
      setError(`Der Kontoauszug ist zu groß. Exportiere bitte nur das Jahr ${year} als CSV.`);
      return;
    }
    setBusy(true);
    try {
      const csv = (await readText(asset)).slice(0, MAX_CSV_CHARS * 2);
      const res = await api<{ findings: BankFinding[]; hinweis: string | null }>("/api/bank-import", { method: "POST", json: { year, csv } });
      setHinweis(res.hinweis);
      setFindings(res.findings.map((f) => ({ ...f, key: uid(), selected: f.sicherheit !== "niedrig" })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der Kontoauszug konnte nicht ausgewertet werden.");
    } finally {
      setBusy(false);
    }
  }

  function take() {
    const chosen = (findings ?? []).filter((f) => f.selected);
    update((d) => {
      applyFindings(d, chosen, uid);
    });
    setFindings(null);
    onDone(`${chosen.length} Posten übernommen – du findest sie unter „Über dich“.`);
  }

  const selected = (findings ?? []).filter((f) => f.selected);
  const sum = selected.reduce((a, f) => a + f.betrag * (f.beruflicherAnteil ?? 1), 0);

  return (
    <Card style={{ gap: 10 }}>
      <Text style={t.title2}>🏦 Kontoauszug durchsuchen</Text>
      <Text style={t.muted}>
        Exportiere deine Umsätze {year} als CSV (z. B. aus George oder Mein ELBA). Die KI sucht Arbeitsmittel, Kurse, Spenden, Arztrechnungen & Co. Der
        Kontoauszug wird nicht gespeichert.
      </Text>
      <Button title={busy ? "Wird durchsucht …" : "CSV-Datei wählen"} variant="secondary" loading={busy} onPress={() => void pick()} />
      {error && <Notice tone="red" text={error} />}
      {hinweis && <Notice icon="ℹ️" text={hinweis} />}
      {findings && findings.length === 0 && <Notice text="Keine absetzbaren Ausgaben gefunden." />}
      {findings && findings.length > 0 && (
        <View style={{ gap: 12 }}>
          {findings.map((f, i) => (
            <View key={f.key} style={{ gap: 4, borderTopWidth: 0.5, borderTopColor: c.hairline, paddingTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Checkbox
                    checked={f.selected}
                    onChange={(v) => setFindings((xs) => xs!.map((x, j) => (j === i ? { ...x, selected: v } : x)))}
                    label={`${f.empfaenger}${f.verwendungszweck ? ` · ${f.verwendungszweck}` : ""}`}
                  />
                </View>
                <Text style={{ color: c.text, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{eur(f.betrag)}</Text>
              </View>
              <Text style={[t.muted, { fontSize: 13 }]}>{[f.datum, f.begruendung].filter(Boolean).join(" · ")}</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Badge text={BANK_KATEGORIEN[f.kategorie]} tone="blue" />
                {f.sicherheit !== "hoch" && <Badge text="unsicher" tone="orange" />}
                {f.beruflicherAnteil !== null && f.beruflicherAnteil < 1 && <Badge text={`${Math.round(f.beruflicherAnteil * 100)} % beruflich`} />}
              </View>
            </View>
          ))}
          <Button title={`${selected.length} Posten übernehmen (${eur(sum)})`} onPress={take} disabled={selected.length === 0} />
          <Button title="Verwerfen" variant="ghost" onPress={() => setFindings(null)} />
          <Text style={[t.muted, { fontSize: 12 }]}>Bitte prüfe jeden Posten: Absetzbar ist nur, was du beruflich nutzt bzw. was die Voraussetzungen erfüllt.</Text>
        </View>
      )}
    </Card>
  );
}
