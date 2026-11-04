import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button, Checkbox, Field, Notice, Screen, useTextStyles } from "~/components/ui";
import { useSession } from "~/lib/session";
import { useColors } from "~/lib/theme";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export default function Registrieren() {
  const c = useColors();
  const t = useTextStyles();
  const { register } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = useMemo(() => strength(password), [password]);
  const labels = ["Zu kurz", "Schwach", "Okay", "Gut", "Sehr stark"];
  const colors = [c.red, c.red, c.orange, c.green, c.green];

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await register(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registrierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Text style={t.muted}>In wenigen Minuten zur fertigen Arbeitnehmerveranlagung.</Text>
        {error && <Notice tone="red" text={error} />}
        <Field label="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="username" autoComplete="email" />
        <View style={{ gap: 8 }}>
          <Field
            label="Passwort"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            help="Mindestens 12 Zeichen. Eine Passphrase aus mehreren Wörtern ist ideal."
          />
          {password.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: "hidden" }}>
                <View style={{ width: `${(s / 4) * 100}%`, height: 6, backgroundColor: colors[s] }} />
              </View>
              <Text style={{ color: colors[s], fontSize: 12 }}>{labels[s]}</Text>
            </View>
          )}
        </View>
        <Checkbox
          checked={accept}
          onChange={setAccept}
          label="Ich akzeptiere die AGB und die Datenschutzerklärung. Mir ist bewusst, dass Steuerklar eine Software zur Selbsthilfe ist und keine Steuerberatung erbringt."
        />
        <Button title="Konto erstellen" onPress={submit} loading={busy} disabled={!accept || password.length < 12 || !email} />
        <Text style={[t.muted, { fontSize: 13, textAlign: "center" }]}>🔐 Deine Daten werden mit einem persönlichen Schlüssel verschlüsselt gespeichert.</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
