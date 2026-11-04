import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { Badge, Button, ChoiceRow, Loading, MoneyRow, NumberRow, Notice, Screen, Section, TextRow } from "~/components/ui";
import { api } from "~/lib/api";
import { useSensitiveScreen } from "~/lib/appLock";
import { useCase } from "~/lib/case";
import { DOCUMENT_LABELS, LZ_FIELDS, WK_LABELS, type WkKategorie } from "~/lib/labels";
import { useColors } from "~/lib/theme";
import type { DocumentType, Extraction, LohnzettelFields, StoredDocument } from "~/lib/types";

const emptyLz = (): LohnzettelFields => ({
  arbeitgeber: null, istPension: null, kz210: null, kz215: null, kz220: null, kz225: null, kz230: null, kz245: null, kz260: null,
  kz717: null, kz718: null, kz916: null, telearbeitstage: null, telearbeitspauschale: null,
});

const TYPE_OPTIONS = (Object.keys(DOCUMENT_LABELS) as DocumentType[]).map((k) => ({ value: k, label: `${DOCUMENT_LABELS[k].icon}  ${DOCUMENT_LABELS[k].label}` }));
const WK_OPTIONS = (Object.keys(WK_LABELS) as WkKategorie[]).map((k) => ({ value: k, label: WK_LABELS[k] }));

function confirm(title: string, message: string, ok: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve((globalThis as { confirm?: (m: string) => boolean }).confirm?.(message) ?? true);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export default function BelegPruefen() {
  useSensitiveScreen("beleg");
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { year, reload } = useCase();
  const [doc, setDoc] = useState<StoredDocument | null>(null);
  const [ex, setEx] = useState<Extraction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ documents: StoredDocument[] }>(`/api/documents?year=${year}`)
      .then((r) => {
        const d = r.documents.find((x) => x.id === id) ?? null;
        setDoc(d);
        setEx(d?.extraction ?? null);
        if (!d) setError("Beleg nicht gefunden.");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Laden fehlgeschlagen."));
  }, [id, year]);

  if (!doc || !ex) return error ? <Screen><Notice tone="red" text={error} /></Screen> : <Loading />;
  const locked = doc.applied;

  const setType = (type: DocumentType) =>
    setEx((e) =>
      e && {
        ...e,
        documentType: type,
        lohnzettel: type === "lohnzettel" ? (e.lohnzettel ?? emptyLz()) : e.lohnzettel,
        beleg: type !== "lohnzettel" ? (e.beleg ?? { betrag: null, datum: null, beschreibung: "", empfaenger: null, wkKategorie: null, beruflicherAnteil: null }) : e.beleg,
      },
    );
  const setLz = (k: keyof LohnzettelFields, v: number | string | null) => setEx((e) => e && { ...e, lohnzettel: { ...(e.lohnzettel ?? emptyLz()), [k]: v } });
  const setBeleg = (patch: Partial<NonNullable<Extraction["beleg"]>>) => setEx((e) => e && e.beleg ? { ...e, beleg: { ...e.beleg, ...patch } } : e);

  async function save(applied: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api<{ document: StoredDocument }>(`/api/documents/${doc!.id}`, { method: "PATCH", json: { extraction: ex, applied } });
      await reload();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!(await confirm("Beleg löschen?", "Der Beleg und alle daraus übernommenen Werte werden gelöscht.", "Löschen"))) return;
    setBusy(true);
    try {
      await api(`/api/documents/${doc!.id}`, { method: "DELETE" });
      await reload();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
      setBusy(false);
    }
  }

  const lz = ex.lohnzettel;
  const b = ex.beleg;
  const conf = ex.confidence;

  return (
    <Screen>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Badge text={`Erkennung: ${conf}`} tone={conf === "hoch" ? "green" : conf === "mittel" ? "orange" : "red"} />
        {doc.demo && <Badge text="Demo" />}
        {ex.taxYear && <Badge text={`Jahr ${ex.taxYear}`} />}
        {locked && <Badge text="✓ Übernommen" tone="green" />}
      </View>
      {ex.summary ? <Text style={{ color: c.text2, fontSize: 15 }}>{ex.summary}</Text> : null}
      {ex.warnings.map((w, i) => <Notice key={i} tone="orange" icon="⚠️" text={w} />)}
      {error && <Notice tone="red" text={error} />}

      <Section>
        <ChoiceRow label="Belegart" value={ex.documentType} options={TYPE_OPTIONS} onChange={setType} disabled={locked} />
      </Section>

      {ex.documentType === "lohnzettel" && lz && (
        <Section title="Lohnzettel L16" footer="Bitte vergleiche jede Kennzahl mit deinem Lohnzettel.">
          <TextRow label="Arbeitgeber" value={lz.arbeitgeber ?? ""} editable={!locked} onChangeText={(v) => setLz("arbeitgeber", v)} />
          {LZ_FIELDS.map(([k, label, kz]) => (
            <MoneyRow key={k} label={label} sublabel={kz ? `KZ ${kz}` : undefined} value={Number(lz[k] ?? 0)} editable={!locked} onChange={(v) => setLz(k, v)} />
          ))}
          <NumberRow label="Telearbeitstage" value={Number(lz.telearbeitstage ?? 0)} onChange={(v) => setLz("telearbeitstage", v)} suffix="Tage" editable={!locked} />
        </Section>
      )}

      {ex.documentType !== "lohnzettel" && ex.documentType !== "unbekannt" && b && (
        <Section title="Beleg">
          <TextRow label="Beschreibung" value={b.beschreibung} editable={!locked} onChangeText={(v) => setBeleg({ beschreibung: v })} />
          <MoneyRow label="Betrag" value={b.betrag ?? 0} editable={!locked} onChange={(v) => setBeleg({ betrag: v })} />
          {ex.documentType === "werbungskosten" && (
            <>
              <ChoiceRow label="Kategorie" value={b.wkKategorie ?? "sonstige"} options={WK_OPTIONS} onChange={(v) => setBeleg({ wkKategorie: v })} disabled={locked} />
              <NumberRow
                label="Beruflicher Anteil"
                sublabel="z. B. 60 % bei privat mitgenutztem Laptop"
                value={Math.round((b.beruflicherAnteil ?? 1) * 100)}
                max={100}
                editable={!locked}
                suffix="%"
                onChange={(v) => setBeleg({ beruflicherAnteil: v / 100 })}
              />
            </>
          )}
        </Section>
      )}

      {ex.documentType === "unbekannt" && <Notice text="Bitte wähle die passende Belegart, damit der Beleg übernommen werden kann." />}

      <View style={{ gap: 10 }}>
        {locked ? (
          <Button title="Übernahme zurücknehmen" variant="secondary" loading={busy} onPress={() => void save(false)} />
        ) : (
          <Button title="✓ Werte geprüft – übernehmen" loading={busy} disabled={ex.documentType === "unbekannt"} onPress={() => void save(true)} />
        )}
        <Button title="Beleg löschen" variant="danger" disabled={busy} onPress={() => void remove()} />
      </View>
    </Screen>
  );
}
