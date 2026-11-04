import { journalCsv } from "@/lib/tax/journal";
import { HttpError, route } from "@/lib/server/guard";
import { loadCase, parseYear } from "@/lib/server/repo";

/** Einnahmen-Ausgaben-Journal als CSV (für Aufbewahrung, Excel oder die Steuerberatung). */
export const GET = route({ auth: true }, async ({ req, user }) => {
  const url = new URL(req.url);
  const year = parseYear(url.searchParams.get("year"));
  const c = await loadCase(user, year);
  const b = c.betriebe.find((x) => x.id === url.searchParams.get("betrieb")) ?? c.betriebe[0];
  if (!b) throw new HttpError(404, "Kein Betrieb angelegt.");
  const name = `Journal-${year}-${(b.bezeichnung || "Betrieb").replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 40)}.csv`;
  return new Response("﻿" + journalCsv(b.buchungen.filter((x) => x.datum.startsWith(`${year}-`))), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
});
