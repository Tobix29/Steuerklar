import Constants from "expo-constants";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Platform, Text, View } from "react-native";
import { Badge, Button, Field, Notice, Row, Screen, Section, SwitchRow } from "~/components/ui";
import { api } from "~/lib/api";
import { useAppLock } from "~/lib/appLock";
import { API } from "~/lib/config";
import { useSession } from "~/lib/session";
import { font, useColors } from "~/lib/theme";
import type { Me } from "~/lib/types";

export default function Konto() {
  const c = useColors();
  const { signOut, replaceToken } = useSession();
  const lock = useAppLock();
  const [me, setMe] = useState<Me | null>(null);
  const [setup, setSetup] = useState<{ secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Me>("/api/me").then(setMe).catch((e) => setError(e instanceof Error ? e.message : "Fehler"));
  }, []);
  useFocusEffect(load);

  async function run(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      if (ok) setInfo(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  const otpauth = setup && me
    ? `otpauth://totp/Steuerklar:${encodeURIComponent(me.email)}?secret=${setup.secret}&issuer=Steuerklar&algorithm=SHA1&digits=6&period=30`
    : null;

  return (
    <Screen webTitle="Konto">
      {error && <Notice tone="red" text={error} />}
      {info && <Notice tone="green" icon="✓" text={info} />}

      <Section title="Konto">
        <Row label="E-Mail" value={me?.email ?? "…"} />
        <Row label="Zwei-Faktor-Anmeldung" right={me ? <Badge text={me.totpEnabled ? "Aktiv" : "Aus"} tone={me.totpEnabled ? "green" : "orange"} /> : undefined} />
        {me && !me.totpEnabled && !setup && (
          <Row label="Zwei-Faktor einrichten" chevron onPress={() => void run(async () => setSetup(await api<{ secret: string }>("/api/account/totp")))} />
        )}
      </Section>

      {setup && (
        <Section title="Zwei-Faktor einrichten" footer="Öffne den Schlüssel in deiner Authenticator-App (z. B. Passwörter-App, 1Password, Google Authenticator) und gib anschließend den angezeigten Code ein.">
          <View style={{ padding: 16, gap: 12 }}>
            <Text selectable style={{ fontFamily: font.mono, color: c.text, fontSize: 15, letterSpacing: 1 }}>
              {setup.secret.match(/.{1,4}/g)?.join(" ")}
            </Text>
            {Platform.OS !== "web" && otpauth && <Button title="In Authenticator-App öffnen" variant="secondary" onPress={() => void Linking.openURL(otpauth).catch(() => setError("Keine Authenticator-App gefunden – Schlüssel bitte manuell eingeben."))} />}
            <Field label="6-stelliger Code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
            <Button
              title="Aktivieren"
              loading={busy}
              disabled={code.length !== 6}
              onPress={() =>
                void run(async () => {
                  const r = await api<{ token?: string }>("/api/account/totp", { json: { action: "enable", secret: setup.secret, code } });
                  // Server beendet alle Sitzungen und stellt für dieses Gerät ein neues Token aus
                  if (r.token) await replaceToken(r.token);
                  setSetup(null);
                  setCode("");
                  load();
                }, "Zwei-Faktor-Anmeldung aktiviert. Andere Geräte wurden abgemeldet.")
              }
            />
          </View>
        </Section>
      )}

      <Section title="Sicherheit" footer="Deine Sitzung liegt verschlüsselt im Schlüsselbund (iOS) bzw. Keystore (Android) und verlässt dieses Gerät nicht.">
        <SwitchRow
          label={Platform.OS === "ios" ? "App-Sperre (Face ID / Code)" : "App-Sperre (Biometrie / PIN)"}
          sublabel={lock.available ? "Beim Öffnen und nach 1 Minute im Hintergrund" : "Auf diesem Gerät nicht verfügbar"}
          value={lock.enabled}
          disabled={!lock.available}
          onValueChange={(v) => void lock.setEnabled(v)}
        />
        <Row icon="🔐" label="Verschlüsselte Speicherung" sublabel="AES-256 mit persönlichem Schlüssel am Server" />
        <Row icon="🗑️" label="Belegfotos werden nicht gespeichert" sublabel="Nur die erkannten Werte – Fotos werden nach der Erkennung gelöscht" />
        <Row icon="🤖" label="KI-Belegerkennung" sublabel="Claude API (Anthropic) – keine Nutzung zum Training" right={me ? <Badge text={me.aiEnabled ? "Aktiv" : "Demo"} tone={me.aiEnabled ? "green" : "orange"} /> : undefined} />
      </Section>

      <Button title="Abmelden" variant="secondary" onPress={() => void signOut()} />

      <Section title="Konto löschen" footer="Löscht dein Konto und alle Steuerdaten unwiderruflich (Art. 17 DSGVO). Dein persönlicher Schlüssel wird vernichtet.">
        {!deleting ? (
          <Row label="Konto löschen …" destructive onPress={() => setDeleting(true)} />
        ) : (
          <View style={{ padding: 16, gap: 12 }}>
            <Field label="Passwort zur Bestätigung" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" />
            <Button
              title="Endgültig löschen"
              variant="danger"
              loading={busy}
              disabled={!password}
              onPress={() => {
                const doDelete = () =>
                  void run(async () => {
                    await api("/api/account", { method: "DELETE", json: { password } });
                    await signOut({ remote: false });
                  });
                if (Platform.OS === "web") return doDelete();
                Alert.alert("Konto wirklich löschen?", "Das kann nicht rückgängig gemacht werden.", [
                  { text: "Abbrechen", style: "cancel" },
                  { text: "Löschen", style: "destructive", onPress: doDelete },
                ]);
              }}
            />
            <Button title="Abbrechen" variant="ghost" onPress={() => setDeleting(false)} />
          </View>
        )}
      </Section>

      <Text style={{ color: c.muted, fontSize: 12, textAlign: "center" }}>
        Steuerklar {Constants.expoConfig?.version ?? ""} · {new URL(API.url).host}
        {"\n"}Software zur Selbsthilfe – keine Steuerberatung.
      </Text>
    </Screen>
  );
}
