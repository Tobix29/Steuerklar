import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { removeLocalFile, type UploadFile } from "./api";

const MAX_BYTES = 10 * 1024 * 1024;

export class PickError extends Error {}

/**
 * Bereitet ein Foto für den Upload vor: auf max. 2000 px verkleinern und als JPEG neu kodieren.
 * Dabei gehen EXIF-Daten (z. B. GPS-Position) verloren – gewollt (Datensparsamkeit).
 * Der Server kodiert zusätzlich nochmals neu.
 */
async function normalizeImage(uri: string, name: string): Promise<UploadFile> {
  if (Platform.OS === "web") return { uri, name: name.replace(/\.\w+$/, "") + ".jpg", mimeType: "image/jpeg" };
  const ctx = ImageManipulator.manipulate(uri, { maxWidth: 2000, maxHeight: 2000 });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  if (out.uri !== uri) removeLocalFile(uri);
  return { uri: out.uri, name: name.replace(/\.\w+$/, "") + ".jpg", mimeType: "image/jpeg" };
}

export type Source = "camera" | "library" | "pdf";

export async function pickDocument(source: Source): Promise<UploadFile[]> {
  if (source === "pdf") {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true, multiple: true });
    if (r.canceled) return [];
    const files: UploadFile[] = [];
    for (const a of r.assets) {
      if (a.size && a.size > MAX_BYTES) throw new PickError(`${a.name} ist größer als 10 MB.`);
      const mime = a.mimeType ?? (a.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      files.push(mime.startsWith("image/") ? await normalizeImage(a.uri, a.name) : { uri: a.uri, name: a.name, mimeType: mime });
    }
    return files;
  }

  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.9, exif: false, allowsEditing: false };
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PickError("Bitte erlaube den Kamerazugriff in den Einstellungen, um Belege zu fotografieren.");
    const r = await ImagePicker.launchCameraAsync(opts);
    if (r.canceled) return [];
    return Promise.all(r.assets.map((a, i) => normalizeImage(a.uri, a.fileName ?? `Beleg-${Date.now()}-${i}.jpg`)));
  }
  const r = await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 10 });
  if (r.canceled) return [];
  return Promise.all(r.assets.map((a, i) => normalizeImage(a.uri, a.fileName ?? `Beleg-${Date.now()}-${i}.jpg`)));
}
