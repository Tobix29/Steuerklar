/**
 * Hash-Routing für die Artifact-Demo. Artifact-Links transportieren nur einfache `#name`-Hashes,
 * deshalb werden die App-Pfade auf ASCII-Namen abgebildet.
 */
export const ROUTES: Record<string, string> = {
  "/": "start",
  "/app": "uebersicht",
  "/app/profil": "profil",
  "/app/belege": "belege",
  "/app/ergebnis": "ergebnis",
  "/app/konto": "konto",
};

const ALIASES: Record<string, string> = { "/anmelden": "uebersicht", "/registrieren": "uebersicht" };

export function routeToHash(href: string): string {
  if (/^[a-z]+:/i.test(href)) return href; // externe Links unverändert
  if (href.startsWith("#")) return href;
  const [path, anchor] = href.split("#");
  if ((path === "/" || path === "") && anchor) return `#${anchor}`;
  const clean = (path ?? "/").split("?")[0]!;
  return `#${ROUTES[clean] ?? ALIASES[clean] ?? "start"}`;
}

/** Aktueller App-Pfad aus dem Hash; unbekannte Hashes (Anker auf der Startseite) zählen zur Startseite. */
export function currentPath(): string {
  const h = typeof location === "undefined" ? "" : location.hash.replace(/^#/, "");
  const hit = Object.entries(ROUTES).find(([, name]) => name === h);
  return hit ? hit[0] : "/";
}

export function navigate(path: string) {
  const hash = routeToHash(path);
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
}
