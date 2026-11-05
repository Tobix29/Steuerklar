import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { kanzleiVon } from "@/lib/server/kanzlei";
import { AppShell } from "./AppShell";

export const metadata: Metadata = { title: "Mein Steuerausgleich", robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/anmelden");
  const kanzlei = !!(await kanzleiVon(user.userId));
  return <AppShell email={user.email} kanzlei={kanzlei}>{children}</AppShell>;
}
