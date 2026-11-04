import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
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

export async function extractDocument(input: ExtractInput, taxYear: number): Promise<Extraction> {
  if (!aiEnabled()) return demoExtraction(taxYear);
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
      output_config: { effort: "medium", format: betaZodOutputFormat(ExtractionSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [source, { type: "text", text: `Erfasse diesen Beleg für die Arbeitnehmerveranlagung ${taxYear}.` }],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new ExtractionError("Die Belegerkennung ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.");
    if (err instanceof Anthropic.BadRequestError) throw new ExtractionError("Der Beleg konnte nicht verarbeitet werden (Format oder Größe).");
    if (err instanceof Anthropic.APIConnectionError) throw new ExtractionError("Die Belegerkennung ist nicht erreichbar.");
    if (err instanceof Anthropic.APIError) throw new ExtractionError("Die Belegerkennung ist fehlgeschlagen.");
    throw err;
  }

  if (response.stop_reason === "refusal") throw new ExtractionError("Dieser Beleg kann nicht automatisch verarbeitet werden. Bitte Werte manuell eintragen.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new ExtractionError("Die Erkennung war unvollständig. Bitte ein schärferes Foto verwenden.");

  const parsed = ExtractionSchema.safeParse(response.parsed_output);
  if (!parsed.success) throw new ExtractionError("Die Erkennung lieferte ungültige Daten.");
  return sanitizeExtraction(parsed.data);
}

