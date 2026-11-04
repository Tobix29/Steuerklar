import { caseContext } from "@/lib/ai/assistant";
import { postInstructions, PostSchema } from "@/lib/ai/finanzamt";
import { calculate } from "@/lib/tax/calculate";
import { audit } from "@/lib/server/auth";
import { readLetter } from "@/lib/server/finanzamt";
import { json, route } from "@/lib/server/guard";
import { loadCase, parseYear } from "@/lib/server/repo";

export const maxDuration = 120;

/** Brief vom Finanzamt erklären und eine Antwort entwerfen. Das Schreiben wird nicht gespeichert. */
export const POST = route({ auth: true, rate: { name: "fa-post", limit: 20, windowMs: 60 * 60_000 } }, async ({ req, user }) => {
  const { data: post } = await readLetter(req, PostSchema, postInstructions(new Date().toISOString().slice(0, 10)), async (form) => {
    const c = await loadCase(user, parseYear(String(form.get("year") ?? "")));
    return `<fall>\n${caseContext(c, calculate(c))}\n</fall>\n\nErkläre dieses Schreiben und entwirf die Antwort.`;
  });
  await audit(user.userId, "fa_post_checked");
  return json({ post });
});
