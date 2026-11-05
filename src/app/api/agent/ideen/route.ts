import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { caseContext } from "@/lib/ai/assistant";
import { aiEnabled } from "@/lib/ai/extract";
import { IDEEN_INSTRUCTIONS, IdeenSchema } from "@/lib/ai/ideen";
import { fragen } from "@/lib/agent/fragen";
import { calculate } from "@/lib/tax/calculate";
import { audit } from "@/lib/server/auth";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { loadCase, parseYear } from "@/lib/server/repo";

export const maxDuration = 120;
let client: Anthropic | null = null;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

/** Persönliche KI-Hinweise zum Fall. Es werden keine Daten verändert. */
export const POST = route({ auth: true, rate: { name: "ideen", limit: 10, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const body = await parseJson(req, z.object({ year: z.number().int() }), 256);
  if (!aiEnabled()) throw new HttpError(503, "Für KI-Ideen ist ein KI-Schlüssel (ANTHROPIC_API_KEY) auf dem Server nötig.");
  const c = await loadCase(user, parseYear(String(body.year)));
  const r = calculate(c);
  const gefragt = fragen(c, r).map((f) => f.titel).join("\n");
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  await audit(user.userId, "agent_ideen");
  let res;
  try {
    res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(IdeenSchema) },
      system: IDEEN_INSTRUCTIONS,
      messages: [{ role: "user", content: `<fall>\n${caseContext(c, r)}\n</fall>\n<bereits_gefragt>\n${gefragt}\n</bereits_gefragt>` }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, "Die KI ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.");
    if (err instanceof Anthropic.APIError) throw new HttpError(502, "Die KI ist gerade nicht erreichbar.");
    throw err;
  }
  const parsed = IdeenSchema.safeParse(res.parsed_output);
  if (res.stop_reason === "refusal" || !parsed.success) throw new HttpError(422, "Die KI konnte keine Ideen erstellen.");
  return json({ ideen: parsed.data.ideen.slice(0, 5).map((i) => ({ ...i, titel: i.titel.slice(0, 160), text: i.text.slice(0, 800), geschaetzt: i.geschaetzt !== null && Number.isFinite(i.geschaetzt) && i.geschaetzt >= 0 && i.geschaetzt < 100_000 ? Math.round(i.geschaetzt) : null })) });
});
