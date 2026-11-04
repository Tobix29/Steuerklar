import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Steuerklar – Steuererklärung per Foto",
    short_name: "Steuerklar",
    description: "Belege fotografieren, KI erkennt alles, Steuererklärung fertig.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    lang: "de-DE",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
