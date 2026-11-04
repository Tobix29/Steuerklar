import "server-only";
import sharp from "sharp";
import type { ExtractInput } from "@/lib/ai/extract";
import { HttpError } from "./guard";

/** Vercel begrenzt Request-Bodies auf 4,5 MB; lokal sind 10 MB erlaubt. Bilder werden im Browser vorab verkleinert. */
export const MAX_UPLOAD_BYTES = (process.env.VERCEL ? 4 : 10) * 1024 * 1024;

type Detected = "jpeg" | "png" | "webp" | "heic" | "pdf" | null;

/** Dateityp anhand der Magic Bytes bestimmen – Dateiendung und MIME-Type des Clients werden nicht vertraut. */
export function sniff(buf: Buffer): Detected {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 4, 8) === "ftyp" && /heic|heix|mif1|msf1|hevc/.test(buf.toString("ascii", 8, 12))) return "heic";
  if (buf.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  return null;
}

/**
 * Validiert und normalisiert einen Upload:
 *  - Größen- und Typprüfung (Magic Bytes)
 *  - Bilder werden neu kodiert (JPEG): entfernt EXIF/GPS-Metadaten, neutralisiert Polyglot-Dateien,
 *    korrigiert die Ausrichtung und begrenzt die Auflösung (Schutz vor Decompression Bombs).
 */
export async function normalizeUpload(file: File): Promise<{ input: ExtractInput; kind: "image" | "pdf"; bytes: number }> {
  if (file.size === 0) throw new HttpError(400, "Die Datei ist leer.");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, `Die Datei ist größer als ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) throw new HttpError(415, "Nur JPEG, PNG, WebP, HEIC oder PDF werden unterstützt.");

  if (type === "pdf") {
    if (buf.includes(Buffer.from("/Encrypt"))) throw new HttpError(415, "Passwortgeschützte PDFs werden nicht unterstützt.");
    return { input: { kind: "pdf", data: buf }, kind: "pdf", bytes: buf.length };
  }

  try {
    const out = await sharp(buf, { limitInputPixels: 60_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
    return { input: { kind: "image", mediaType: "image/jpeg", data: out }, kind: "image", bytes: buf.length };
  } catch {
    throw new HttpError(
      415,
      type === "heic"
        ? "HEIC-Fotos können hier nicht gelesen werden. Bitte in der Kamera-App „Maximale Kompatibilität“ (JPEG) wählen."
        : "Das Bild konnte nicht gelesen werden.",
    );
  }
}

export function safeFileName(name: string): string {
  return name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "Beleg";
}
