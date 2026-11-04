import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Badge, Button, Card, Notice, Row, Screen, Section, useTextStyles } from "~/components/ui";
import { api, removeLocalFile, uploadDocument } from "~/lib/api";
import { useCase } from "~/lib/case";
import { pickDocument, type Source } from "~/lib/documents";
import { eur } from "~/lib/format";
import { DOCUMENT_LABELS, mainAmount } from "~/lib/labels";
import { useColors } from "~/lib/theme";
import type { StoredDocument } from "~/lib/types";

interface Upload {
  key: string;
  name: string;
  error?: string;
}

export default function Belege() {
  const c = useColors();
  const t = useTextStyles();
  const { year, reload: reloadCase } = useCase();
  const [docs, setDocs] = useState<StoredDocument[] | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ documents: StoredDocument[]; aiEnabled: boolean }>(`/api/documents?year=${year}`);
      setDocs(r.documents);
      setAiEnabled(r.aiEnabled);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Belege konnten nicht geladen werden.");
    }
  }, [year]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function add(source: Source) {
    setError(null);
    let files;
    try {
      files = await pickDocument(source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auswahl fehlgeschlagen.");
      return;
    }
    let last: StoredDocument | null = null;
    for (const f of files) {
      const key = `${Date.now()}-${f.name}`;
      setUploads((u) => [...u, { key, name: f.name }]);
      try {
        const r = await uploadDocument<{ document: StoredDocument }>(f, year);
        last = r.document;
        setDocs((d) => [r.document, ...(d ?? [])]);
        setUploads((u) => u.filter((x) => x.key !== key));
      } catch (e) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: e instanceof Error ? e.message : "Fehler" } : x)));
      } finally {
        // Lokale Kopie sofort löschen – Belegfotos bleiben nicht auf dem Gerät liegen
        removeLocalFile(f.uri);
      }
    }
    void reloadCase();
    if (files.length === 1 && last) router.push({ pathname: "/beleg/[id]", params: { id: last.id } });
  }

  const pending = docs?.filter((d) => !d.applied).length ?? 0;

  return (
    <Screen webTitle="Belege"
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      refreshing={refreshing}
    >
      {!aiEnabled && <Notice tone="orange" icon="🧪" text="Demo-Modus: Am Server ist kein KI-Schlüssel hinterlegt. Belege liefern Beispielwerte eines Lohnzettels." />}
      {error && <Notice tone="red" text={error} />}

      <Card style={{ alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 40 }}>📄</Text>
        <Text style={t.title2}>Beleg hinzufügen</Text>
        <Text style={[t.muted, { textAlign: "center" }]}>Lohnzettel aus FinanzOnline, Rechnungen, Spendenbestätigungen. Fotos werden nach der Erkennung gelöscht.</Text>
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 10 }}>
          <Button title="📸 Foto aufnehmen" onPress={() => void add("camera")} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title="Aus Fotos" variant="secondary" style={{ flex: 1 }} onPress={() => void add("library")} />
            <Button title="PDF / Datei" variant="secondary" style={{ flex: 1 }} onPress={() => void add("pdf")} />
          </View>
        </View>
      </Card>

      {uploads.length > 0 && (
        <Section title="Wird analysiert">
          {uploads.map((u) => (
            <Row
              key={u.key}
              icon="📄"
              label={u.name}
              sublabel={u.error ?? "Die KI liest den Beleg …"}
              right={u.error ? <Text onPress={() => setUploads((x) => x.filter((y) => y.key !== u.key))} style={{ color: c.muted, fontSize: 17 }}>✕</Text> : <ActivityIndicator color={c.accent} />}
            />
          ))}
        </Section>
      )}

      <Section title={pending > 0 ? `Deine Belege · ${pending} zu prüfen` : "Deine Belege"}>
        {docs === null ? (
          <Row label="Lädt …" />
        ) : docs.length === 0 ? (
          <Row label="Noch keine Belege" sublabel="Starte mit deinem Lohnzettel (L16) – du findest ihn in FinanzOnline unter „Abfragen“." />
        ) : (
          docs.map((d) => {
            const meta = DOCUMENT_LABELS[d.extraction.documentType];
            const amt = mainAmount(d);
            return (
              <Row
                key={d.id}
                icon={meta.icon}
                label={meta.label}
                sublabel={d.extraction.summary || d.fileName}
                value={amt !== null ? eur(amt, 0) : undefined}
                right={<Badge text={d.applied ? "✓" : "Prüfen"} tone={d.applied ? "green" : "orange"} />}
                chevron
                onPress={() => router.push({ pathname: "/beleg/[id]", params: { id: d.id } })}
              />
            );
          })
        )}
      </Section>
    </Screen>
  );
}
