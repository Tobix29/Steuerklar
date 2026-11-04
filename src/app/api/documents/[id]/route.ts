import { z } from "zod";
import { ExtractionSchema, sanitizeExtraction } from "@/lib/ai/schema";
import { applyDocument, unapplyDocument } from "@/lib/tax/apply";
import { HttpError, json, parseJson, route } from "@/lib/server/guard";
import { deleteDocumentRow, getDocument, loadCase, parseYear, saveCase, saveDocument } from "@/lib/server/repo";

const idFrom = (req: Request) => {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "Ungültige ID.");
  return id;
};

const PatchSchema = z.object({
  extraction: ExtractionSchema.optional(),
  applied: z.boolean().optional(),
});

/** Beleg bearbeiten, bestätigen (in den Steuerfall übernehmen) oder Übernahme zurücknehmen. */
export const PATCH = route({ auth: true, rate: { name: "doc", limit: 200, windowMs: 60_000 } }, async ({ req, user }) => {
  const id = idFrom(req);
  const body = await parseJson(req, PatchSchema);
  const doc = await getDocument(user, id);
  if (!doc) throw new HttpError(404, "Beleg nicht gefunden.");
  const year = parseYear(String(doc.year));
  let data = await loadCase(user, year);

  // Bisherige Buchung mit den alten Werten entfernen, bevor neue Werte übernommen werden.
  data = unapplyDocument(data, doc);
  if (body.extraction) doc.extraction = sanitizeExtraction(body.extraction);
  const shouldApply = body.applied ?? doc.applied;

  if (shouldApply) {
    try {
      const res = applyDocument(data, doc);
      data = res.case;
      doc.appliedAmount = res.amount;
      doc.applied = true;
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : "Übernahme nicht möglich.");
    }
  } else {
    doc.applied = false;
    doc.appliedAmount = 0;
  }
  await saveCase(user, data);
  await saveDocument(user, doc);
  return json({ document: doc });
});

export const DELETE = route({ auth: true, rate: { name: "doc", limit: 200, windowMs: 60_000 } }, async ({ req, user }) => {
  const id = idFrom(req);
  const doc = await getDocument(user, id);
  if (!doc) throw new HttpError(404, "Beleg nicht gefunden.");
  if (doc.applied) {
    const year = parseYear(String(doc.year));
    await saveCase(user, unapplyDocument(await loadCase(user, year), doc));
  }
  await deleteDocumentRow(user, id);
  return json({ ok: true });
});
