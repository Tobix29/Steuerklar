import { SiteNav } from "@/components/SiteNav";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="auth-wrap">{children}</main>
    </>
  );
}
