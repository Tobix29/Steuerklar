"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { fristen, SUPPORTED_YEARS, type TaxYear } from "@/lib/tax/constants";
import { CaseProvider, useCase } from "./CaseContext";

const NAV: { href: string; label: string; icon: string; nurDesktop?: boolean }[] = [
  { href: "/app", label: "Übersicht", icon: "🏠" },
  { href: "/app/profil", label: "Über dich", icon: "👤" },
  { href: "/app/belege", label: "Belege", icon: "📸" },
  { href: "/app/ergebnis", label: "Ergebnis", icon: "📊" },
  { href: "/app/assistent", label: "Fragen", icon: "💬" },
  { href: "/app/finanzamt", label: "Finanzamt", icon: "🏛️" },
  { href: "/app/buchhaltung", label: "Buchhaltung", icon: "📒", nurDesktop: true },
  { href: "/app/abgabe", label: "Abgeben", icon: "📤", nurDesktop: true },
  { href: "/app/konto", label: "Konto", icon: "⚙️" },
];

function YearPicker() {
  const { year, setYear } = useCase();
  return (
    <select className="select year-picker" aria-label="Steuerjahr" value={year} onChange={(e) => setYear(Number(e.target.value) as TaxYear)}>
      {[...SUPPORTED_YEARS].reverse().filter((y) => !fristen(y).expired).map((y) => (
        <option key={y} value={y}>
          {y}
          {!fristen(y).yearEnded ? " · Prognose" : fristen(y).urgent ? " · Frist läuft ab" : ""}
        </option>
      ))}
    </select>
  );
}

function SaveIndicator() {
  const { saveState } = useCase();
  if (saveState === "idle") return null;
  const map = { saving: ["Speichert …", ""], saved: ["Gespeichert", "badge-green"], error: ["Fehler beim Speichern", "badge-red"] } as const;
  const [t, c] = map[saveState];
  return <span className={`badge ${c}`}>{saveState === "saved" ? "✓ " : ""}{t}</span>;
}

export function AppShell({ email, kanzlei = false, children }: { email: string; kanzlei?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const isActive = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/anmelden");
    router.refresh();
  }

  return (
    <CaseProvider>
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/app" className="brand">
            <span className="brand-mark" aria-hidden="true">✓</span>
            Steuerklar
          </Link>
          <nav className="stack" style={{ "--gap": "2px" } as React.CSSProperties} aria-label="App-Navigation">
            {[...NAV, ...(kanzlei ? [{ href: "/app/kanzlei", label: "Kanzlei", icon: "⚖️" }] : [])].map((n) => (
              <Link key={n.href} href={n.href} className="side-link" aria-current={isActive(n.href) ? "page" : undefined}>
                <span className="ico" aria-hidden="true">{n.icon}</span>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="spacer" />
          <div className="stack" style={{ "--gap": "10px", padding: "0 10px" } as React.CSSProperties}>
            <YearPicker />
            <div className="tiny muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
            <button className="btn btn-secondary btn-sm" onClick={logout}>Abmelden</button>
          </div>
        </aside>
        <main className="app-main">
          <div className="mobile-top">
            <Link href="/app" className="brand">
              <span className="brand-mark" aria-hidden="true">✓</span>
              Steuerklar
            </Link>
            <YearPicker />
          </div>
          <div className="save-indicator"><SaveIndicator /></div>
          {children}
        </main>
        <nav className="tabbar" aria-label="App-Navigation">
          {NAV.filter((n) => !n.nurDesktop).map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
              <span className="ico" aria-hidden="true">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </CaseProvider>
  );
}
