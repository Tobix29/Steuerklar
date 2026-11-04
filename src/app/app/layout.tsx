import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { AppShell } from "./AppShell";

export const metadata: Metadata = { title: "Meine Steuererklärung", robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/anmelden");
  return <AppShell email={user.email}>{children}</AppShell>;
}
