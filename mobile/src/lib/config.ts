import { Platform } from "react-native";

/**
 * Backend-Konfiguration. In Produktions-Builds ist ausschließlich HTTPS erlaubt;
 * eine http://-URL führt zu einem Konfigurationsfehler statt zu unverschlüsselter Übertragung.
 */
const RAW = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

function validate(url: string): { url: string; error: string | null } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, error: "EXPO_PUBLIC_API_URL ist keine gültige URL." };
  }
  // Ausnahme nur für die lokale Web-Vorschau (expo export --platform web); native Builds bleiben HTTPS-only.
  const localWebPreview = Platform.OS === "web" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !__DEV__ && !localWebPreview) {
    return { url, error: "Unsichere Verbindung blockiert: Das Backend muss über HTTPS erreichbar sein." };
  }
  return { url, error: null };
}

export const API = validate(RAW);
export const FINANZONLINE_URL = "https://finanzonline.bmf.gv.at";
