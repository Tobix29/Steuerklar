// Baut die Artifact-Demo: node demo/build.mjs → demo/dist/index.html + app.js
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "demo", "dist");
mkdirSync(out, { recursive: true });

const resolveSrc = (rel) => {
  const base = path.join(root, "src", rel);
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) if (existsSync(base + ext) && !base.endsWith("/") ) {
    if (ext === "" && !/\.[tj]sx?$/.test(base)) continue;
    return base + ext;
  }
  throw new Error("Nicht gefunden: " + rel);
};

const shims = {
  name: "steuerklar-demo",
  setup(b) {
    b.onResolve({ filter: /^@\/lib\/client\/api$/ }, () => ({ path: path.join(root, "demo", "api.ts") }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(root, "demo", "shims", "next-link.tsx") }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(root, "demo", "shims", "next-navigation.ts") }));
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: path.join(root, "demo", "shims", "server-only.ts") }));
    b.onResolve({ filter: /^@\// }, (args) => ({ path: resolveSrc(args.path.slice(2)) }));
    b.onResolve({ filter: /^next(\/|$)/ }, (args) => ({ errors: [{ text: `next-Import in der Demo nicht erlaubt: ${args.path} (aus ${args.importer})` }] }));
  },
};

await build({
  entryPoints: [path.join(root, "demo", "entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2022", "safari16"],
  jsx: "automatic",
  outfile: path.join(out, "app.js"),
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [shims],
  legalComments: "none",
  logLevel: "warning",
});

// Stylesheet der Web-App + Ergänzungen für den Artifact-Viewer (expliziter Dark-Mode-Schalter, Demo-Banner).
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");
const darkBlock = css.match(/:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
const extra = `
:root[data-theme="dark"] {${darkBlock}
}
.demo-banner { font-size: 12px; text-align: center; padding: 6px 16px; background: var(--accent-soft); color: var(--accent); font-weight: 500; letter-spacing: 0; }
.nav { top: env(safe-area-inset-top, 0px); }
`;

const html = `<title>Steuerklar</title>
<meta name="description" content="Steuerausgleich für Österreich: Belege fotografieren, KI erkennt alle Werte, Gutschrift sofort sehen.">
<style>
${css}
${extra}
</style>
<div id="root"></div>
<script src="app.js"></script>
`;
writeFileSync(path.join(out, "index.html"), html);
console.log("Demo gebaut:", out, `(${(readFileSync(path.join(out, "app.js")).length / 1024).toFixed(0)} KB JS)`);
