import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "~/components/BrandMark";
import { Button, Field, Notice, Screen, useTextStyles } from "~/components/ui";
import { useSession } from "~/lib/session";
import { useColors } from "~/lib/theme";

export default function Anmelden() {
  const c = useColors();
  const t = useTextStyles();
  const { signIn, verifyMfa, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mfa = status === "mfa";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mfa) await verifyMfa(code);
      else {
        await signIn(email.trim(), password);
        setPassword("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Screen>
          <View style={{ gap: 12, marginTop: 40, marginBottom: 12 }}>
            <BrandMark />
            <Text style={[t.title2, { fontSize: 30, textAlign: "center" }]}>{mfa ? "Bestätigungscode" : "Willkommen zurück"}</Text>
            <Text style={[t.muted, { textAlign: "center" }]}>
              {mfa ? "Gib den 6-stelligen Code aus deiner Authenticator-App ein." : "Deine Arbeitnehmerveranlagung – einfach fotografiert."}
            </Text>
          </View>
          {error && <Notice tone="red" text={error} />}
          {mfa ? (
            <Field
              label="Code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              style={{ fontSize: 28, letterSpacing: 10, textAlign: "center", borderRadius: 12, paddingVertical: 14, backgroundColor: c.surface, color: c.text }}
            />
          ) : (
            <View style={{ gap: 14 }}>
              <Field
                label="E-Mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                autoComplete="email"
              />
              <Field
                label="Passwort"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="current-password"
                onSubmitEditing={submit}
              />
            </View>
          )}
          <Button title={mfa ? "Bestätigen" : "Anmelden"} onPress={submit} loading={busy} disabled={mfa ? code.length !== 6 : !email || !password} />
          {!mfa && (
            <Text style={[t.muted, { textAlign: "center" }]}>
              Noch kein Konto?{" "}
              <Link href="/registrieren" style={{ color: c.accent, fontWeight: "600" }}>
                Jetzt registrieren
              </Link>
            </Text>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
