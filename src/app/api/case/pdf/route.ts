import { calculate } from "@/lib/tax/calculate";
import { audit } from "@/lib/server/auth";
import { route } from "@/lib/server/guard";
import { buildPdf } from "@/lib/server/pdf";
import { loadCase, parseYear } from "@/lib/server/repo";

export const GET = route({ auth: true, rate: { name: "pdf", limit: 30, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  const data = loadCase(user, year);
  const bytes = await buildPdf(data, calculate(data));
  await audit(user.userId, "pdf_generated");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Arbeitnehmerveranlagung-${year}-Ausfuellhilfe.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
