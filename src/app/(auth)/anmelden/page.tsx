import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Anmelden" };

export default async function Page({ searchParams }: { searchParams: Promise<{ abgelaufen?: string }> }) {
  const sp = await searchParams;
  return <LoginForm expired={sp.abgelaufen === "1"} />;
}
