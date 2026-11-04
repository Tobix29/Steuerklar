import Anthropic from "@anthropic-ai/sdk";
import { aiEnabled } from "@/lib/ai/extract";
import { ASSISTANT_INSTRUCTIONS, caseContext, ChatRequestSchema } from "@/lib/ai/assistant";
import { calculate } from "@/lib/tax/calculate";
import { audit } from "@/lib/server/auth";
import { parseJson, route } from "@/lib/server/guard";
import { loadCase, parseYear } from "@/lib/server/repo";

export const maxDuration = 120;

let client: Anthropic | null = null;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

/** Beantwortet Fragen zur eigenen Arbeitnehmerveranlagung; die Antwort wird als Text gestreamt. */
export const POST = route({ auth: true, rate: { name: "assistant", limit: 40, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const body = await parseJson(req, ChatRequestSchema, 64 * 1024);
  const data = await loadCase(user, parseYear(String(body.year)));
  const result = calculate(data);
  const encoder = new TextEncoder();
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

  if (!aiEnabled()) {
    return new Response(
      "Der Steuerassistent braucht einen KI-Schlüssel (ANTHROPIC_API_KEY) auf dem Server. Bis dahin findest du im **Spar-Check** auf der Ergebnisseite, was dir welcher Abzug bringt.",
      { headers },
    );
  }
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  await audit(user.userId, "assistant_question");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const s = client!.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 4000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "low" },
            system: [{ type: "text", text: ASSISTANT_INSTRUCTIONS, cache_control: { type: "ephemeral" } }, { type: "text", text: caseContext(data, result) }],
            messages: body.messages,
          },
          { signal: req.signal },
        );
        s.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n\nDazu kann ich leider nichts sagen. Bitte wende dich an die Arbeiterkammer oder eine Steuerberatung."));
        if (final.stop_reason === "max_tokens") controller.enqueue(encoder.encode(" …"));
      } catch (err) {
        if (!req.signal.aborted) {
          const msg = err instanceof Anthropic.RateLimitError ? "Der Assistent ist gerade ausgelastet. Bitte versuch es in einer Minute noch einmal." : "Der Assistent ist gerade nicht erreichbar.";
          console.error("[assistant]", err instanceof Error ? err.message : err);
          controller.enqueue(encoder.encode(`\n\n${msg}`));
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers });
});
