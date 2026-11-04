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
| Steuer-Engine Österreich (Tarif 2021–2026 inkl. Sonderregeln 2022/2023 und Teuerungsabsetzbetrag, Vermietung E1b (AfA inkl. beschleunigter AfA, Instandsetzung 1/15), Selbständige/Gewerbe E1a (Pauschalierungen, Gewinnfreibetrag), Veranlagungsfreibetrag, Pensionen & Pensionistenabsetzbetrag, Unterhaltsabsetzbetrag, Regelbesteuerungsoption Kapitalerträge, Behinderung, Fristen, Lohnzettel L16, Werbungskosten + Pauschale, Pendlerpauschale/-euro, Telearbeit, Sonderausgaben, Selbstbehalt §34, Familienbonus Plus, AVAB/AEAB, VAB + Zuschlag, SV-Rückerstattung, sonstige Bezüge §67) | `src/lib/tax/calculate.ts`, `constants.ts`, Tests in `calculate.test.ts` |
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

## Was die App statt der Steuerberatung übernimmt

| Bereich | Umsetzung |
|---|---|
| Erklärung | L1, L1k, L1i, E1, E1a, E1b, E1kv, U1 – Kennzahlen als Ausfüllhilfe, PDF |
| Belege | Foto/PDF → KI erkennt Lohnzettel und Rechnungen; Kontoauszug-Import findet Absetzbares |
| Buchhaltung | Einnahmen-Ausgaben-Journal (`/app/buchhaltung`): Beleg fotografieren → KI schlägt Kategorie, Netto, Vorsteuer vor; Privatanteil, Bewirtung 50 %, Zufluss-Abfluss; Summen fließen in E1a/U1; CSV-Export |
| Optimierung | Spar-Check, Regelbesteuerungs-/Verlustausgleichsoption, Gewinnfreibeträge, Anlagenverzeichnis (AfA, GWG, Pkw) |
| Planung | Rücklagen-Planer: ESt-Vorauszahlungen, SVS-Beiträge, UVA-Zahllast; alle Termine als Kalender (`/api/calendar?alle=1`) |
| Nach der Abgabe | **Bescheid prüfen** (`/api/finanzamt/bescheid`): Bescheid auslesen, mit eigener Berechnung vergleichen, Beschwerde-Entwurf nach §§ 243/250 BAO mit Frist (§ 245 BAO, § 108 BAO inkl. Feiertage) und ggf. Aussetzungsantrag (§ 212a BAO) |
| Post vom Amt | **Brief erklären** (`/api/finanzamt/post`): Ergänzungsersuchen, Vorhalt, Zahlungsaufforderung … → Zusammenfassung, Schritte, Unterlagen, Antwort-Entwurf |
| Anträge | Herabsetzung der Vorauszahlungen (§ 45 Abs. 4 EStG), Fristverlängerungen (§ 245 Abs. 3, § 134 Abs. 2 BAO), Ratenzahlung/Stundung (§ 212 BAO), Rückzahlung (§ 239 BAO) |
| Sonderfälle | AMS-Bezüge mit Hochrechnung und Kontrollrechnung (§ 3 Abs. 2 EStG), Krypto/ausländische Depots ohne KESt (27,5 %, E1kv), Spekulationsgeschäfte und gelegentliche Leistungen mit Freigrenzen |
| Fragen | KI-Steuerassistent mit Fallkontext |

**Bleibt der Steuerberatung vorbehalten (WTBG 2017):** Vertretung vor Finanzamt und Bundesfinanzgericht, Außenprüfungen,
Finanzstrafverfahren, Haftung für die Richtigkeit. Die App weist bei solchen Schreiben ausdrücklich darauf hin.

## Vor dem Produktivbetrieb (offen)

1. **Recht:** Positionierung als Selbsthilfe-Software (keine Steuerberatung i. S. d. WTBG 2017) anwaltlich prüfen lassen; AGB,
   Datenschutzerklärung, Impressum (ECG/MedienG), AVV mit Anthropic und Hoster.
2. **Steuerwerte verifizieren:** In `src/lib/tax/constants.ts` listet `unverified` je Jahr die Werte, die nur aus Sekundärquellen stammen
   (u. a. Höchstbeträge der SV-Rückerstattung, Einschleifgrenzen des VAB-Zuschlags 2026, Partner-Einkommensgrenze AVAB). Zuordnung
   der L1-Kennzahlen (`WK_KATEGORIEN`, Formular-Einträge) gegen das aktuelle Formular L1 prüfen. Annahme prüfen: KZ 245 ist um KZ 718 gekürzt.
3. **Vereinfachungen:** Kindermehrbetrag vereinfacht; einzelne Pensions-Höchstbeträge geschätzt (siehe `unverified`); SVS-Werte
   (Beitragssätze, Mindest-/Höchstbeitragsgrundlage) und UVA-Grenzen in `SVS`/`UVA` jährlich prüfen.
   Nicht abgedeckt: Jahressechstel-Überschreitung, Bilanzierung (doppelte Buchhaltung), GmbH/Körperschaftsteuer, Lohnverrechnung
   für Dienstnehmer:innen. E1a-Kennzahlen sind nur für Erlöse (9040), Waren (9100), Fremdleistungen (9110) und Personal (9120) hinterlegt – die übrigen ändert das BMF je Jahr und müssen gegen das Formular geprüft werden.

4. **Übermittlung:** Eine direkte Abgabe in FinanzOnline durch Drittsoftware ist für Privatpersonen nicht vorgesehen – die App liefert
   eine Ausfüllhilfe mit Kennzahlen. Option: Kooperation mit Steuerberatungskanzlei (Vollmacht) für die Übermittlung.
5. **Infrastruktur:** PostgreSQL in EU-Region, Master Key in KMS (mit Rotation), Rate Limiting über Redis, Pen-Test, Monitoring.
6. **Native Apps:** siehe `mobile/README.md` (EAS Build, Store-Einreichung, Certificate Pinning).
