import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, ChoiceRow, MoneyRow, Notice, NumberRow, Row, Screen, Section, Segmented, TextRow, useTextStyles } from "~/components/ui";
import { downloadAuthed, removeLocalFile, uploadForm } from "~/lib/api";
import { useCase } from "~/lib/case";
import { pickDocument, type Source } from "~/lib/documents";
import { eur, uid } from "~/lib/format";
import { useColors } from "~/lib/theme";
import { alleBuchungen, E1A_KATEGORIEN, E1A_KEYS, journalSummen, type Buchung, type E1aKategorie } from "@core/tax/journal";
import type { BuchungScan } from "@core/ai/buchung";

const MONATE = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const datumDe = (iso: string) => iso.split("-").reverse().join(".");

function Editor({ value, year, onSave, onCancel, onDelete }: { value: Buchung; year: number; onSave: (b: Buchung) => void; onCancel: () => void; onDelete?: () => void }) {
  const [b, setB] = useState(value);
  const k = E1A_KATEGORIEN[b.kategorie];
  const datumOk = /^\d{4}-\d{2}-\d{2}$/.test(b.datum) && b.datum.startsWith(`${year}-`);
  return (
    <>
      <Section
        title={value.netto ? "Buchung bearbeiten" : "Neue Buchung"}
        footer={
          !datumOk
            ? `Datum im Format JJJJ-MM-TT im Jahr ${year} – es zählt der Tag der Zahlung (Zufluss-Abfluss-Prinzip).`
            : "anteil" in k
              ? "Geschäftsessen sind nur zur Hälfte absetzbar (§ 20 Abs. 1 Z 3 EStG). Notiere Anlass und Gäste."
              : undefined
        }
      >
        <TextRow label="Datum" value={b.datum} placeholder="JJJJ-MM-TT" onChangeText={(v) => setB({ ...b, datum: v.slice(0, 10) })} />
        <ChoiceRow
          label="Kategorie"
          value={b.kategorie}
          options={E1A_KEYS.map((x) => ({ value: x, label: `${E1A_KATEGORIEN[x].art === "einnahme" ? "＋ " : "− "}${E1A_KATEGORIEN[x].label}` }))}
          onChange={(v: E1aKategorie) => setB({ ...b, kategorie: v })}
        />
        <TextRow label="Beschreibung" value={b.beschreibung} placeholder={k.art === "einnahme" ? "z. B. Honorarnote 2025-014" : "z. B. Druckerpatronen"} onChangeText={(v) => setB({ ...b, beschreibung: v.slice(0, 200) })} />
        <MoneyRow label="Netto" value={b.netto} onChange={(v) => setB({ ...b, netto: v })} />
        <MoneyRow label={k.art === "einnahme" ? "Umsatzsteuer" : "Vorsteuer"} value={b.ust} onChange={(v) => setB({ ...b, ust: v })} />
        {k.art === "ausgabe" && <NumberRow label="Privatanteil" value={b.privatanteil} max={100} suffix="%" onChange={(v) => setB({ ...b, privatanteil: v })} />}
        <Row label="Brutto" value={eur(b.netto + b.ust)} />
      </Section>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title="Speichern" style={{ flex: 1 }} disabled={!datumOk || b.netto <= 0} onPress={() => onSave(b)} />
        <Button title="Abbrechen" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
      </View>
      {onDelete && (
        <Section>
          <Row label="Buchung löschen" destructive onPress={onDelete} />
        </Section>
      )}
    </>
  );
}

export default function Buchhaltung() {
  const t = useTextStyles();
  const c = useColors();
  const router = useRouter();
  const { data, update, year } = useCase();
  const [idx, setIdx] = useState(0);
  const [edit, setEdit] = useState<Buchung | null>(null);
  const [busy, setBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  if (!data) return <Screen webTitle="Buchhaltung"><Text style={t.muted}>Lädt …</Text></Screen>;
  const betriebe = data.betriebe;
  const i = Math.min(idx, Math.max(0, betriebe.length - 1));
  const betrieb = betriebe[i];

  if (!betrieb)
    return (
      <Screen webTitle="Buchhaltung">
        <Notice tone="blue" icon="💼" text="Lege zuerst unter „Über dich“ → Weitere Einkünfte deine selbständige Tätigkeit an." />
        <Button title="Zu „Über dich“" variant="secondary" onPress={() => router.push("/profil")} />
      </Screen>
    );

  const alle = alleBuchungen(betrieb);
  const s = journalSummen(alle, year);
  const buchungen = alle.filter((b) => b.datum.startsWith(`${year}-`)).sort((a, b) => b.datum.localeCompare(a.datum));
  const now = new Date();
  const leer = (): Buchung => ({
    id: uid(),
    datum: `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    kategorie: "sonstige",
    beschreibung: "",
    netto: 0,
    ust: 0,
    privatanteil: 0,
  });

  const save = (b: Buchung) => {
    update((d) => {
      const list = d.betriebe[i]!.buchungen;
      const j = list.findIndex((x) => x.id === b.id);
      if (j >= 0) list[j] = b;
      else list.push(b);
    });
    setEdit(null);
    setHinweise([]);
    setMsg("✓ Gebucht");
  };
  const remove = (id: string) => {
    update((d) => void (d.betriebe[i]!.buchungen = d.betriebe[i]!.buchungen.filter((x) => x.id !== id)));
    setEdit(null);
  };

  async function scan(source: Source) {
    setErr(null);
    setMsg(null);
    setHinweise([]);
    const files = await pickDocument(source);
    const f = files[0];
    for (const extra of files.slice(1)) removeLocalFile(extra.uri);
    if (!f) return;
    setBusy(true);
    try {
      const { buchung: v } = await uploadForm<{ buchung: BuchungScan }>("/api/buchhaltung/scan", f, { year: String(year) });
      const base = leer();
      setEdit({
        ...base,
        datum: v.datum && v.datum.startsWith(`${year}-`) ? v.datum : base.datum,
        kategorie: v.kategorie,
        beschreibung: [v.beschreibung, v.partner].filter(Boolean).join(" · ").slice(0, 200),
        netto: v.netto ?? 0,
        ust: v.ust ?? 0,
        privatanteil: v.privatanteilVorschlag ?? 0,
      });
      setHinweise([...(v.datum && !v.datum.startsWith(`${year}-`) ? [`Der Beleg ist vom ${datumDe(v.datum)} – gebucht wird nach dem Zahlungsdatum im Jahr ${year}.`] : []), ...v.hinweise]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      removeLocalFile(f.uri);
      setBusy(false);
    }
  }

  async function exportCsv() {
    setCsvBusy(true);
    setErr(null);
    try {
      const name = `Journal-${year}.csv`;
      const uri = await downloadAuthed(`/api/buchhaltung/csv?year=${year}&betrieb=${encodeURIComponent(betrieb!.id)}`, name, "text/csv");
      if (uri) {
        if (!(await Sharing.isAvailableAsync())) throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
        await Sharing.shareAsync(uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text", dialogTitle: name });
        removeLocalFile(uri);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setCsvBusy(false);
    }
  }

  const monate = new Map<number, Buchung[]>();
  for (const b of buchungen) {
    const m = Number(b.datum.slice(5, 7));
    monate.set(m, [...(monate.get(m) ?? []), b]);
  }
  const ueberschuss = s.einnahmen - s.ausgaben - s.svs;
  const ustSaldo = Math.round((s.ustEinnahmen - s.vorsteuer) * 100) / 100;

  return (
    <Screen webTitle="Buchhaltung">
      <Text style={t.muted}>Einnahmen-Ausgaben-Journal: Rechnung fotografieren, prüfen, fertig. Am Jahresende stehen Gewinn und Umsatzsteuer automatisch fest.</Text>
      {betriebe.length > 1 && (
        <Segmented value={betrieb.id} onChange={(id) => setIdx(Math.max(0, betriebe.findIndex((b) => b.id === id)))} options={betriebe.map((b, j) => ({ value: b.id, label: b.bezeichnung || `Betrieb ${j + 1}` }))} />
      )}
      {betrieb.gewinnermittlung !== "ear" && (
        <Notice tone="orange" icon="ℹ️" text="Bei Pauschalierung zählen nur die Einnahmen aus dem Journal – die Ausgaben sind in der Pauschale enthalten." />
      )}

      <Section title={`Überblick ${year}`}>
        <Row label="Einnahmen (netto)" value={eur(s.einnahmen, 0)} valueColor={c.green} />
        <Row label="Ausgaben inkl. SVS" value={eur(s.ausgaben + s.svs, 0)} />
        <Row label="Überschuss vor AfA und Freibeträgen" value={eur(ueberschuss, 0)} strong valueColor={ueberschuss < 0 ? c.red : undefined} />
      </Section>

      {!edit && (
        <Card style={{ gap: 10 }}>
          <Button title={busy ? "KI liest …" : "📸 Beleg fotografieren"} loading={busy} disabled={busy} onPress={() => void scan("camera")} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title="Aus Fotos" variant="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => void scan("library")} />
            <Button title="PDF / Datei" variant="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => void scan("pdf")} />
          </View>
          <Button title="+ Manuell buchen" variant="secondary" onPress={() => { setHinweise([]); setMsg(null); setEdit(leer()); }} />
          <Button title="🧾 Rechnung schreiben" variant="secondary" onPress={() => router.push("/mehr/rechnungen")} />
          {buchungen.length > 0 && <Button title={csvBusy ? "Exportiert …" : "⬇︎ CSV-Export"} variant="secondary" loading={csvBusy} disabled={csvBusy} onPress={() => void exportCsv()} />}
          <Text style={[t.muted, { fontSize: 12 }]}>
            Sobald du buchst, ersetzen die Buchungen die von Hand eingetragenen Summen (Einnahmen, Ausgaben, Vorsteuer, SVS). Belege 7 Jahre aufbewahren (§ 132 BAO) – Steuerklar speichert keine Bilder.
          </Text>
        </Card>
      )}
      {err && <Notice tone="red" icon="⚠️" text={err} />}
      {msg && !edit && <Notice tone="green" icon="✓" text={msg.replace(/^✓ /, "")} />}
      {hinweise.length > 0 && <Notice tone="orange" icon="💡" text={hinweise.join("\n")} />}
      {edit && (
        <Editor
          key={edit.id}
          value={edit}
          year={year}
          onSave={save}
          onCancel={() => { setEdit(null); setHinweise([]); }}
          onDelete={betrieb.buchungen.some((x) => x.id === edit.id) ? () => remove(edit.id) : undefined}
        />
      )}

      {s.kategorien.length > 0 && (
        <Section title="Nach Kategorien (Beilage E1a)" footer={s.hinweise.join(" ") || undefined}>
          {s.kategorien.map((k) => (
            <Row
              key={k.key}
              label={k.label}
              sublabel={`${k.anzahl} Buchung(en)${k.kz ? ` · KZ ${k.kz}` : " · Kennzahl laut Formular E1a"}`}
              value={`${k.art === "einnahme" ? "+" : "−"}${eur(k.betrag)}`}
              valueColor={k.art === "einnahme" ? c.green : undefined}
            />
          ))}
          <Row label="Umsatzsteuer abzüglich Vorsteuer" sublabel="nur ohne Kleinunternehmerbefreiung" value={eur(ustSaldo)} strong />
        </Section>
      )}

      {buchungen.length === 0 && <Text style={t.muted}>Noch keine Buchungen. Fotografiere deine erste Rechnung – die KI schlägt Kategorie, Netto und Vorsteuer vor.</Text>}
      {[...monate.entries()].map(([m, list]) => (
        <Section key={m} title={`${MONATE[m - 1]} ${year}`}>
          {list.map((b) => {
            const k = E1A_KATEGORIEN[b.kategorie];
            return (
              <Row
                key={b.id}
                label={b.beschreibung || k.label}
                sublabel={`${datumDe(b.datum).slice(0, 6)} · ${k.label}${b.privatanteil ? ` · ${b.privatanteil} % privat` : ""}${b.id.startsWith("re-") ? " · aus Rechnung" : ""}`}
                value={`${k.art === "einnahme" ? "+" : "−"}${eur(b.netto + b.ust)}`}
                valueColor={k.art === "einnahme" ? c.green : undefined}
                chevron
                onPress={() => (b.id.startsWith("re-") ? router.push("/mehr/rechnungen") : (setHinweise([]), setMsg(null), setEdit(b)))}
              />
            );
          })}
        </Section>
      ))}
    </Screen>
  );
}
