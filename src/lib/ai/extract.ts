import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { ZodType } from "zod";
import { demoExtraction, EXTRACTION_INSTRUCTIONS as SYSTEM, ExtractionSchema, sanitizeExtraction, type Extraction } from "./schema";

/**
 * Belegerkennung mit Claude (Vision + Structured Outputs).
 *
 * Datenschutz: Bilder werden nur im Arbeitsspeicher verarbeitet und nicht gespeichert.
 * Über die Anthropic API übermittelte Daten werden nicht zum Training verwendet;
 * für den Produktivbetrieb AVV/DPA abschließen und ggf. Zero-Data-Retention vereinbaren.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";



let client: Anthropic | null = null;

export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export type ExtractInput = { kind: "image"; mediaType: "image/jpeg"; data: Buffer } | { kind: "pdf"; data: Buffer };

export class ExtractionError extends Error {}

/** Liest ein Dokument (Foto oder PDF) mit Claude aus und liefert Daten im vorgegebenen Schema. */
export async function analyzeDocument<T>(input: ExtractInput, schema: ZodType<T>, system: string, userText: string): Promise<T> {
  if (!aiEnabled()) throw new ExtractionError("Für diese Funktion ist ein KI-Schlüssel (ANTHROPIC_API_KEY) auf dem Server nötig.");
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });

  const source =
    input.kind === "image"
      ? ({ type: "image", source: { type: "base64", media_type: input.mediaType, data: input.data.toString("base64") } } as const)
      : ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.data.toString("base64") } } as const);

  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Bei einer Ablehnung durch Sicherheitsklassifikatoren automatisch auf das empfohlene Fallback-Modell ausweichen.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: [source, { type: "text", text: userText }] }],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new ExtractionError("Die KI ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.");
    if (err instanceof Anthropic.BadRequestError) throw new ExtractionError("Das Dokument konnte nicht verarbeitet werden (Format oder Größe).");
    if (err instanceof Anthropic.APIConnectionError) throw new ExtractionError("Die KI ist nicht erreichbar.");
    if (err instanceof Anthropic.APIError) throw new ExtractionError("Die Auswertung ist fehlgeschlagen.");
    throw err;
  }

  if (response.stop_reason === "refusal") throw new ExtractionError("Dieses Dokument kann nicht automatisch verarbeitet werden.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new ExtractionError("Die Auswertung war unvollständig. Bitte ein schärferes Foto verwenden.");
  const parsed = schema.safeParse(response.parsed_output);
  if (!parsed.success) throw new ExtractionError("Die Auswertung lieferte ungültige Daten.");
  return parsed.data;
}

export async function extractDocument(input: ExtractInput, taxYear: number): Promise<Extraction> {
  if (!aiEnabled()) return demoExtraction(taxYear);
  const e = await analyzeDocument(input, ExtractionSchema, SYSTEM, `Erfasse diesen Beleg für die Arbeitnehmerveranlagung ${taxYear}.`);
  return sanitizeExtraction(e);
}
