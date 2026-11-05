"use client";
import { type Ereignis, type Nachricht, type PruefPunkt } from "@/lib/abgabe/abgabe";

export const zeit = (ms: number) => new Date(ms).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const TON: Record<string, string> = { blue: "badge-blue", orange: "badge-orange", green: "badge-green", red: "badge-red", gray: "" };
const STUFE = { kritisch: ["⛔", "var(--red)"], pruefen: ["🔎", "var(--orange)"], info: ["ℹ️", "var(--muted)"] } as const;

export function Pruefliste({ punkte }: { punkte: PruefPunkt[] }) {
  if (!punkte.length) return <p className="small muted" style={{ margin: 0 }}>✓ Keine Auffälligkeiten.</p>;
  return (
    <ul className="small" style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
      {punkte.map((p, i) => (
        <li key={i} style={{ display: "flex", gap: 8 }}>
          <span aria-hidden="true">{STUFE[p.stufe][0]}</span>
          <span style={{ color: p.stufe === "info" ? "var(--muted)" : undefined }}>{p.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function Verlauf({ ereignisse, nachrichten, ich }: { ereignisse: Ereignis[]; nachrichten: Nachricht[]; ich: "mandant" | "kanzlei" }) {
  const items = [...ereignisse.map((e) => ({ ...e, art: "e" as const })), ...nachrichten.map((n) => ({ ...n, art: "n" as const }))].sort((a, b) => a.at - b.at);
  return (
    <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
      {items.map((x, i) =>
        x.art === "e" ? (
          <div key={i} className="tiny muted" style={{ textAlign: "center" }}>{zeit(x.at)} · {x.text}</div>
        ) : (
          <div key={i} className={`chat-bubble ${x.von === ich ? "chat-user" : "chat-assistant"}`} style={{ whiteSpace: "pre-wrap" }}>
            <div className="tiny" style={{ opacity: 0.7, marginBottom: 2 }}>{x.von === "kanzlei" ? "Kanzlei" : "Mandant:in"} · {zeit(x.at)}</div>
            {x.text}
          </div>
        ),
      )}
    </div>
  );
}

