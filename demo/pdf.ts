/**
 * PDF-Belege in der Artifact-Demo: Seiten im Browser mit pdf.js zu JPEG-Bildern rendern,
 * damit Claude sie über die `sample`-Capability lesen kann (sample nimmt nur Bilder).
 * Skripte in PDFs werden nicht ausgeführt (isEvalSupported: false, keine Formular-/Skript-Engine).
 */
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

let configured = false;

export async function pdfToImages(file: File, maxPages = 3, maxBytes = 3_500_000): Promise<Blob[]> {
  if (!configured) {
    GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", location.href).href;
    configured = true;
  }
  const doc = await getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, enableXfa: false }).promise;
  const out: Blob[] = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, 1800 / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      let quality = 0.85;
      let blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      while (blob && blob.size > maxBytes && quality > 0.4) {
        quality -= 0.15;
        blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      }
      if (blob) out.push(blob);
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return out;
}
