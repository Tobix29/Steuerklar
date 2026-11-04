import { destroySession } from "@/lib/server/auth";
import { json, route } from "@/lib/server/guard";

export const POST = route({ auth: false }, async () => {
  await destroySession();
  return json({ ok: true });
});
