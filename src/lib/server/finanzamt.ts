import "server-only";
import type { ZodType } from "zod";
import { aiEnabled, analyzeDocument, ExtractionError } from "@/lib/ai/extract";
import { HttpError } from "./guard";
import { MAX_UPLOAD_BYTES, normalizeUpload } from "./upload";

/** Nimmt ein hochgeladenes Schreiben entgegen, lässt es auslesen und verwirft die Datei sofort wieder. */
export async function readLetter<T>(req: Request, schema: ZodType<T>, system: string, userText: (form: FormData) => Promise<string> | string) {
  if (!aiEnabled()) throw new HttpError(503, "Für diese Funktion ist ein KI-Schlüssel (ANTHROPIC_API_KEY) auf dem Server nötig.");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError(413, `Die Datei ist größer als ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) throw new HttpError(415, "Upload erwartet.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Keine Datei erhalten.");
  const { input } = await normalizeUpload(file);
  try {
    return { form, data: await analyzeDocument(input, schema, system, await userText(form)) };
  } catch (err) {
    if (err instanceof ExtractionError) throw new HttpError(422, err.message);
    throw err;
  } finally {
    input.data.fill(0);
  }
}
