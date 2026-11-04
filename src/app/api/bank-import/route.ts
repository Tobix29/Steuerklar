import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { aiEnabled } from "@/lib/ai/extract";
import { BankResultSchema, bankInstructions, MAX_CSV_CHARS, prepareCsv } from "@/lib/ai/bank";
import { SUPPORTED_YEARS } from "@/lib/tax/constants";
import { audit } from "@/lib/server/auth";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";

export const maxDuration = 120;

const BodySchema = z.object({
  year: z.number().refine((y) => (SUPPORTED_YEARS as number[]).includes(y)),
  csv: z.string().min(20).max(MAX_CSV_CHARS * 2),
});

let client: Anthropic | null = null;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

/** Durchsucht einen Kontoauszug nach absetzbaren Ausgaben. Der Auszug wird weder gespeichert noch protokolliert. */
export const POST = route({ auth: true, rate: { name: "bank", limit: 10, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const body = await parseJson(req, BodySchema, MAX_CSV_CHARS * 2 + 1024);
  if (!aiEnabled()) throw new HttpError(503, "Der Kontoauszug-Import braucht einen KI-Schlüssel (ANTHROPIC_API_KEY) auf dem Server.");
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  await audit(user.userId, "bank_import");

  let res;
  try {
    res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(BankResultSchema) },
      system: bankInstructions(body.year),
      messages: [{ role: "user", content: `<kontoauszug>\n${prepareCsv(body.csv)}\n</kontoauszug>` }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, "Die KI ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.");
    if (err instanceof Anthropic.APIError) throw new HttpError(502, "Der Kontoauszug konnte nicht ausgewertet werden.");
    throw err;
  }
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new HttpError(422, "Der Kontoauszug konnte nicht ausgewertet werden.");
  const parsed = BankResultSchema.safeParse(res.parsed_output);
  if (!parsed.success) throw new HttpError(422, "Die Auswertung lieferte ungültige Daten.");
  const findings = parsed.data.findings
    .filter((f) => Number.isFinite(f.betrag) && Math.abs(f.betrag) > 0 && Math.abs(f.betrag) < 1_000_000)
    .slice(0, 200)
    .map((f) => ({ ...f, betrag: Math.abs(f.betrag), empfaenger: f.empfaenger.slice(0, 120), verwendungszweck: f.verwendungszweck.slice(0, 160) }));
  return json({ findings, hinweis: parsed.data.hinweis });
});
