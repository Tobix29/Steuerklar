import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Badge, Button, Card, Checkbox, Loading, Notice, Row, Screen, Section, TextRow, useTextStyles } from "~/components/ui";
import { api } from "~/lib/api";
import { useCase } from "~/lib/case";
import { eur } from "~/lib/format";
import { radius, useColors } from "~/lib/theme";
import { FREIGABE_TEXT, formulare, pruefliste, STATUS, VOLLMACHT_TEXT, type AbgabeStatus, type Ereignis, type Nachricht, type PruefPunkt } from "@core/abgabe/abgabe";

interface Vollmacht { id: string; kanzleiId: string; kanzleiName: string; text: string; erteiltAt: number; widerrufenAt: number | null }
export interface AbgabeKurz {
  id: string; year: number; kanzleiName: string; status: AbgabeStatus; statusLabel: string; gutschrift: number; formulare: string[]; version: number;
  uebermittlung: { at: number; referenz: string } | null; ereignisse: Ereignis[]; nachrichten: Nachricht[]; pruefliste: PruefPunkt[]; hash: string; freigabe: { at: number };
}

const zeit = (ms: number) => new Date(ms).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const TON: Record<string, "blue" | "orange" | "green" | "red" | "neutral"> = { blue: "blue", orange: "orange", green: "green", red: "red", gray: "neutral" };
const STUFE = { kritisch: "⛔", pruefen: "🔎", info: "ℹ️" } as const;

/** Bestätigung (nativ Alert, in der Web-Vorschau confirm). */
function bestaetigen(titel: string, text: string, ok: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${titel}\n\n${text}`) ?? true) ok();
    return;
  }
  Alert.alert(titel, text, [{ text: "Abbrechen", style: "cancel" }, { text: titel, style: "destructive", onPress: ok }]);
}

function Pruefliste({ punkte }: { punkte: PruefPunkt[] }) {
  const c = useColors();
  if (!punkte.length) return <Text style={{ color: c.muted, fontSize: 14 }}>✓ Keine Auffälligkeiten.</Text>;
  return (
    <View style={{ gap: 8 }}>
      {punkte.map((p, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          <Text style={{ fontSize: 14 }}>{STUFE[p.stufe]}</Text>
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: p.stufe === "info" ? c.muted : c.text }}>{p.text}</Text>
        </View>
      ))}
    </View>
  );
}

function Verlauf({ ereignisse, nachrichten }: { ereignisse: Ereignis[]; nachrichten: Nachricht[] }) {
  const c = useColors();
  const items = [...ereignisse.map((e) => ({ ...e, art: "e" as const })), ...nachrichten.map((n) => ({ ...n, art: "n" as const }))].sort((a, b) => a.at - b.at);
  return (
    <View style={{ gap: 8 }}>
      {items.map((x, i) => {
        if (x.art === "e") return <Text key={i} style={{ color: c.muted, fontSize: 12, textAlign: "center" }}>{zeit(x.at)} · {x.text}</Text>;
        const ich = x.von === "mandant";
        return (
          <View
            key={i}
            style={{
              alignSelf: ich ? "flex-end" : "flex-start", maxWidth: "88%", backgroundColor: ich ? c.accent : c.surface2,
              borderRadius: 20, borderBottomRightRadius: ich ? 6 : 20, borderBottomLeftRadius: ich ? 20 : 6, paddingVertical: 10, paddingHorizontal: 14,
            }}
          >
            <Text style={{ color: ich ? c.onAccent : c.muted, fontSize: 11, marginBottom: 2, opacity: 0.8 }}>{x.von === "kanzlei" ? "Kanzlei" : "Du"} · {zeit(x.at)}</Text>
            <Text style={{ color: ich ? c.onAccent : c.text, fontSize: 15, lineHeight: 21 }}>{x.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function Abgabe() {
  const { data, result, year, documentCount } = useCase();
  const c = useColors();
  const t = useTextStyles();
  const [vm, setVm] = useState<Vollmacht[] | null>(null);
  const [abgaben, setAbgaben] = useState<AbgabeKurz[]>([]);
  const [code, setCode] = useState("");
  const [gefunden, setGefunden] = useState<{ id: string; name: string } | null>(null);
  const [vmOk, setVmOk] = useState(false);
  const [frOk, setFrOk] = useState(false);
  const [nachricht, setNachricht] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, a] = await Promise.all([api<{ vollmachten: Vollmacht[] }>("/api/vollmacht"), api<{ abgaben: AbgabeKurz[] }>(`/api/abgaben?year=${year}`)]);
      setVm(v.vollmachten);
      setAbgaben(a.abgaben);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
      setVm((x) => x ?? []);
    }
  }, [year]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!data || !result || vm === null) return <Loading />;

  const aktiv = vm.find((v) => !v.widerrufenAt) ?? null;
  const abgabe = abgaben.find((a) => a.status !== "zurueckgezogen") ?? abgaben[0] ?? null;
  const vorschau = pruefliste(data, result, []);
  const kritisch = vorschau.filter((p) => p.stufe === "kritisch");
  const offenFuerFreigabe = !abgabe || abgabe.status === "rueckfrage" || abgabe.status === "zurueckgezogen";

  async function run(fn: () => Promise<unknown>, msg?: string) {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await fn();
      if (msg) setOk(msg);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      webTitle="Abgeben lassen"
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load().finally(() => setRefreshing(false));
      }}
    >
      <Text style={t.muted}>Deine Partner-Kanzlei prüft deine Erklärung {year} und bringt sie über FinanzOnline beim Finanzamt ein. Du gibst nur frei.</Text>
      {err && <Notice tone="red" icon="⚠️" text={err} />}
      {ok && <Notice tone="green" icon="✓" text={ok} />}

      {/* 1 · Kanzlei & Vollmacht */}
      <Section title="1 · Kanzlei & Vollmacht" footer={aktiv ? aktiv.text : "Gib den Kanzlei-Code ein, den du von deiner Kanzlei bekommen hast."}>
        {aktiv ? (
          <>
            <Row label={aktiv.kanzleiName} sublabel={`Vollmacht seit ${zeit(aktiv.erteiltAt)}`} right={<Badge text="✓ erteilt" tone="green" />} />
            <Row
              label="Vollmacht widerrufen"
              destructive
              onPress={() =>
                bestaetigen("Widerrufen", "Vollmacht widerrufen? Offene Abgaben werden zurückgezogen.", () =>
                  void run(() => api("/api/vollmacht", { method: "DELETE", json: { id: aktiv.id } }), "Vollmacht widerrufen"),
                )
              }
            />
          </>
        ) : (
          <>
            <TextRow
              label="Kanzlei-Code"
              placeholder="ABCD-1234"
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={(v) => {
                setCode(v.slice(0, 12));
                setGefunden(null);
              }}
            />
            <Row
              label={busy ? "Suche …" : "Kanzlei suchen"}
              chevron
              onPress={
                code.trim().length < 4 || busy
                  ? undefined
                  : () => void run(async () => setGefunden((await api<{ kanzlei: { id: string; name: string } }>(`/api/kanzlei/suche?code=${encodeURIComponent(code.trim())}`)).kanzlei))
              }
            />
          </>
        )}
      </Section>
      {!aktiv && gefunden && (
        <Card style={{ gap: 12 }}>
          <Text style={{ color: c.text, fontSize: 16 }}>Kanzlei: <Text style={{ fontWeight: "600" }}>{gefunden.name}</Text></Text>
          <Checkbox checked={vmOk} onChange={setVmOk} label={VOLLMACHT_TEXT(gefunden.name)} />
          <Button
            title="Vollmacht erteilen"
            disabled={!vmOk}
            loading={busy}
            onPress={() => void run(() => api("/api/vollmacht", { method: "POST", json: { code: code.trim(), zustimmung: true } }), "Vollmacht erteilt")}
          />
        </Card>
      )}

      {/* 2 · Prüfen & freigeben */}
      {aktiv && offenFuerFreigabe && (
        <>
          <Section title="2 · Prüfen & freigeben">
            <Row label={result.erstattung >= 0 ? "Voraussichtliche Gutschrift" : "Voraussichtliche Nachzahlung"} value={eur(Math.abs(result.erstattung))} />
            <Row label="Formulare" value={formulare(result).join(", ")} />
            <Row label="Belege" value={String(documentCount)} />
          </Section>
          <Card style={{ gap: 12 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>Das sieht sich die Kanzlei genauer an</Text>
            <Pruefliste punkte={vorschau} />
          </Card>
          {abgabe?.status === "rueckfrage" && <Notice tone="orange" icon="💬" text="Die Kanzlei hat eine Rückfrage (siehe unten). Ändere deine Angaben bei Bedarf und gib dann erneut frei." />}
          <Card style={{ gap: 12 }}>
            <Checkbox checked={frOk} onChange={setFrOk} label={FREIGABE_TEXT(year, aktiv.kanzleiName)} />
            <Button
              title={abgabe ? "📤 Erneut freigeben" : "📤 Zur Abgabe freigeben"}
              disabled={!frOk || kritisch.length > 0}
              loading={busy}
              onPress={() => void run(() => api("/api/abgaben", { method: "POST", json: { year, kanzleiId: aktiv.kanzleiId, bestaetigung: true } }), "Freigegeben – die Kanzlei ist informiert")}
            />
            {kritisch.length > 0 && <Text style={{ color: c.red, fontSize: 12 }}>Freigabe erst möglich, wenn die ⛔-Punkte geklärt sind.</Text>}
            <Text style={[t.muted, { fontSize: 12 }]}>
              Bei der Freigabe wird ein unveränderlicher Stand deiner Daten mit Prüfsumme erstellt. Spätere Änderungen ändern die Abgabe nicht – dafür gibst du erneut frei.
            </Text>
          </Card>
        </>
      )}

      {/* 3 · Status */}
      {abgabe && (
        <>
          <Section title="3 · Status">
            <Row label={abgabe.kanzleiName} right={<Badge text={abgabe.statusLabel} tone={TON[STATUS[abgabe.status].ton]} />} />
            <Row label="Version" value={`${abgabe.version} · ${zeit(abgabe.freigabe.at)}`} />
            <Row label="Prüfsumme" value={`${abgabe.hash.slice(0, 12)}…`} />
            {abgabe.uebermittlung && <Row label="FinanzOnline-Referenz" value={abgabe.uebermittlung.referenz} />}
          </Section>
          {abgabe.status === "uebermittelt" && (
            <Notice tone="green" icon="✓" text="Übermittelt. Den Bescheid kannst du danach unter Mehr → Finanzamt → Bescheid prüfen kontrollieren." />
          )}
          <Card style={{ gap: 12 }}>
            <Verlauf ereignisse={abgabe.ereignisse} nachrichten={abgabe.nachrichten} />
            {abgabe.status !== "zurueckgezogen" && (
              <>
                <TextInput
                  value={nachricht}
                  onChangeText={(v) => setNachricht(v.slice(0, 4000))}
                  placeholder="Nachricht an die Kanzlei …"
                  placeholderTextColor={c.muted}
                  multiline
                  accessibilityLabel="Nachricht an die Kanzlei"
                  style={{ minHeight: 80, color: c.text, backgroundColor: c.bg, borderRadius: radius.md, padding: 12, fontSize: 16, textAlignVertical: "top" }}
                />
                <Button
                  title="Senden"
                  variant="secondary"
                  disabled={!nachricht.trim()}
                  loading={busy}
                  onPress={() =>
                    void run(async () => {
                      await api(`/api/abgaben/${abgabe.id}`, { method: "POST", json: { aktion: "nachricht", text: nachricht } });
                      setNachricht("");
                    }, "Gesendet")
                  }
                />
                {(abgabe.status === "freigegeben" || abgabe.status === "in_pruefung" || abgabe.status === "rueckfrage") && (
                  <Button
                    title="Abgabe zurückziehen"
                    variant="danger"
                    disabled={busy}
                    onPress={() =>
                      bestaetigen("Zurückziehen", "Abgabe zurückziehen? Die Kanzlei übermittelt dann nichts.", () =>
                        void run(() => api(`/api/abgaben/${abgabe.id}`, { method: "POST", json: { aktion: "zurueckziehen", text: "" } }), "Zurückgezogen"),
                      )
                    }
                  />
                )}
              </>
            )}
          </Card>
        </>
      )}
      <Section>
        <Row label="Ergebnis ansehen" chevron onPress={() => router.navigate("/ergebnis")} />
      </Section>
    </Screen>
  );
}
