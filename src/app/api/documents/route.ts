import { randomUUID } from "node:crypto";
import { extractDocument, ExtractionError, aiEnabled } from "@/lib/ai/extract";
import { audit } from "@/lib/server/auth";
import { HttpError, json, route } from "@/lib/server/guard";
import { listDocuments, parseYear, saveDocument, type StoredDocument } from "@/lib/server/repo";
import { MAX_UPLOAD_BYTES, normalizeUpload, safeFileName } from "@/lib/server/upload";

export const GET = route({ auth: true }, async ({ req, user }) => {
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  return json({ documents: listDocuments(user, year), aiEnabled: aiEnabled() });
});

export const POST = route({ auth: true, rate: { name: "upload", limit: 40, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError(413, "Die Datei ist größer als 10 MB.");
  if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) throw new HttpError(415, "Upload erwartet.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Keine Datei erhalten.");
  const year = parseYear(String(form.get("year") ?? ""));
  const personIndex = form.get("person") === "1" ? 1 : 0;

  const { input, kind, bytes } = await normalizeUpload(file);
  let extraction;
  try {
    extraction = await extractDocument(input, year);
  } catch (err) {
    if (err instanceof ExtractionError) throw new HttpError(422, err.message);
    throw err;
  } finally {
    // Original- und Arbeitskopie sofort verwerfen – es werden keine Bilder gespeichert.
    input.data.fill(0);
  }

  const doc: StoredDocument = {
    id: randomUUID(),
    year,
    fileName: safeFileName(file.name),
    kind,
    bytes,
    uploadedAt: Date.now(),
    demo: !aiEnabled(),
    extraction,
    personIndex,
    applied: false,
  };
  if (extraction.taxYear && extraction.taxYear !== year)
    doc.extraction.warnings.push(`Der Beleg scheint aus ${extraction.taxYear} zu stammen, nicht aus ${year}.`);
  saveDocument(user, doc);
  await audit(user.userId, "document_uploaded");
  return json({ document: doc }, 201);
});
