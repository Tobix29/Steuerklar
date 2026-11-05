import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Button, Card, Loading, MoneyRow, Notice, NumberRow, Row, Screen, Section, Segmented, useTextStyles } from "~/components/ui";
import { api } from "~/lib/api";
import { useCase } from "~/lib/case";
import { eur } from "~/lib/format";
import { radius, useColors } from "~/lib/theme";
import { SUPPORTED_YEARS, type TaxCase } from "~/lib/types";
import { alsAntwort, beantworten, fragen, mitErsparnis, type FrageMitWert } from "@core/agent/fragen";

const GRUPPE: Record<FrageMitWert["gruppe"], string> = { vollstaendig: "Vollständigkeit", vorjahr: "Aus dem Vorjahr", arbeit: "Arbeit", familie: "Familie", privat: "Privat", einkuenfte: "Weitere Einkünfte" };
/** Web-Pfade der gemeinsamen Fragen → Routen der App */
const ROUTE: Record<string, string> = { "/app/belege": "/belege", "/app/profil": "/profil", "/app/buchhaltung": "/mehr/buchhaltung", "/app/abgabe": "/mehr/abgabe", "/app/finanzamt": "/mehr/finanzamt" };
const BEREICH: Record<string, string> = { profil: "/profil", belege: "/belege", buchhaltung: "/mehr/buchhaltung", finanzamt: "/mehr/finanzamt" };
const go = (href: string) => router.navigate((ROUTE[href] ?? href) as never);

interface Idee { titel: string; text: string; geschaetzt: number | null; bereich: string }

function Karte({ f, onAntwort, onNein, onSpaeter }: { f: FrageMitWert; onAntwort: (w: number | boolean | string) => void; onNein: () => void; onSpaeter: () => void }) {
  const t = useTextStyles();
  const c = useColors();
  const [wert, setWert] = useState(0);
  const e = f.eingabe;
  const [wahl, setWahl] = useState(e.typ === "auswahl" ? e.optionen[0]!.wert : "");
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Text style={t.eyebrow}>{GRUPPE[f.gruppe]}</Text>
        {f.ersparnis >= 5 && <Badge tone="green" text={`bringt dir ca. ${eur(f.ersparnis, 0)}`} />}
      </View>
      <Text style={[t.title2, { fontSize: 24 }]} accessibilityRole="header">{f.titel}</Text>
      <Text style={t.muted}>{f.text}</Text>
      {f.hilfe && <Text style={[t.body, { fontSize: 15 }]}>📅 {f.hilfe}</Text>}
      {(e.typ === "betrag" || e.typ === "zahl") && (
        <View style={{ borderRadius: radius.md, overflow: "hidden", backgroundColor: c.bg }}>
          {e.typ === "betrag" ? <MoneyRow label={e.label} value={wert} onChange={setWert} /> : <NumberRow label={e.label} value={wert} max={e.max} suffix={e.einheit} onChange={setWert} />}
        </View>
      )}
      {e.typ === "auswahl" && <Segmented value={wahl} options={e.optionen.map((o) => ({ value: o.wert, label: o.label }))} onChange={setWahl} />}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {e.typ === "janein" && (
          <>
            <Button title={e.ja ?? "Ja"} onPress={() => onAntwort(true)} />
            <Button title={e.nein ?? "Nein"} variant="secondary" onPress={() => onAntwort(false)} />
          </>
        )}
        {(e.typ === "betrag" || e.typ === "zahl") && (
          <>
            <Button title="Übernehmen" disabled={wert <= 0} onPress={() => onAntwort(wert)} />
            <Button title="Nein / trifft nicht zu" variant="secondary" onPress={onNein} />
          </>
        )}
        {e.typ === "auswahl" && <Button title="Übernehmen" onPress={() => onAntwort(wahl)} />}
        {e.typ === "info" && <Button title={e.aktion} onPress={() => onAntwort(true)} />}
        <Button title="Später" variant="ghost" onPress={onSpaeter} />
      </View>
    </Card>
  );
}

export default function SteuerCheck() {
  const t = useTextStyles();
  const c = useColors();
  const { data, result, year, update } = useCase();
  const [vorjahr, setVorjahr] = useState<TaxCase | null>(null);
  const [offeneBelege, setOffeneBelege] = useState(0);
  const [spaeter, setSpaeter] = useState<string[]>([]);
  const [ideen, setIdeen] = useState<Idee[] | null>(null);
  const [ideenBusy, setIdeenBusy] = useState(false);
  const [ideenErr, setIdeenErr] = useState<string | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const vj = year - 1;
    setVorjahr(null);
    if ((SUPPORTED_YEARS as readonly number[]).includes(vj))
      api<{ case: TaxCase }>(`/api/case?year=${vj}`).then((r) => setVorjahr(r.case.lohnzettel.length || r.case.betriebe.length || r.case.mietobjekte.length ? r.case : null), () => setVorjahr(null));
    api<{ documents: { applied: boolean }[] }>(`/api/documents?year=${year}`).then((r) => setOffeneBelege(r.documents.filter((d) => !d.applied).length), () => {});
    setSpaeter([]);
    setIdeen(null);
    start.current = null;
  }, [year]);

  const liste = useMemo(() => (data && result ? mitErsparnis(data, result, fragen(data, result, { vorjahr, offeneBelege })) : []), [data, result, vorjahr, offeneBelege]);
  if (!data || !result) return <Loading />;
  start.current ??= result.erstattung;

  const offen = liste.filter((f) => !spaeter.includes(f.id));
  const naechste = offen[0] ?? null;
  const erledigt = data.agent.erledigt.length;
  const gesamt = erledigt + liste.length;
  const plus = Math.round((result.erstattung - (start.current ?? result.erstattung)) * 100) / 100;

  const antworten = (f: FrageMitWert, wert: number | boolean | string | null) => {
    update((d) => void Object.assign(d, beantworten(d, f, wert === null ? null : alsAntwort(f, wert))));
    if (f.link && (f.eingabe.typ === "info" || (f.link.beiJa && wert === true))) go(f.link.href);
  };

  async function ladeIdeen() {
    setIdeenBusy(true);
    setIdeenErr(null);
    try {
      setIdeen((await api<{ ideen: Idee[] }>("/api/agent/ideen", { method: "POST", json: { year } })).ideen);
    } catch (e) {
      setIdeenErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setIdeenBusy(false);
    }
  }

  return (
    <Screen webTitle="Steuer-Check">
      <Text style={t.muted}>Ein paar gezielte Fragen – Steuerklar rechnet bei jeder Antwort sofort mit{vorjahr ? ` und vergleicht mit ${vorjahr.year}` : ""}.</Text>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <Text style={t.muted}>{erledigt} von {gesamt} erledigt</Text>
          <Text style={t.body} accessibilityLabel="Aktuelle Gutschrift">
            {result.erstattung >= 0 ? "Gutschrift " : "Nachzahlung "}
            <Text style={{ fontWeight: "700" }}>{eur(Math.abs(result.erstattung))}</Text>
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: "hidden" }}>
          <View style={{ height: 6, width: `${gesamt ? (erledigt / gesamt) * 100 : 100}%`, backgroundColor: c.accent }} />
        </View>
        {plus !== 0 && <Badge tone="green" text={`${plus > 0 ? "+" : ""}${eur(plus)} durch den Check`} />}
      </Card>

      {naechste ? (
        <Karte key={naechste.id} f={naechste} onAntwort={(w) => antworten(naechste, w)} onNein={() => antworten(naechste, null)} onSpaeter={() => setSpaeter((s) => [...s, naechste.id])} />
      ) : (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
          <Text style={{ fontSize: 44 }}>🎉</Text>
          <Text style={[t.title2, { textAlign: "center" }]}>Fertig – deine Erklärung {year} ist bereit</Text>
          <Text style={[t.muted, { textAlign: "center" }]}>
            {result.erstattung >= 0 ? `Voraussichtliche Gutschrift: ${eur(result.erstattung)}` : `Voraussichtliche Nachzahlung: ${eur(-result.erstattung)}`}
            {plus > 0 ? ` – davon ${eur(plus)} durch den Steuer-Check.` : "."}
          </Text>
          <Button
            title="📤 Freigeben & abgeben lassen"
            onPress={() => {
              update((d) => void (d.agent.abgeschlossenAt = Date.now()));
              router.navigate("/mehr/abgabe" as never);
            }}
          />
          <Button title="Details ansehen" variant="secondary" onPress={() => router.navigate("/ergebnis")} />
          {spaeter.length > 0 && <Button title={`${spaeter.length} zurückgestellte Frage(n) ansehen`} variant="ghost" onPress={() => setSpaeter([])} />}
        </Card>
      )}

      {offen.length > 1 && (
        <Section title="Danach">
          {offen.slice(1, 8).map((f) => (
            <Row
              key={f.id}
              label={f.titel}
              sublabel={GRUPPE[f.gruppe]}
              value={f.ersparnis >= 5 ? `ca. ${eur(f.ersparnis, 0)}` : undefined}
              chevron
              onPress={() => setSpaeter((s) => [...s.filter((x) => x !== f.id), ...offen.slice(0, offen.indexOf(f)).map((x) => x.id)])}
            />
          ))}
        </Section>
      )}

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={[t.title2, { fontSize: 18 }]}>✨ Was übersehe ich noch?</Text>
          <Button title={ideen ? "Neu fragen" : "KI fragen"} variant="secondary" loading={ideenBusy} onPress={ladeIdeen} />
        </View>
        <Text style={[t.muted, { fontSize: 13 }]}>Die KI sieht sich deinen ganzen Fall an und sucht Abzüge und Optionen über die Standardfragen hinaus. Es wird nichts automatisch geändert.</Text>
        {ideenErr && <Notice tone="red" icon="⚠️" text={ideenErr} />}
        {ideen && ideen.length === 0 && <Text style={t.body}>✓ Die KI hat nichts Weiteres gefunden.</Text>}
        {ideen?.map((i, n) => (
          <Pressable key={n} onPress={BEREICH[i.bereich] ? () => router.navigate(BEREICH[i.bereich] as never) : undefined} style={{ gap: 4, paddingVertical: 8 }} accessibilityRole={BEREICH[i.bereich] ? "button" : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={[t.body, { fontWeight: "600", flex: 1 }]}>{i.titel}</Text>
              {i.geschaetzt ? <Badge tone="green" text={`ca. ${eur(i.geschaetzt, 0)}`} /> : null}
            </View>
            <Text style={[t.muted, { fontSize: 14 }]}>{i.text}{BEREICH[i.bereich] ? "  ›" : ""}</Text>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
