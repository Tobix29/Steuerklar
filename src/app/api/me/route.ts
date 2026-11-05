import { aiEnabled } from "@/lib/ai/extract";
import { json, route } from "@/lib/server/guard";
import { kanzleiVon } from "@/lib/server/kanzlei";

export const GET = route({ auth: true }, async ({ user }) =>
  json({ email: user.email, totpEnabled: user.totpEnabled, aiEnabled: aiEnabled(), kanzlei: !!(await kanzleiVon(user.userId)) }),
);
