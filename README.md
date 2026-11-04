# Steuerklar (Arbeitstitel)

**Österreich:** Belege fotografieren → KI erkennt alle Werte → Nutzer:in prüft → fertige Arbeitnehmerveranlagung (L1/L1k-Kennzahlen
für FinanzOnline) + Gutschrift-Prognose. Web-App (Next.js, auch als PWA) und native App für iOS/Android (`mobile/`, Expo).

## Schnellstart

```bash
npm install
cp .env.example .env.local        # DATA_ENCRYPTION_KEY setzen: npm run gen:key
npm run dev                       # http://localhost:3000
npm test                          # Tests der Steuer-Engine
npm run build && npm start        # Produktion
```

Ohne `ANTHROPIC_API_KEY` läuft die Belegerkennung im **Demo-Modus** (liefert einen Beispiel-Lohnzettel L16).

## Demo als Claude-Artifact (ohne Server)

`node demo/build.mjs` baut dieselbe Oberfläche als reine Browser-App (`demo/dist`). Steuer-Engine, Beleg-Übernahme und
PDF laufen im Browser; Belege erkennt Claude über die `sample`-Capability des Artifacts, Daten liegen privat pro Person
(`db`-Capability unter `data/users/<id>/`). Die Next.js-Seiten werden unverändert wiederverwendet, nur `next/link`,
`next/navigation` und `@/lib/client/api` werden beim Bauen durch `demo/shims` bzw. `demo/api.ts` ersetzt.

## Architektur

| Bereich | Datei(en) |
|---|---|
| Steuer-Engine Österreich (Tarif 2021–2026 inkl. Sonderregeln 2022/2023, Pensionen & Pensionistenabsetzbetrag, Unterhaltsabsetzbetrag, Regelbesteuerungsoption Kapitalerträge, Behinderung, Fristen, Lohnzettel L16, Werbungskosten + Pauschale, Pendlerpauschale/-euro, Telearbeit, Sonderausgaben, Selbstbehalt §34, Familienbonus Plus, AVAB/AEAB, VAB + Zuschlag, SV-Rückerstattung, sonstige Bezüge §67) | `src/lib/tax/calculate.ts`, `constants.ts`, Tests in `calculate.test.ts` |
| KI-Belegerkennung (Claude Vision + Structured Outputs, Plausibilisierung, keine SV-Nummern) | `src/lib/ai/extract.ts`, `schema.ts` |
| Beleg → Erklärung (nur nach Bestätigung durch Nutzer:in) | `src/lib/tax/apply.ts` |
| Spar-Check (Euro-Wirkung je Abzug, Tipps) | `src/lib/tax/insights.ts` |
| KI-Steuerassistent (Chat) | `src/lib/ai/assistant.ts`, `src/app/api/assistant` |
| Kontoauszug-Import (CSV → absetzbare Ausgaben) | `src/lib/ai/bank.ts`, `src/app/api/bank-import` |
| Auth, Sessions (Web-Cookie / Mobile-Bearer-Token), 2FA, Audit-Log | `src/lib/server/auth.ts`, `src/lib/security/crypto.ts` |
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
- **Sessions:** Web: `__Host-`-Cookie, HttpOnly, Secure, SameSite=Strict, 30 min Leerlauf / 12 h absolut. App: Bearer-Token im Keychain/Keystore, 14 Tage Leerlauf / 30 Tage absolut plus Face-ID-/Fingerabdruck-Sperre. Serverseitig nur Hash gespeichert; Web- und App-Tokens sind nicht austauschbar.
- **Web:** Strikte CSP mit Nonce + `strict-dynamic`, HSTS, `frame-ancestors 'none'`, COOP/CORP, Origin- und Sec-Fetch-Site-Prüfung, Zod-Validierung aller Eingaben, keine internen Fehlerdetails nach außen.
- **KI:** Dokumentinhalte werden als Daten behandelt (Prompt-Injection-Regel), Ausgabe per Schema erzwungen und serverseitig plausibilisiert; jeder Wert muss bestätigt werden.

## Vor dem Produktivbetrieb (offen)

1. **Recht:** Positionierung als Selbsthilfe-Software (keine Steuerberatung i. S. d. WTBG 2017) anwaltlich prüfen lassen; AGB,
   Datenschutzerklärung, Impressum (ECG/MedienG), AVV mit Anthropic und Hoster.
2. **Steuerwerte verifizieren:** In `src/lib/tax/constants.ts` listet `unverified` je Jahr die Werte, die nur aus Sekundärquellen stammen
   (u. a. Höchstbeträge der SV-Rückerstattung, Einschleifgrenzen des VAB-Zuschlags 2026, Partner-Einkommensgrenze AVAB). Zuordnung
   der L1-Kennzahlen (`WK_KATEGORIEN`, Formular-Einträge) gegen das aktuelle Formular L1 prüfen. Annahme prüfen: KZ 245 ist um KZ 718 gekürzt.
3. **Vereinfachungen:** Kindermehrbetrag vereinfacht; 2022 ohne Teuerungsabsetzbetrag; Pensions-Einschleifgrenzen 2022/2024
   und SV-Rückerstattung für Pensionist:innen geschätzt. Nicht abgedeckt: Selbständige und Vermietung (Formular E1),
   Verlustausgleichsoption Kapital, Jahressechstel-Überschreitung, Auslandseinkünfte.
4. **Übermittlung:** Eine direkte Abgabe in FinanzOnline durch Drittsoftware ist für Privatpersonen nicht vorgesehen – die App liefert
   eine Ausfüllhilfe mit Kennzahlen. Option: Kooperation mit Steuerberatungskanzlei (Vollmacht) für die Übermittlung.
5. **Infrastruktur:** PostgreSQL in EU-Region, Master Key in KMS (mit Rotation), Rate Limiting über Redis, Pen-Test, Monitoring.
6. **Native Apps:** siehe `mobile/README.md` (EAS Build, Store-Einreichung, Certificate Pinning).
