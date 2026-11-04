# Steuerklar (Arbeitstitel)

Belege fotografieren → KI erkennt alle Werte → Nutzer:in prüft → fertig ausgefüllte Einkommensteuererklärung + Erstattungsprognose.
Web-App und installierbare App (PWA, Kamera-Upload) für Arbeitnehmer:innen, Paare und Familien.

## Schnellstart

```bash
npm install
cp .env.example .env.local        # DATA_ENCRYPTION_KEY setzen: npm run gen:key
npm run dev                       # http://localhost:3000
npm test                          # Tests der Steuer-Engine
npm run build && npm start        # Produktion
```

Ohne `ANTHROPIC_API_KEY` läuft die Belegerkennung im **Demo-Modus** (liefert eine Beispiel-Lohnsteuerbescheinigung).

## Architektur

| Bereich | Datei(en) |
|---|---|
| Steuer-Engine (Tarif 2024–2026, Splitting, Soli, KiSt, Kinder-Günstigerprüfung, §35a, §33, Progressionsvorbehalt) | `src/lib/tax/calculate.ts`, `constants.ts`, Tests in `calculate.test.ts` |
| KI-Belegerkennung (Claude Vision + Structured Outputs, Plausibilisierung, Steuer-ID-Prüfziffer) | `src/lib/ai/extract.ts`, `schema.ts` |
| Beleg → Erklärung (nur nach Bestätigung durch Nutzer:in) | `src/lib/tax/apply.ts` |
| Auth, Sessions, 2FA, Audit-Log | `src/lib/server/auth.ts`, `src/lib/security/crypto.ts` |
| API-Schutz (CSRF/Origin, Rate Limits, Validierung) | `src/lib/server/guard.ts` |
| Upload-Härtung (Magic Bytes, Re-Encoding, EXIF-Entfernung) | `src/lib/server/upload.ts` |
| Ausfüllhilfe-PDF | `src/lib/server/pdf.ts` |
| CSP mit Nonce, Security-Header | `src/proxy.ts`, `next.config.ts` |
| UI | `src/app/**`, Design-System in `src/app/globals.css` |

## Sicherheitskonzept

- **Verschlüsselung at rest:** AES-256-GCM, Envelope Encryption mit eigenem Data Key pro Konto, AAD bindet Chiffrat an Nutzer + Datensatz. E-Mail nur verschlüsselt + als HMAC-Blind-Index gespeichert.
- **Kontolöschung = Crypto-Shredding** (Data Key wird vernichtet), Datenexport nach Art. 20 DSGVO.
- **Belegfotos werden nie gespeichert**; nur im Speicher verarbeitet, neu kodiert (entfernt GPS/EXIF, neutralisiert Polyglot-Dateien), Pixel-Limit gegen Decompression Bombs.
- **Passwörter:** Argon2id (OWASP-Parameter), Mindestlänge 12, Sperre nach 5 Fehlversuchen, konstantes Timing gegen User-Enumeration.
- **2FA:** TOTP (RFC 6238) mit Replay-Schutz; beim Aktivieren werden alle anderen Sitzungen beendet.
- **Sessions:** `__Host-`-Cookie, HttpOnly, Secure, SameSite=Strict; serverseitig, nur Hash gespeichert; 30 min Leerlauf / 12 h absolut.
- **Web:** Strikte CSP mit Nonce + `strict-dynamic`, HSTS, `frame-ancestors 'none'`, COOP/CORP, Origin- und Sec-Fetch-Site-Prüfung, Zod-Validierung aller Eingaben, keine internen Fehlerdetails nach außen.
- **KI:** Dokumentinhalte werden als Daten behandelt (Prompt-Injection-Regel), Ausgabe per Schema erzwungen und serverseitig plausibilisiert; jeder Wert muss bestätigt werden.

## Vor dem Produktivbetrieb (offen)

1. **Recht:** Positionierung als Selbsthilfe-Software (keine Hilfeleistung in Steuersachen i. S. d. §§ 2, 5 StBerG) anwaltlich prüfen lassen; AGB, Datenschutzerklärung, Impressum, AVV mit Anthropic und Hoster.
2. **ELSTER-Übermittlung:** Registrierung als Softwarehersteller bei ELSTER und Integration der ERiC-Bibliothek (heute: PDF-Ausfüllhilfe zur Übertragung in Mein ELSTER).
3. **Steuerwerte:** Werte in `constants.ts` für 2026 sind als vorläufig markiert; Zeilen-/Kennzahl-Zuordnung gegen die amtlichen Vordrucke des jeweiligen Jahres prüfen.
4. **Infrastruktur:** PostgreSQL in EU-Region, Master Key in KMS (mit Rotation), Rate Limiting über Redis, Pen-Test, Monitoring.
5. **Native Apps:** PWA läuft bereits; für App Store / Play Store mit Capacitor verpacken.
6. **Fachlicher Umfang:** Noch nicht abgedeckt: Selbständige, Vermietung, Kapitalerträge, Renten, Verlustvorträge, doppelte Haushaltsführung, Behinderten-Pauschbetrag.
