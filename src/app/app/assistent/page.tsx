"use client";
import { useEffect, useRef, useState } from "react";
import { askAssistant } from "@/lib/client/api";
import { SUGGESTED_QUESTIONS, type ChatMessage } from "@/lib/ai/assistant";
import { useCase } from "../CaseContext";

/** Minimales, sicheres Markdown (Absätze, „- “-Listen, **fett**) – erzeugt React-Elemente, kein HTML. */
function RichText({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l)))
          return (
            <ul key={i} style={{ margin: "4px 0", paddingLeft: 20 }}>
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""))}</li>)}
            </ul>
          );
        return (
          <p key={i} style={{ margin: "4px 0" }}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

export default function Assistent() {
  const { year } = useCase();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  async function send(question: string) {
    const q = question.trim().slice(0, 2000);
    if (!q || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user" as const, content: q }].slice(-12);
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
    <div className="stack fade-in" style={{ "--gap": "24px" } as React.CSSProperties}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Steuerassistent</p>
          <h1 className="title">Frag einfach.</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Fragen zu deiner Arbeitnehmerveranlagung {year} – der Assistent kennt deine eingetragenen Werte.</p>
        </div>
      </header>

      {messages.length === 0 && (
        <div className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
          <p className="section-label" style={{ margin: 0 }}>Zum Beispiel</p>
          <div className="row wrap" style={{ gap: 8 }}>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button key={q} className="btn btn-secondary btn-sm" onClick={() => void send(q)}>{q}</button>
            ))}
          </div>
        </div>
      )}

      <div className="stack" style={{ "--gap": "12px" } as React.CSSProperties} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "chat-bubble chat-user" : "chat-bubble chat-assistant"}>
            {m.role === "assistant" && !m.content ? <span className="muted"><span className="spinner" style={{ width: 14, height: 14, marginRight: 8, verticalAlign: -2 }} />Denkt nach …</span> : <RichText text={m.content} />}
          </div>
        ))}
        <div ref={end} />
      </div>

      {error && <div className="notice notice-red small" role="alert">{error}</div>}

      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          id="assistant-input"
          className="input"
          rows={2}
          maxLength={2000}
          placeholder="z. B. Kann ich meinen Bürosessel absetzen?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        {busy ? (
          <button type="button" className="btn btn-secondary" onClick={() => abort.current?.abort()}>Stopp</button>
        ) : (
          <button className="btn" disabled={!draft.trim()}>Senden</button>
        )}
      </form>
      <p className="tiny muted" style={{ margin: 0 }}>
        Der Assistent gibt allgemeine Auskünfte zur Selbsthilfe und keine Steuerberatung. Prüfe wichtige Punkte bei der Arbeiterkammer oder auf bmf.gv.at.
      </p>
    </div>
  );
}
