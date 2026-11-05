import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { Badge, Button, Card, MoneyRow, Notice, NumberRow, Row, Screen, Section, Segmented, SwitchRow, TextRow, useTextStyles } from "~/components/ui";
import { downloadAuthed, removeLocalFile } from "~/lib/api";
import { useCase } from "~/lib/case";
import { eur, uid } from "~/lib/format";
import { radius, useColors } from "~/lib/theme";
import type { TaxCase } from "~/lib/types";
import {
  faelligAm, ibanGueltig, kunden, naechsteNummer, neueRechnung, offenePosten, pflichtangaben, rechnungStatus, rechnungSummen, steuerHinweis,
  type Firma, type Rechnung,
} from "@core/tax/rechnung";

type Betrieb = TaxCase["betriebe"][number];
const de = (iso: string) => (iso ? iso.split("-").reverse().join(".") : "–");
const istDatum = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const STATUS = {
  entwurf: ["Entwurf", "neutral"],
  offen: ["Offen", "blue"],
  ueberfaellig: ["Überfällig", "red"],
  bezahlt: ["Bezahlt", "green"],
  storniert: ["Storniert", "neutral"],
} as const;

/** Bestätigung (nativ Alert, in der Web-Vorschau confirm). */
function bestaetigen(titel: string, text: string, ok: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${titel}\n\n${text}`) ?? true) ok();
    return;
  }
  Alert.alert(titel, text, [{ text: "Abbrechen", style: "cancel" }, { text: titel, style: "destructive", onPress: ok }]);
}

function FirmaSection({ firma, onChange, warnKlein }: { firma: Firma; onChange: (f: Firma) => void; warnKlein: boolean }) {
  const [offen, setOffen] = useState(!firma.name);
  const set = (patch: Partial<Firma>) => onChange({ ...firma, ...patch });
  return (
    <>
      <Section title="Deine Rechnungsdaten" footer={offen ? "Name, Anschrift und Bankverbindung erscheinen auf jeder Rechnung." : undefined}>
        <Row
          label={firma.name || "Rechnungsdaten eintragen"}
          sublabel={firma.name ? [firma.uid, firma.kleinunternehmer ? "Kleinunternehmer:in" : "mit Umsatzsteuer"].filter(Boolean).join(" · ") : "Name, Anschrift, IBAN"}
          value={offen ? "Fertig" : "Bearbeiten"}
          onPress={() => setOffen(!offen)}
        />
        {offen && <TextRow label="Name / Firma" value={firma.name} placeholder="Anna Muster – Grafikdesign" onChangeText={(v) => set({ name: v.slice(0, 200) })} />}
        {offen && <TextRow label="Anschrift" value={firma.adresse} placeholder={"Hauptplatz 1\n4020 Linz"} multiline onChangeText={(v) => set({ adresse: v.slice(0, 400) })} />}
        {offen && <TextRow label="UID-Nummer" value={firma.uid} placeholder="ATU12345678" autoCapitalize="characters" onChangeText={(v) => set({ uid: v.toUpperCase().replace(/\s+/g, "").slice(0, 20) })} />}
        {offen && <TextRow label="IBAN" value={firma.iban} placeholder="AT61 1904 3002 3457 3201" autoCapitalize="characters" onChangeText={(v) => set({ iban: v.toUpperCase().slice(0, 40) })} />}
        {offen && <TextRow label="BIC (optional)" value={firma.bic} autoCapitalize="characters" onChangeText={(v) => set({ bic: v.toUpperCase().slice(0, 15) })} />}
        {offen && <TextRow label="E-Mail" value={firma.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(v) => set({ email: v.slice(0, 200) })} />}
        {offen && <SwitchRow label="Kleinunternehmer:in" sublabel="Rechnungen ohne USt mit Hinweis § 6 Abs. 1 Z 27 UStG" value={firma.kleinunternehmer} onValueChange={(v) => set({ kleinunternehmer: v })} />}
      </Section>
      {firma.iban !== "" && !ibanGueltig(firma.iban) && <Notice tone="red" icon="⚠️" text="Die IBAN ist ungültig (Prüfziffer stimmt nicht)." />}
      {warnKlein && <Notice tone="orange" icon="⚠️" text="Laut Berechnung überschreitest du die Kleinunternehmergrenze – ab dem Überschreiten musst du Umsatzsteuer verrechnen. Prüfe die Einstellung." />}
    </>
  );
}

function Editor({ value, firma, vorschlaege, onSave, onAusstellen, onCancel, onDelete }: {
  value: Rechnung; firma: Firma; vorschlaege: Rechnung["kunde"][];
  onSave: (r: Rechnung) => void; onAusstellen: (r: Rechnung) => void; onCancel: () => void; onDelete?: () => void;
}) {
  const t = useTextStyles();
  const c = useColors();
  const [r, setR] = useState(value);
  const s = rechnungSummen(r, firma);
  const p = pflichtangaben({ ...r, nummer: r.nummer || "vorläufig" }, firma);
  const hinweis = steuerHinweis(r, firma);
  const datumFehler = !istDatum(r.datum) || !istDatum(r.leistungVon) || (r.leistungBis !== "" && !istDatum(r.leistungBis));
  const setPos = (i: number, patch: Partial<Rechnung["positionen"][number]>) => setR({ ...r, positionen: r.positionen.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const passende = vorschlaege.filter((k) => k.name !== r.kunde.name && (!r.kunde.name || k.name.toLowerCase().includes(r.kunde.name.toLowerCase()))).slice(0, 6);
  return (
    <>
      <Section title={value.nummer ? `Rechnung ${value.nummer}` : "Neue Rechnung (Entwurf)"}>
        <TextRow label="Kund:in" value={r.kunde.name} placeholder="Muster GmbH" onChangeText={(v) => setR({ ...r, kunde: { ...r.kunde, name: v.slice(0, 200) } })} />
        {passende.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 }}>
            {passende.map((k) => (
              <Pressable key={k.name} accessibilityRole="button" onPress={() => setR({ ...r, kunde: { ...k } })} style={{ backgroundColor: c.surface2, borderRadius: radius.xl, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: c.text, fontSize: 14 }}>{k.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <TextRow label="Anschrift" value={r.kunde.adresse} multiline placeholder="Ring 2, 1010 Wien" onChangeText={(v) => setR({ ...r, kunde: { ...r.kunde, adresse: v.slice(0, 400) } })} />
        <TextRow label="UID der Kund:in" value={r.kunde.uid} placeholder="nur bei Unternehmen" autoCapitalize="characters" onChangeText={(v) => setR({ ...r, kunde: { ...r.kunde, uid: v.toUpperCase().replace(/\s+/g, "").slice(0, 20) } })} />
      </Section>
      <Section title="Datum" footer={datumFehler ? "Datum im Format JJJJ-MM-TT eingeben." : undefined}>
        <TextRow label="Rechnungsdatum" value={r.datum} placeholder="JJJJ-MM-TT" onChangeText={(v) => setR({ ...r, datum: v.slice(0, 10) })} />
        <TextRow label="Leistung am / ab" value={r.leistungVon} placeholder="JJJJ-MM-TT" onChangeText={(v) => setR({ ...r, leistungVon: v.slice(0, 10) })} />
        <TextRow label="bis (optional)" value={r.leistungBis} placeholder="JJJJ-MM-TT" onChangeText={(v) => setR({ ...r, leistungBis: v.slice(0, 10) })} />
      </Section>
      {r.positionen.map((x, i) => (
        <Section key={i} title={`Leistung ${i + 1}`}>
          <TextRow label="Bezeichnung" value={x.text} placeholder="z. B. Webdesign Startseite" onChangeText={(v) => setPos(i, { text: v.slice(0, 300) })} />
          <NumberRow label="Menge" value={x.menge} max={1_000_000} onChange={(v) => setPos(i, { menge: v })} />
          <TextRow label="Einheit" value={x.einheit} onChangeText={(v) => setPos(i, { einheit: v.slice(0, 20) })} />
          <MoneyRow label="Einzelpreis netto" value={x.preis} onChange={(v) => setPos(i, { preis: v })} />
          {!s.ohneUst && (
            <View style={{ padding: 12, gap: 6 }}>
              <Text style={[t.muted, { fontSize: 13 }]}>Umsatzsteuer</Text>
              <Segmented value={x.ustSatz} onChange={(v) => setPos(i, { ustSatz: v })} options={[{ value: 20, label: "20 %" }, { value: 13, label: "13 %" }, { value: 10, label: "10 %" }, { value: 0, label: "0 %" }]} />
            </View>
          )}
          {r.positionen.length > 1 && <Row label="Position entfernen" destructive onPress={() => setR({ ...r, positionen: r.positionen.filter((_, j) => j !== i) })} />}
        </Section>
      ))}
      {r.positionen.length < 50 && (
        <Button title="+ Position" variant="secondary" onPress={() => setR({ ...r, positionen: [...r.positionen, { text: "", menge: 1, einheit: "Stk.", preis: 0, ustSatz: r.positionen.at(-1)?.ustSatz ?? 20 }] })} />
      )}
      <Section>
        <NumberRow label="Zahlungsziel" value={r.zahlungszielTage} max={365} suffix="Tage" onChange={(v) => setR({ ...r, zahlungszielTage: v })} />
        <SwitchRow label="Reverse Charge" sublabel="Leistung an Unternehmen im EU-Ausland" value={r.reverseCharge} onValueChange={(v) => setR({ ...r, reverseCharge: v })} />
        <TextRow label="Notiz (optional)" value={r.notiz} multiline placeholder="Danke für den Auftrag!" onChangeText={(v) => setR({ ...r, notiz: v.slice(0, 1000) })} />
      </Section>
      <Section title="Summen" footer={hinweis ?? undefined}>
        <Row label="Summe netto" value={eur(s.netto)} />
        {!s.ohneUst && s.saetze.map((x) => <Row key={x.satz} label={`${x.satz} % USt von ${eur(x.netto)}`} value={eur(x.ust)} />)}
        <Row label="Gesamtbetrag" value={eur(s.brutto)} strong />
      </Section>
      {p.fehler.length > 0 && <Notice tone="orange" icon="📋" text={`Für eine gültige Rechnung fehlt noch:\n• ${p.fehler.join("\n• ")}`} />}
      {p.hinweise.length > 0 && <Notice tone="blue" icon="ℹ️" text={p.hinweise.join("\n")} />}
      <Button title="✓ Ausstellen" disabled={p.fehler.length > 0 || s.brutto <= 0 || datumFehler} onPress={() => onAusstellen(r)} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title="Entwurf speichern" variant="secondary" style={{ flex: 1 }} onPress={() => onSave(r)} />
        <Button title="Abbrechen" variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
      </View>
      {onDelete && (
        <Section>
          <Row label="Entwurf löschen" destructive onPress={onDelete} />
        </Section>
      )}
      <Text style={[t.muted, { fontSize: 12 }]}>Beim Ausstellen bekommt die Rechnung die nächste fortlaufende Nummer und kann danach nicht mehr geändert werden – Korrekturen laufen über Storno und neue Rechnung.</Text>
    </>
  );
}

export default function Rechnungen() {
  const t = useTextStyles();
  const c = useColors();
  const router = useRouter();
  const { data, result, update, year, saveState } = useCase();
  const [idx, setIdx] = useState(0);
  const [edit, setEdit] = useState<Rechnung | null>(null);
  const [zahlung, setZahlung] = useState<{ id: string; datum: string } | null>(null);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!data || !result) return <Screen webTitle="Rechnungen"><Text style={t.muted}>Lädt …</Text></Screen>;
  const i = Math.min(idx, Math.max(0, data.betriebe.length - 1));
  const b = data.betriebe[i];
  if (!b)
    return (
      <Screen webTitle="Rechnungen">
        <Notice tone="blue" icon="💼" text="Lege zuerst unter „Über dich“ → Weitere Einkünfte deine selbständige Tätigkeit an." />
        <Button title="Zu „Über dich“" variant="secondary" onPress={() => router.push("/profil")} />
      </Screen>
    );

  const heute = new Date().toISOString().slice(0, 10);
  // Vorgabe für neue Rechnungen: heute, außer man arbeitet in einem anderen Steuerjahr
  const standardDatum = new Date().getFullYear() === year ? heute : `${year}-12-31`;
  const setB = (fn: (x: Betrieb) => void) => update((d) => fn(d.betriebe[i]!));
  const speichern = (r: Rechnung) =>
    setB((x) => {
      const j = x.rechnungen.findIndex((y) => y.id === r.id);
      if (j >= 0) x.rechnungen[j] = r;
      else x.rechnungen.push(r);
    });
  const ausstellen = (r: Rechnung) => {
    const fertig = { ...r, nummer: naechsteNummer(b.rechnungen.filter((y) => y.ausgestelltAm), Number(r.datum.slice(0, 4)) || year), ausgestelltAm: heute };
    speichern(fertig);
    setEdit(null);
    setMsg(`Rechnung ${fertig.nummer} ausgestellt`);
  };
  const liste = [...b.rechnungen].sort((x, y) => (y.nummer || "~").localeCompare(x.nummer || "~") || y.datum.localeCompare(x.datum));
  const op = offenePosten(b);
  const ueber = op.filter((o) => o.ueberfaellig);
  const bezahltJahr = b.rechnungen.filter((r) => rechnungStatus(r) === "bezahlt" && r.bezahltAm.startsWith(`${year}-`)).reduce((s, r) => s + rechnungSummen(r, b.firma).brutto, 0);
  const warnKlein = b.firma.kleinunternehmer && !!result.umsatzsteuer && !result.umsatzsteuer.kleinunternehmer;

  async function pdf(r: Rechnung) {
    setErr(null);
    setBusy(r.id);
    try {
      const name = `Rechnung-${r.nummer.replace(/[^\w-]+/g, "_")}${r.storniert ? "-STORNO" : ""}.pdf`;
      const uri = await downloadAuthed(`/api/rechnungen/pdf?year=${year}&betrieb=${encodeURIComponent(b!.id)}&id=${encodeURIComponent(r.id)}`, name, "application/pdf");
      if (uri) {
        if (!(await Sharing.isAvailableAsync())) throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: name });
        removeLocalFile(uri);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Das PDF konnte nicht erzeugt werden.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen webTitle="Rechnungen">
      <Text style={t.muted}>Rechnungen mit allen Pflichtangaben schreiben, als PDF verschicken – bezahlte Rechnungen landen automatisch im Journal.</Text>
      {data.betriebe.length > 1 && (
        <Segmented value={b.id} onChange={(id) => { setIdx(Math.max(0, data.betriebe.findIndex((x) => x.id === id))); setEdit(null); }} options={data.betriebe.map((x, j) => ({ value: x.id, label: x.bezeichnung || `Betrieb ${j + 1}` }))} />
      )}
      <FirmaSection firma={b.firma} warnKlein={warnKlein} onChange={(f) => setB((x) => void (x.firma = f))} />

      <Section title={`Überblick ${year}`}>
        <Row label="Offen" sublabel={`${op.length} Rechnung(en)`} value={eur(op.reduce((s, o) => s + o.brutto, 0))} />
        <Row label="Überfällig" sublabel={`${ueber.length} Rechnung(en)`} value={eur(ueber.reduce((s, o) => s + o.brutto, 0))} valueColor={ueber.length ? c.red : undefined} />
        <Row label={`Bezahlt ${year}`} sublabel="im Journal gebucht" value={eur(bezahltJahr)} />
      </Section>

      {err && <Notice tone="red" icon="⚠️" text={err} />}
      {msg && !edit && <Notice tone="green" icon="✓" text={msg} />}

      {edit ? (
        <Editor
          key={edit.id}
          value={edit}
          firma={b.firma}
          vorschlaege={kunden(b.rechnungen)}
          onSave={(r) => { speichern(r); setEdit(null); setMsg("Entwurf gespeichert"); }}
          onAusstellen={ausstellen}
          onCancel={() => setEdit(null)}
          onDelete={b.rechnungen.some((y) => y.id === edit.id) ? () => { setB((x) => void (x.rechnungen = x.rechnungen.filter((y) => y.id !== edit.id))); setEdit(null); } : undefined}
        />
      ) : (
        <Button title="+ Neue Rechnung" onPress={() => { setMsg(null); setEdit(neueRechnung(uid(), new Date(`${standardDatum}T12:00:00Z`))); }} />
      )}

      {!edit && (
        <Section title="Alle Rechnungen" footer="Einnahmen zählen im Jahr der Zahlung (Zufluss-Abfluss-Prinzip). Rechnungen 7 Jahre aufbewahren (§ 132 BAO) – das PDF kannst du jederzeit neu erzeugen.">
          {liste.length === 0 && <Row label="Noch keine Rechnungen" />}
          {liste.map((r) => {
            const st = rechnungStatus(r);
            const s = rechnungSummen(r, b.firma);
            const sub = `${de(r.datum)}${st === "offen" || st === "ueberfaellig" ? ` · fällig ${de(faelligAm(r))}` : st === "bezahlt" ? ` · bezahlt ${de(r.bezahltAm)}` : ""}`;
            const offenHier = aktiv === r.id;
            return (
              <View key={r.id}>
                <Row
                  label={`${r.nummer || "Entwurf"} · ${r.kunde.name || "ohne Kund:in"}`}
                  sublabel={sub}
                  value={eur(s.brutto)}
                  right={<Badge text={STATUS[st][0]} tone={STATUS[st][1]} />}
                  chevron
                  onPress={() => (st === "entwurf" ? (setMsg(null), setEdit(r)) : setAktiv(offenHier ? null : r.id))}
                />
                {offenHier && st !== "entwurf" && (
                  <Card style={{ gap: 8, marginHorizontal: 12, marginBottom: 12 }}>
                    <Button
                      title={saveState === "saving" ? "Speichert …" : busy === r.id ? "PDF wird erstellt …" : "📄 PDF teilen"}
                      variant="secondary"
                      loading={busy === r.id}
                      disabled={saveState === "saving" || busy !== null}
                      onPress={() => void pdf(r)}
                    />
                    {(st === "offen" || st === "ueberfaellig") &&
                      (zahlung?.id === r.id ? (
                        <>
                          <TextRow label="Zahlungseingang am" value={zahlung.datum} placeholder="JJJJ-MM-TT" onChangeText={(v) => setZahlung({ id: r.id, datum: v.slice(0, 10) })} />
                          <View style={{ flexDirection: "row", gap: 10 }}>
                            <Button
                              title="Übernehmen"
                              style={{ flex: 1 }}
                              disabled={!istDatum(zahlung.datum)}
                              onPress={() => {
                                const datum = zahlung.datum;
                                setB((x) => void (x.rechnungen.find((y) => y.id === r.id)!.bezahltAm = datum));
                                setZahlung(null);
                                setMsg(datum.startsWith(`${year}-`) ? "Bezahlt – als Erlös im Journal gebucht" : `Bezahlt – die Zahlung zählt für ${datum.slice(0, 4)}, trag sie dort im Journal ein`);
                              }}
                            />
                            <Button title="Abbrechen" variant="secondary" style={{ flex: 1 }} onPress={() => setZahlung(null)} />
                          </View>
                        </>
                      ) : (
                        <Button title="✓ Als bezahlt markieren" variant="secondary" onPress={() => setZahlung({ id: r.id, datum: heute.startsWith(`${year}-`) ? heute : standardDatum })} />
                      ))}
                    {st === "bezahlt" && <Button title="Zahlung zurücknehmen" variant="ghost" onPress={() => setB((x) => void (x.rechnungen.find((y) => y.id === r.id)!.bezahltAm = ""))} />}
                    <Button
                      title="Kopieren"
                      variant="ghost"
                      onPress={() => { setAktiv(null); setMsg(null); setEdit({ ...r, id: uid(), nummer: "", ausgestelltAm: "", bezahltAm: "", storniert: false, datum: standardDatum }); }}
                    />
                    {st !== "storniert" && (
                      <Button
                        title="Stornieren"
                        variant="danger"
                        onPress={() => bestaetigen("Stornieren", `Rechnung ${r.nummer} stornieren?`, () => setB((x) => void (x.rechnungen.find((y) => y.id === r.id)!.storniert = true)))}
                      />
                    )}
                  </Card>
                )}
              </View>
            );
          })}
        </Section>
      )}
      <Button title="📒 Zum Journal" variant="secondary" onPress={() => router.push("/mehr/buchhaltung")} />
    </Screen>
  );
}
