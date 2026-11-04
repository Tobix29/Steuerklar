import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Speichert Geheimnisse ausschließlich im iOS-Keychain bzw. Android-Keystore
 * (nur auf diesem Gerät, nur wenn entsperrt, nicht in Backups/iCloud).
 * Web dient nur der Vorschau: dort liegt das Token im sessionStorage des Tabs.
 */
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const web = Platform.OS === "web";

function webStore(): Storage | null {
  try {
    return (globalThis as { sessionStorage?: Storage }).sessionStorage ?? null;
  } catch {
    return null;
  }
}

export async function getSecret(key: string): Promise<string | null> {
  if (web) return webStore()?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key, OPTS);
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (web) {
    webStore()?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, OPTS);
}

export async function deleteSecret(key: string): Promise<void> {
  if (web) {
    webStore()?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key, OPTS);
}

export const KEYS = {
  token: "sk_session_token",
  appLock: "sk_app_lock",
  year: "sk_year",
} as const;
