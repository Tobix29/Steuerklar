# Steuerklar – native App (iOS & Android)

Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript. Spricht mit dem Next.js-Backend im Projektwurzelverzeichnis.

## Entwicklung

```bash
cd mobile
npm install
cp .env.example .env            # EXPO_PUBLIC_API_URL setzen
npx expo start                  # Dev-Server; App mit Development Build öffnen
```

- Backend lokal: `npm run dev` im Projektwurzelverzeichnis (Port 3000).
- Android-Emulator erreicht den Rechner unter `http://10.0.2.2:3000`, ein echtes Gerät unter der LAN-IP.
- Die App nutzt native Module (SecureStore, LocalAuthentication, ScreenCapture …) → **Development Build** statt Expo Go:
  `npx expo run:ios` / `npx expo run:android` (lokal) oder `npx eas-cli@latest build --profile development`.
- Typprüfung: `npm run typecheck` · Diagnose: `npm run doctor`.
- Web-Vorschau (nur zum Ansehen, nicht für Produktion): `npm run export:web`.

## Store-Builds (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile production      # App Store (kein Mac nötig)
npx eas-cli@latest build --platform android --profile production  # Play Store (AAB)
npx eas-cli@latest submit --platform ios|android
```

Vorher in `eas.json` die echte Backend-URL (`https://…`) eintragen. Bundle-ID/Package: `at.steuerklar.app`.
Für den App-Store-Review: Datenschutz-Angaben (App Privacy) entsprechend dem Privacy-Manifest in `app.json` ausfüllen,
Demo-Zugang bereitstellen, Hinweis „Software zur Selbsthilfe, keine Steuerberatung“ in der Beschreibung.

## Struktur

| Pfad | Inhalt |
|---|---|
| `src/app/(auth)` | Anmelden (inkl. 2FA-Code), Registrieren |
| `src/app/(tabs)/*` | Übersicht, Über dich, Belege, Ergebnis, Konto – je eigener Stack mit großem Titel, native Tab-Leiste |
| `src/app/beleg/[id].tsx` | Prüf-Dialog für erkannte Belege (Modal) |
| `src/lib/api.ts` | API-Client (Bearer-Token, Upload, PDF-Download) |
| `src/lib/session.tsx`, `secureStorage.ts` | Sitzung, Keychain/Keystore |
| `src/lib/appLock.tsx` | Face ID/Fingerabdruck-Sperre, Sichtschutz, Screenshot-Schutz |
| `src/lib/case.tsx` | Steuerfall laden/speichern (Autosave) |
| `src/lib/types.ts` | Typen aus dem Backend (`import type` aus `../src/lib`) |

## Sicherheit

- **Token nur im Keychain/Keystore** (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) – nie in AsyncStorage, nicht in Backups.
  MFA-pendente Tokens werden nicht persistiert. Server: eigene Mobile-Sitzungsart (14 Tage Leerlauf / 30 Tage absolut), Web- und App-Tokens sind nicht austauschbar.
- **App-Sperre** per Face ID / Touch ID / Fingerabdruck / Geräte-Code beim Start und nach > 60 s im Hintergrund (Standard: an). Ausschalten erfordert Authentifizierung.
- **Sichtschutz:** Overlay, sobald die App inaktiv ist; iOS zusätzlich native Weichzeichnung im App-Umschalter; Screenshot-/Aufnahmeschutz auf Beleg- und Ergebnis-Screens (Android `FLAG_SECURE`).
- **Nur HTTPS** in Produktions-Builds (http-URL → Konfigurationsfehler statt Klartext-Verbindung); iOS ATS ohne Ausnahmen, Android ohne Cleartext.
- **Datensparsamkeit:** Fotos werden vor dem Upload auf 2000 px verkleinert und neu kodiert (entfernt EXIF/GPS), lokale Kopien nach dem Upload gelöscht, PDFs nach dem Teilen aus dem Cache entfernt.
- Android: `allowBackup: false`, unnötige Berechtigungen (Mikrofon, Standort, Speicher) blockiert.

### Nächste Schritte

1. **Certificate Pinning** (Public-Key-Pinning auf das Backend-Zertifikat) – benötigt einen Development/Production Build mit Config-Plugin
   (z. B. `react-native-ssl-public-key-pinning`), in Expo Go nicht möglich.
2. Jailbreak/Root-Erkennung und App Attest / Play Integrity für API-Aufrufe.
3. Push-Benachrichtigungen (z. B. „Bescheid da?“), Offline-Entwürfe verschlüsselt.
4. 2FA-QR-Code direkt in der App anzeigen (aktuell: Schlüssel + „In Authenticator-App öffnen“).
