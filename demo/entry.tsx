/**
 * Einstieg der Artifact-Demo: dieselben Seiten wie die Web-App, ohne Server.
 * Routing über den URL-Hash, Daten über demo/api.ts.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import Home from "@/app/page";
import { AppShell } from "@/app/app/AppShell";
import Overview from "@/app/app/page";
import Profil from "@/app/app/profil/page";
import Belege from "@/app/app/belege/page";
import Ergebnis from "@/app/app/ergebnis/page";
import Finanzamt from "@/app/app/finanzamt/page";
import Buchhaltung from "@/app/app/buchhaltung/page";
import Abgabe from "@/app/app/abgabe/page";
import KanzleiSeite from "@/app/app/kanzlei/page";
import Konto from "@/app/app/konto/page";
import Assistent from "@/app/app/assistent/page";
import { usePathname } from "./shims/next-navigation";
import { download } from "./api";

// Der Artifact-Viewer zeigt keine confirm()-Dialoge (sie liefern immer false) → in der Demo direkt bestätigen.
window.confirm = () => true;

const PAGES: Record<string, () => React.ReactElement> = {
  "/app": Overview,
  "/app/profil": Profil,
  "/app/belege": Belege,
  "/app/ergebnis": Ergebnis,
  "/app/assistent": Assistent,
  "/app/finanzamt": Finanzamt,
  "/app/buchhaltung": Buchhaltung,
  "/app/abgabe": Abgabe,
  "/app/kanzlei": KanzleiSeite,
  "/app/konto": Konto,
};

function Notice() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    // Links auf /api/... (PDF, Datenexport) abfangen und über die downloads-Capability anbieten.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href");
      if (!href?.startsWith("/api/")) return;
      e.preventDefault();
      setMsg("Datei wird erstellt …");
      void download(href).then(setMsg);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

function App() {
  const path = usePathname();
  useEffect(() => {
    const h = location.hash.slice(1);
    const el = h && document.getElementById(h);
    if (el) el.scrollIntoView();
  }, [path]);
  const Page = PAGES[path];
  return (
    <>
      <div className="demo-banner">Demo-Version · Steuerausgleich Österreich · deine Daten bleiben privat</div>
      {Page ? (
        <AppShell email="Demo-Konto" kanzlei>
          <Page />
        </AppShell>
      ) : (
        <Home />
      )}
      <Notice />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
