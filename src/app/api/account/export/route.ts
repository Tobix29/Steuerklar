import { audit } from "@/lib/server/auth";
import { route } from "@/lib/server/guard";
import { exportAll } from "@/lib/server/repo";

/** Datenexport (DSGVO Art. 20). */
export const GET = route({ auth: true, rate: { name: "export", limit: 10, windowMs: 60 * 60_000 } }, async ({ user }) => {
  await audit(user.userId, "data_export");
  return new Response(JSON.stringify(exportAll(user), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="steuerklar-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
