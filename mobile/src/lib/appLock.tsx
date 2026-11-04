import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View, type AppStateStatus } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as ScreenCapture from "expo-screen-capture";
import { getSecret, KEYS, setSecret } from "./secureStorage";
import { useColors } from "./theme";

/** Nach so langer Zeit im Hintergrund ist eine erneute Entsperrung nötig. */
const RELOCK_AFTER_MS = 60_000;
const native = Platform.OS !== "web";

interface LockCtx {
  available: boolean;
  enabled: boolean;
  setEnabled: (v: boolean) => Promise<boolean>;
}

const Ctx = createContext<LockCtx>({ available: false, enabled: false, setEnabled: async () => false });
export const useAppLock = () => useContext(Ctx);

async function authenticate(prompt: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: "Abbrechen",
      // Fallback auf Geräte-Code erlaubt (wenn Face ID/Fingerabdruck scheitert)
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}

/**
 * App-Sperre (Face ID / Touch ID / Fingerabdruck / Geräte-Code) und Sichtschutz:
 * - Beim Kaltstart und nach > 60 s im Hintergrund muss entsperrt werden.
 * - Solange die App inaktiv ist (App-Umschalter, Kontrollzentrum), wird ein Sichtschutz über alle Inhalte gelegt.
 */
export function AppLockProvider({ active, children }: { active: boolean; children: React.ReactNode }) {
  const c = useColors();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(!native);
  const [locked, setLocked] = useState(native);
  const [shield, setShield] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!native) return;
    (async () => {
      const hw = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const enrolled = hw && (await LocalAuthentication.isEnrolledAsync().catch(() => false));
      const level = await LocalAuthentication.getEnrolledLevelAsync().catch(() => LocalAuthentication.SecurityLevel.NONE);
      const canLock = enrolled || level !== LocalAuthentication.SecurityLevel.NONE;
      setAvailable(canLock);
      const stored = await getSecret(KEYS.appLock).catch(() => null);
      // Standard: eingeschaltet, sofern das Gerät es unterstützt
      const on = canLock && stored !== "0";
      setEnabledState(on);
      setLocked(on);
      setReady(true);
      // iOS: Inhalte im App-Umschalter zusätzlich nativ weichzeichnen
      ScreenCapture.enableAppSwitcherProtectionAsync?.(0.9).catch(() => {});
    })();
  }, []);

  useEffect(() => {
    if (!native) return;
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") {
        setShield(false);
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (enabled && since !== null && Date.now() - since > RELOCK_AFTER_MS) setLocked(true);
      } else {
        setShield(true);
        if (s === "background" && backgroundedAt.current === null) backgroundedAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const unlock = useCallback(async () => {
    if (await authenticate("Steuerklar entsperren")) setLocked(false);
  }, []);

  useEffect(() => {
    if (locked && active && enabled && ready && AppState.currentState === "active") void unlock();
  }, [locked, active, enabled, ready, unlock]);

  const setEnabled = useCallback(async (v: boolean) => {
    // Ausschalten nur nach erfolgreicher Authentifizierung
    if (!(await authenticate(v ? "App-Sperre aktivieren" : "App-Sperre deaktivieren"))) return false;
    await setSecret(KEYS.appLock, v ? "1" : "0");
    setEnabledState(v);
    return true;
  }, []);

  const showLock = native && active && (!ready || (enabled && locked));

  return (
    <Ctx.Provider value={{ available, enabled, setEnabled }}>
      {children}
      {(showLock || (native && shield && active)) && (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.bg }]} accessibilityViewIsModal>
          <View style={[styles.mark, { backgroundColor: c.accent }]}>
            <Text style={styles.markText}>✓</Text>
          </View>
          <Text style={[styles.title, { color: c.text }]}>Steuerklar</Text>
          {showLock && ready && (
            <>
              <Text style={[styles.sub, { color: c.muted }]}>Deine Steuerdaten sind geschützt.</Text>
              <Pressable onPress={unlock} style={[styles.btn, { backgroundColor: c.accent }]} accessibilityRole="button">
                <Text style={styles.btnText}>Entsperren</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </Ctx.Provider>
  );
}

/** Verhindert Screenshots/Bildschirmaufnahmen auf besonders sensiblen Screens (Android: FLAG_SECURE). */
export function useSensitiveScreen(key: string) {
  useEffect(() => {
    if (!native) return;
    ScreenCapture.preventScreenCaptureAsync(key).catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync(key).catch(() => {});
    };
  }, [key]);
}

const styles = StyleSheet.create({
  overlay: { alignItems: "center", justifyContent: "center", zIndex: 1000, elevation: 1000, gap: 10 },
  mark: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  markText: { color: "#fff", fontSize: 38, fontWeight: "700" },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  sub: { fontSize: 15 },
  btn: { marginTop: 18, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
