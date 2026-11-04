import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Steuerklar Startseite">
      <span className="brand-mark" aria-hidden="true">✓</span>
      Steuerklar
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Brand />
        <nav className="nav-links" aria-label="Hauptnavigation">
          <a href="/#so-gehts">So geht’s</a>
          <a href="/#funktionen">Funktionen</a>
          <a href="/#sicherheit">Sicherheit</a>
          <a href="/#faq">FAQ</a>
        </nav>
        <div className="spacer" />
        <Link href="/anmelden" className="small" style={{ color: "var(--text)" }}>Anmelden</Link>
        <Link href="/registrieren" className="btn btn-sm">Starten</Link>
      </div>
    </header>
  );
}
