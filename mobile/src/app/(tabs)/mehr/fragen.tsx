import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { Button, Notice, useTextStyles } from "~/components/ui";
import { askAssistant } from "~/lib/api";
import { useCase } from "~/lib/case";
import { radius, useColors } from "~/lib/theme";
import { SUGGESTED_QUESTIONS } from "@core/ai/assistant";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/** Minimales Markdown (Absätze, „- “-Listen, **fett**) als Text-Elemente – kein HTML. */
function RichText({ text, color }: { text: string; color: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <Text key={i} style={{ fontWeight: "600" }}>{part.slice(2, -2)}</Text>
      ) : (
        <Text key={i}>{part}</Text>
      ),
    );
  return (
    <View style={{ gap: 6 }}>
      {text
        .trim()
        .split(/\n{2,}/)
        .map((block, i) => (
          <View key={i} style={{ gap: 2 }}>
            {block.split("\n").map((line, j) => {
              const bullet = /^\s*[-•]\s+/.test(line);
              return (
                <Text key={j} style={{ color, fontSize: 16, lineHeight: 22 }}>
                  {bullet ? "•  " : ""}
                  {inline(line.replace(/^\s*[-•]\s+/, ""))}
                </Text>
              );
            })}
          </View>
        ))}
    </View>
  );
}

export default function Fragen() {
  const c = useColors();
  const t = useTextStyles();
  const { year } = useCase();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function send(question: string) {
    const q = question.trim().slice(0, 2000);
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: "user" as const, content: q }].slice(-12);
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    setError(null);
    abort.current = new AbortController();
    try {
      const answer = await askAssistant(history, year, (text) => setMessages([...history, { role: "assistant", content: text }]), abort.current.signal);
      setMessages([...history, { role: "assistant", content: answer || "…" }]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "Der Assistent ist gerade nicht erreichbar.");
      setMessages((m) => (m.at(-1)?.content ? m : m.slice(0, -1)));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {Platform.OS === "web" && <Text style={[t.title2, { fontSize: 34, marginBottom: 4 }]}>Fragen</Text>}
        <Text style={t.muted}>Fragen zu deiner Arbeitnehmerveranlagung {year} – der Assistent kennt deine eingetragenen Werte.</Text>
        {messages.length === 0 && (
          <View style={{ gap: 8 }}>
            {SUGGESTED_QUESTIONS.map((q) => (
              <Pressable
                key={q}
                onPress={() => void send(q)}
                accessibilityRole="button"
                style={({ pressed }) => ({ backgroundColor: pressed ? c.hairline : c.surface, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 })}
              >
                <Text style={{ color: c.accent, fontSize: 16 }}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {messages.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              backgroundColor: m.role === "user" ? c.accent : c.surface,
              borderRadius: 20,
              borderBottomRightRadius: m.role === "user" ? 6 : 20,
              borderBottomLeftRadius: m.role === "user" ? 20 : 6,
              paddingVertical: 10,
              paddingHorizontal: 14,
            }}
          >
            {m.role === "assistant" && !m.content ? (
              <Text style={{ color: c.muted, fontSize: 16 }}>Denkt nach …</Text>
            ) : (
              <RichText text={m.content} color={m.role === "user" ? c.onAccent : c.text} />
            )}
          </View>
        ))}
        {error && <Notice tone="red" text={error} />}
        <Text style={[t.muted, { fontSize: 12 }]}>
          Der Assistent gibt allgemeine Auskünfte zur Selbsthilfe und keine Steuerberatung. Prüfe wichtige Punkte bei der Arbeiterkammer oder auf bmf.gv.at.
        </Text>
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 0.5, borderTopColor: c.hairline, backgroundColor: c.bg, alignItems: "flex-end" }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="z. B. Kann ich meinen Bürosessel absetzen?"
          placeholderTextColor={c.muted}
          multiline
          maxLength={2000}
          accessibilityLabel="Frage"
          style={{ flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: c.surface, color: c.text, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, fontSize: 16 }}
        />
        {busy ? (
          <Button title="Stopp" variant="secondary" onPress={() => abort.current?.abort()} />
        ) : (
          <Button title="Senden" onPress={() => void send(draft)} disabled={!draft.trim()} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
