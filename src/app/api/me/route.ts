import { aiEnabled } from "@/lib/ai/extract";
import { json, route } from "@/lib/server/guard";

export const GET = route({ auth: true }, async ({ user }) => json({ email: user.email, totpEnabled: user.totpEnabled, aiEnabled: aiEnabled() }));
