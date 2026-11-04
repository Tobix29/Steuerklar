import { useState } from "react";
import { Platform, Share, Text, TextInput, View } from "react-native";
import { Badge, Button, Card, ChoiceRow, MoneyRow, Notice, NumberRow, Row, Screen, Section, Segmented, TextRow, useTextStyles } from "~/components/ui";
import { removeLocalFile, uploadForm } from "~/lib/api";
import { useCase } from "~/lib/case";
import { pickDocument, type Source } from "~/lib/documents";
import { eur } from "~/lib/format";
import { radius, useColors } from "~/lib/theme";
import { ANTRAEGE, antragText, antragVorschlag, type AntragArt, type AntragInput } from "@core/tax/antraege";
import { POST_ARTEN, type Bescheid, type BescheidPruefung, type Post } from "@core/ai/finanzamt";

const datumDe = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "–");
const tageBis = (iso: string) => Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86_400_000);

/** Wählt genau eine Datei und lädt sie hoch; die lokale Kopie wird danach gelöscht. */
async function pickAndSend<T>(source: Source, send: (f: Awaited<ReturnType<typeof pickDocument>>[number]) => Promise<T>): Promise<T | null> {
  const files = await pickDocument(source);
  const f = files[0];
  if (!f) return null;
  for (const extra of files.slice(1)) removeLocalFile(extra.uri);
  try {
    return await send(f);
  } finally {
    removeLocalFile(f.uri);
  }
}

function Picker({ busy, label, onPick }: { busy: boolean; label: string; onPick: (s: Source) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Button title={busy ? "KI liest …" : `📸 ${label}`} loading={busy} disabled={busy} onPress={() => onPick("camera")} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title="Aus Fotos" variant="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => onPick("library")} />
        <Button title="PDF / Datei" variant="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => onPick("pdf")} />
      </View>
    </View>
  );
}

function Entwurf({ title, text, onChange }: { title: string; text: string; onChange: (t: string) => void }) {
  const c = useColors();
  const t = useTextStyles();
  const [msg, setMsg] = useState<string | null>(null);
  async function share() {
    try {
      if (Platform.OS === "web" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setMsg("✓ Kopiert");
      } else await Share.share({ message: text, title });
    } catch {
      setMsg("Teilen nicht möglich – bitte Text markieren und kopieren.");
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[t.title2, { fontSize: 17 }]}>{title}</Text>
        <Button title={Platform.OS === "web" ? "Kopieren" : "Teilen / Kopieren"} variant="secondary" onPress={() => void share()} />
      </View>
      <TextInput
        accessibilityLabel={title}
        multiline
        value={text}
        onChangeText={onChange}
        style={{ minHeight: 260, color: c.text, backgroundColor: c.surface2, borderRadius: radius.md, padding: 12, fontSize: 13, lineHeight: 19, textAlignVertical: "top", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) }}
      />
      {msg && <Text style={[t.muted, { fontSize: 13 }]}>{msg}</Text>}
      <Text style={[t.muted, { fontSize: 12 }]}>Platzhalter in [eckigen Klammern] ersetzen. Einbringen über FinanzOnline → Eingaben → Rechtsmittel bzw. Anbringen, oder unterschrieben per Post.</Text>
    </View>
  );
}

function BescheidKarte() {
  const c = useColors();
  const t = useTextStyles();
  const { year } = useCase();
  const [zustellung, setZustellung] = useState<"databox" | "post">("databox");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ bescheid: Bescheid; pruefung: BescheidPruefung } | null>(null);
  const [text, setText] = useState("");

  async function run(source: Source) {
    setErr(null);
    setBusy(true);
    try {
      const r = await pickAndSend(source, (f) => uploadForm<{ bescheid: Bescheid; pruefung: BescheidPruefung }>("/api/finanzamt/bescheid", f, { year: String(year), zustellung }));
      if (r) {
        setRes(r);
        setText(r.pruefung.beschwerde);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  const p = res?.pruefung;
  const b = res?.bescheid;
  return (
    <>
      <Card style={{ gap: 12 }}>
        <Text style={t.title2}>🔍 Bescheid prüfen</Text>
        <Text style={t.muted}>Lade deinen Einkommensteuerbescheid {year} hoch. Steuerklar vergleicht ihn mit deiner Berechnung und schreibt bei Abweichungen die Beschwerde für dich.</Text>
        <Text style={[t.muted, { fontSize: 13 }]}>Wie kam der Bescheid?</Text>
        <Segmented value={zustellung} onChange={setZustellung} options={[{ value: "databox", label: "Databox" }, { value: "post", label: "Per Post" }]} />
        <Picker busy={busy} label="Bescheid fotografieren" onPick={(s) => void run(s)} />
      </Card>
      {err && <Notice tone="red" icon="⚠️" text={err} />}
      {p && b && (
        <>
          <Notice tone={p.beschwerdeSinnvoll ? "orange" : "green"} icon={p.beschwerdeSinnvoll ? "✍️" : "✓"} text={p.fazit} />
          <Section title="Vergleich">
            <Row
              label={b.abgabengutschrift !== null && b.abgabengutschrift < 0 ? "Nachforderung laut Bescheid" : "Gutschrift laut Bescheid"}
              value={b.abgabengutschrift === null ? "–" : eur(b.abgabengutschrift)}
            />
            <Row label="Unterschied zu deiner Berechnung" value={p.differenzGutschrift === null ? "–" : eur(p.differenzGutschrift)} valueColor={(p.differenzGutschrift ?? 0) >= 20 ? c.orange : undefined} />
            <Row
              label="Beschwerdefrist bis"
              sublabel={p.frist ? (p.fristAbgelaufen ? "abgelaufen" : `noch ${tageBis(p.frist)} Tage`) : "Datum nicht erkannt"}
              value={datumDe(p.frist)}
              valueColor={p.fristAbgelaufen ? c.red : undefined}
            />
            {p.abweichungen.map((a) => (
              <Row
                key={a.posten}
                label={a.posten}
                sublabel={`Bescheid ${eur(a.bescheid)} · Steuerklar ${eur(a.berechnet)}`}
                right={<Badge text={`${a.differenz > 0 ? "+" : ""}${eur(a.differenz)}`} tone={a.zuDeinenUngunsten ? "orange" : "blue"} />}
              />
            ))}
          </Section>
          {b.nichtAnerkannt.length > 0 && (
            <Section title="Laut Begründung nicht anerkannt">
              {b.nichtAnerkannt.map((n, i) => (
                <Row key={i} label={`${n.posten}${n.betrag ? ` (${eur(n.betrag)})` : ""}`} sublabel={n.begruendung} />
              ))}
            </Section>
          )}
          {b.hinweise.map((h, i) => <Notice key={i} text={h} />)}
          {b.istBescheid && (p.beschwerdeSinnvoll || p.abweichungen.length > 0 || b.nichtAnerkannt.length > 0) && (
            <Card style={{ gap: 10 }}>
              <Entwurf title="Entwurf: Beschwerde" text={text} onChange={setText} />
              <Text style={[t.muted, { fontSize: 12 }]}>
                Mehr Zeit nötig? Vor Fristende kannst du eine Verlängerung der Beschwerdefrist beantragen (§ 245 Abs. 3 BAO). Bei einer Nachforderung zahlt man trotz Beschwerde,
                außer man beantragt die Aussetzung der Einhebung (§ 212a BAO, im Entwurf enthalten).
              </Text>
            </Card>
          )}
        </>
      )}
    </>
  );
}

const DRINGLICH = { hoch: ["red", "Dringend"], mittel: ["orange", "Bald erledigen"], niedrig: ["green", "Kein Stress"] } as const;

function BriefKarte() {
  const t = useTextStyles();
  const { year } = useCase();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [text, setText] = useState("");

  async function run(source: Source) {
    setErr(null);
    setBusy(true);
    try {
      const r = await pickAndSend(source, (f) => uploadForm<{ post: Post }>("/api/finanzamt/post", f, { year: String(year) }));
      if (r) {
        setPost(r.post);
        setText(r.post.antwortEntwurf);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card style={{ gap: 12 }}>
        <Text style={t.title2}>✉️ Brief vom Finanzamt</Text>
        <Text style={t.muted}>Ergänzungsersuchen, Vorhalt, Zahlungsaufforderung, Mahnung … Foto hochladen – Steuerklar erklärt, was zu tun ist, und schreibt die Antwort.</Text>
        <Picker busy={busy} label="Brief fotografieren" onPick={(s) => void run(s)} />
      </Card>
      {err && <Notice tone="red" icon="⚠️" text={err} />}
      {post && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge text={POST_ARTEN[post.art]} tone="blue" />
            <Badge text={DRINGLICH[post.dringlichkeit][1]} tone={DRINGLICH[post.dringlichkeit][0]} />
            {post.frist && <Badge text={`Frist ${datumDe(post.frist)}${tageBis(post.frist) >= 0 ? ` · ${tageBis(post.frist)} Tage` : " · abgelaufen"}`} />}
            {post.betrag !== null && <Badge text={eur(post.betrag)} />}
          </View>
          <Card>
            <Text style={t.body}>{post.zusammenfassung}</Text>
          </Card>
          {post.fachberatungEmpfohlen && (
            <Notice
              tone="orange"
              icon="⚖️"
              text="Hier empfehlen wir eine Steuerberatung oder Rechtsanwält:in: Bei Außenprüfungen, Finanzstrafverfahren oder Schätzungen ist eine professionelle Vertretung sinnvoll – und gesetzlich diesen Berufen vorbehalten."
            />
          )}
          {post.wasTun.length > 0 && (
            <Section title="So gehst du vor">
              {post.wasTun.map((w, i) => <Row key={i} icon={String(i + 1)} label={w} />)}
            </Section>
          )}
          {post.unterlagen.length > 0 && (
            <Section title="Benötigte Unterlagen">
              {post.unterlagen.map((u, i) => <Row key={i} icon="📎" label={u} />)}
            </Section>
          )}
          {post.hinweise.map((h, i) => <Notice key={i} text={h} />)}
          {post.antwortEntwurf.trim() !== "" && (
            <Card>
              <Entwurf title="Entwurf: Antwort" text={text} onChange={setText} />
            </Card>
          )}
        </>
      )}
    </>
  );
}


function AntragKarte() {
  const { data, result } = useCase();
  const [a, setA] = useState<AntragInput | null>(null);
  const [text, setText] = useState("");
  if (!data || !result) return null;
  const upd = (patch: Partial<AntragInput>) => {
    if (!a) return;
    const v = { ...a, ...patch };
    setA(v);
    setText(antragText(v, data));
  };
  const arten = Object.keys(ANTRAEGE) as AntragArt[];
  return (
    <>
      <Section title="📨 Antrag stellen" footer={a ? ANTRAEGE[a.art].info : "Fertige Anträge mit dem richtigen Paragraphen – Werte aus deinem Fall sind schon eingesetzt."}>
        <ChoiceRow
          label="Antrag"
          value={(a?.art ?? "") as AntragArt}
          options={arten.map((k) => ({ value: k, label: ANTRAEGE[k].titel }))}
          onChange={(art) => {
            const v = antragVorschlag(art, data, result);
            setA(v);
            setText(antragText(v, data));
          }}
        />
        {a?.art === "herabsetzung" && <MoneyRow label="Bisherige Vorauszahlung" value={a.betrag} onChange={(v) => upd({ betrag: v })} />}
        {a?.art === "herabsetzung" && <MoneyRow label="Beantragt (Prognose)" value={a.beantragt} onChange={(v) => upd({ beantragt: v })} />}
        {a?.art === "zahlungserleichterung" && <MoneyRow label="Offener Betrag" value={a.betrag} onChange={(v) => upd({ betrag: v })} />}
        {a?.art === "zahlungserleichterung" && <NumberRow label="Monatsraten" sublabel="0 = Stundung" value={a.raten} max={24} onChange={(v) => upd({ raten: v })} />}
        {a?.art === "rueckzahlung" && <MoneyRow label="Guthaben" value={a.betrag} onChange={(v) => upd({ betrag: v })} />}
        {a?.art === "rueckzahlung" && <TextRow label="IBAN" value={a.iban} autoCapitalize="characters" onChangeText={(v) => upd({ iban: v.slice(0, 40) })} />}
        {(a?.art === "beschwerdefrist" || a?.art === "erklaerungsfrist") && (
          <TextRow label={a.art === "beschwerdefrist" ? "Bescheid vom" : "Verlängern bis"} placeholder="JJJJ-MM-TT" value={a.datum} onChangeText={(v) => upd({ datum: v.slice(0, 10) })} />
        )}
        {a && a.art !== "rueckzahlung" && <TextRow label="Begründung" placeholder="optional" value={a.begruendung} multiline onChangeText={(v) => upd({ begruendung: v.slice(0, 2000) })} />}
      </Section>
      {a && <Entwurf title={`Entwurf: ${ANTRAEGE[a.art].titel}`} text={text} onChange={setText} />}
    </>
  );
}

export default function Finanzamt() {
  const t = useTextStyles();
  return (
    <Screen webTitle="Finanzamt">
      <Text style={t.muted}>Bescheide prüfen, Briefe verstehen, Antworten schreiben. Die Dokumente werden nur gelesen und nicht gespeichert.</Text>
      <BescheidKarte />
      <BriefKarte />
      <AntragKarte />
      <Text style={[t.muted, { fontSize: 12 }]}>
        Steuerklar ersetzt keine rechtliche Vertretung. Entwürfe vor dem Absenden lesen und anpassen. Vertretung vor dem Finanzamt, im Finanzstrafverfahren und bei Außenprüfungen
        ist Steuerberater:innen, Wirtschaftsprüfer:innen und Rechtsanwält:innen vorbehalten.
      </Text>
    </Screen>
  );
}
