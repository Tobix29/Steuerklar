import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Steuerklar – Steuererklärung per Foto", template: "%s · Steuerklar" },
  description: "Belege fotografieren, KI erkennt alle Werte, du prüfst und bekommst deine fertige Steuererklärung. Verschlüsselt und in Minuten.",
  applicationName: "Steuerklar",
  appleWebApp: { capable: true, title: "Steuerklar", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  referrer: "no-referrer",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Dynamisches Rendering erzwingen, damit jede Antwort einen frischen CSP-Nonce erhält.
  await connection();
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
