import { useState } from "react";
import { Text } from "react-native";
import * as Sharing from "expo-sharing";
import { Card, Notice, Row, Section, useTextStyles } from "~/components/ui";
import { downloadAuthed, removeLocalFile } from "~/lib/api";
import { eur } from "~/lib/format";
import { useColors } from "~/lib/theme";
import type { TaxCase, TaxResult } from "~/lib/types";
import { planung, termine, type Termin } from "@core/tax/planer";

const ART_ICON: Record<Termin["art"], string> = { erklaerung: "📝", zahlung: "💶", uva: "🧾", svs: "🩺", frist: "⏳" };
const fmt = (iso: string) => iso.split("-").reverse().join(".");

/** Nächste Steuertermine mit Export aller Termine als Kalenderdatei. */
export function NaechsteTermine({ data, result, limit = 6 }: { data: TaxCase; result: TaxResult; limit?: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = termine(data, result);
  if (!list.length) return null;

  async function exportIcs() {
    setBusy(true);
    setError(null);
    try {
      const uri = await downloadAuthed(`/api/calendar?year=${data.year}&alle=1`, `Steuertermine-${data.year}.ics`, "text/calendar");
      if (uri) {
        if (!(await Sharing.isAvailableAsync())) throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
        await Sharing.shareAsync(uri, { mimeType: "text/calendar", UTI: "com.apple.ical.ics", dialogTitle: "Steuertermine" });
        removeLocalFile(uri);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Section
        title="Nächste Termine"
        footer={list.length > limit ? `+ ${list.length - limit} weitere Termine in den nächsten 12 Monaten` : undefined}
      >
        {list.slice(0, limit).map((t) => (
          <Row key={t.datum + t.titel} icon={ART_ICON[t.art]} label={t.titel} sublabel={fmt(t.datum)} value={t.betrag ? eur(t.betrag, 0) : undefined} />
        ))}
        <Row label={busy ? "Wird erstellt …" : "📅 Alle in den Kalender"} onPress={busy ? undefined : () => void exportIcs()} chevron />
      </Section>
      {error && <Notice tone="red" text={error} />}
    </>
  );
}

/** Rücklagen-Planer für Selbständige und Vermieter:innen. */
export function RuecklagenPlaner({ data, result }: { data: TaxCase; result: TaxResult }) {
  const c = useColors();
  const t = useTextStyles();
  if (!data.betriebe.length && !data.mietobjekte.length) return null;
  const p = planung(data, result);
  if (p.ruecklageMonat <= 0 && !p.svs) return null;
  return (
    <>
      <Card style={{ alignItems: "center", gap: 4, paddingVertical: 22 }}>
        <Text style={t.muted}>💰 Rücklage pro Monat</Text>
        <Text style={[t.big, { color: c.text }]}>{eur(p.ruecklageMonat, 0)}</Text>
        <Text style={[t.muted, { textAlign: "center", fontSize: 13 }]}>Damit Nachzahlungen und Vorauszahlungen dich nicht überraschen.</Text>
      </Card>
      <Section
        title="Rücklagen-Planer"
        footer="Schätzung auf Basis des gewählten Jahres. Vorauszahlungen kannst du bei sinkendem Gewinn bis 30.9. herabsetzen lassen (§ 45 Abs. 4 EStG)."
      >
        {p.estAufNebeneinkuenfte > 0 && (
          <Row
            label="Einkommensteuer auf Gewinn und Vermietung"
            sublabel={`Vorauszahlungen ca. ${eur(p.vorauszahlungQuartal, 0)} pro Quartal (15.2., 15.5., 15.8., 15.11.)`}
            value={eur(p.estAufNebeneinkuenfte, 0)}
          />
        )}
        {p.svs && (
          <Row
            label="SVS-Beiträge"
            sublabel={`Beitragsgrundlage ${eur(p.svs.beitragsgrundlage, 0)}${p.svs.mindest ? " (Mindest)" : p.svs.hoechst ? " (Höchst)" : ""} · ${eur(p.svs.quartal, 0)} pro Quartal`}
            value={eur(p.svs.summe, 0)}
          />
        )}
        {p.uva && (
          <Row
            label={`Umsatzsteuer-Zahllast (${p.uva.zeitraum})`}
            sublabel={p.uva.abgabepflicht ? "UVA-Abgabe verpflichtend · fällig am 15. des zweitfolgenden Monats" : "Keine UVA-Abgabe, aber Zahlung · 15. des zweitfolgenden Monats"}
            value={eur(p.uva.zahllastJeZeitraum, 0)}
          />
        )}
      </Section>
    </>
  );
}

