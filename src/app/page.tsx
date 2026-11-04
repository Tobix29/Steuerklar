import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

const features = [
  { icon: "📸", title: "Fotografieren statt abtippen", text: "Lohnzettel, Rechnungen für Arbeitsmittel, Fortbildungen, Arztrechnungen – einfach ein Foto oder PDF. Die KI erkennt Belegart und Beträge." },
  { icon: "🧮", title: "Rechnet wie das Finanzamt", text: "Aktueller Tarif mit allen Absetzbeträgen: Verkehrsabsetzbetrag, Pendlereuro, Familienbonus Plus, Alleinverdiener-/Alleinerzieherabsetzbetrag, SV-Rückerstattung." },
  { icon: "✅", title: "Du behältst die Kontrolle", text: "Jeder erkannte Wert wird dir zur Prüfung vorgelegt. Erst wenn du bestätigst, fließt er in deine Veranlagung ein." },
  { icon: "💡", title: "Findet, was du vergisst", text: "Pendlerpauschale, Telearbeitspauschale, Homeoffice-Mobiliar, Familienbonus: Steuerklar zeigt dir, wo noch Geld liegt." },
  { icon: "🏛️", title: "Fertig für FinanzOnline", text: "Du bekommst jede Eintragung mit der richtigen Kennzahl für L1 und L1k – in wenigen Minuten in FinanzOnline übertragen." },
  { icon: "📱", title: "App für iPhone & Android", text: "Native App mit Kamera-Scan, Face ID und Fingerabdruck – oder bequem im Browser." },
];

const security = [
  { icon: "🔐", title: "Verschlüsselt gespeichert", text: "Alle Steuerdaten liegen mit AES-256-GCM verschlüsselt vor – mit einem eigenen Schlüssel pro Konto (Envelope Encryption). Übertragung nur per TLS." },
  { icon: "🗑️", title: "Keine Belegfotos gespeichert", text: "Fotos werden nur im Arbeitsspeicher verarbeitet, Metadaten (z. B. GPS) entfernt und danach sofort verworfen." },
  { icon: "🛡️", title: "Zwei-Faktor & Face ID", text: "Argon2id-Passwort-Hashing, TOTP-2FA, App-Sperre per Face ID/Fingerabdruck, Schlüssel im Secure Enclave/Keystore." },
  { icon: "🇪🇺", title: "DSGVO by Design", text: "Datensparsam, Export und vollständige Löschung per Klick, Audit-Log ohne Klartext-IP-Adressen." },
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="hero container">
          <p className="eyebrow">Arbeitnehmerveranlagung {new Date().getFullYear() - 1} · Österreich</p>
          <h1 className="display">
            Steuerausgleich.
            <br />
            <span className="gradient-text">Einfach fotografiert.</span>
          </h1>
          <p className="lead">
            Belege fotografieren, die KI erkennt jeden Wert, du prüfst kurz – und weißt sofort, wie viel dir das Finanzamt zurückzahlt.
            Mit allen Kennzahlen für FinanzOnline.
          </p>
          <div className="hero-cta">
            <Link href="/registrieren" className="btn btn-lg">
              Kostenlos starten
            </Link>
            <a href="#so-gehts" className="btn-ghost link-arrow">
              So funktioniert’s
            </a>
          </div>

          <div className="device-stage" aria-hidden="true">
            <div className="float-card a">
              <div className="row" style={{ gap: 12 }}>
                <div className="icon-tile">💼</div>
                <div>
                  <div className="small" style={{ fontWeight: 600 }}>Lohnzettel L16</div>
                  <div className="tiny muted">11 Kennzahlen erkannt · geprüft</div>
                </div>
                <span className="badge badge-green">✓</span>
              </div>
            </div>
            <div className="float-card b">
              <div className="tiny muted">Familienbonus Plus</div>
              <div className="title-2 num">− 2.000,16 €</div>
              <div className="tiny muted">pro Kind und Jahr</div>
            </div>
            <div className="phone">
              <div className="phone-screen">
                <div className="phone-island" />
                <div className="tiny muted">Steuerjahr 2025</div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Übersicht</div>
                <div className="card" style={{ marginTop: 14, padding: 18, textAlign: "center" }}>
                  <div className="tiny muted">Voraussichtliche Gutschrift</div>
                  <div className="refund num" style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.04em" }}>1.284 €</div>
                  <div className="progress" style={{ marginTop: 12 }}><div style={{ width: "80%" }} /></div>
                </div>
                <div className="list" style={{ marginTop: 14 }}>
                  {[["💼", "Bruttobezüge", "50.000 €"], ["🚆", "Pendlerpauschale", "696 €"], ["💻", "Arbeitsmittel", "640 €"], ["👶", "Familienbonus", "2.000 €"]].map(([i, l, v]) => (
                    <div className="list-item" key={l} style={{ padding: "10px 14px", minHeight: 0 }}>
                      <span>{i}</span>
                      <span className="grow small">{l}</span>
                      <span className="value small">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="btn btn-block" style={{ marginTop: 14 }}>📸 Beleg fotografieren</div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section-white" id="so-gehts">
          <div className="container">
            <p className="eyebrow center">So geht’s</p>
            <h2 className="headline center">Drei Schritte. Ein paar Minuten.</h2>
            <div className="grid grid-3" style={{ marginTop: 56 }}>
              {[
                ["Fragen beantworten", "Arbeitsweg, Telearbeit, Kinder – ein paar kurze Fragen statt Formular-Dschungel."],
                ["Belege fotografieren", "Die KI liest Lohnzettel & Rechnungen aus und ordnet alles der richtigen Kennzahl zu."],
                ["Prüfen & abgeben", "Du kontrollierst die Werte, siehst deine Gutschrift und überträgst alles in wenigen Minuten in FinanzOnline."],
              ].map(([t, d], i) => (
                <div key={t} className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
                  <div className="step-num">{i + 1}</div>
                  <h3 className="title-2">{t}</h3>
                  <p className="muted" style={{ margin: 0 }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="funktionen">
          <div className="container">
            <p className="eyebrow center">Funktionen</p>
            <h2 className="headline center">Alles, was du brauchst.</h2>
            <p className="lead center" style={{ maxWidth: 640, margin: "16px auto 0" }}>
              Für Arbeitnehmer:innen und Familien in Österreich – mit den Rechenregeln, die das Finanzamt anwendet.
            </p>
            <div className="grid grid-3" style={{ marginTop: 56 }}>
              {features.map((f) => (
                <div className="feature card-hover" key={f.title}>
                  <div className="icon-tile">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-dark" id="sicherheit">
          <div className="container">
            <p className="eyebrow center" style={{ color: "#2997ff" }}>Sicherheit</p>
            <h2 className="headline center">Deine Daten. Nur deine.</h2>
            <p className="lead center" style={{ maxWidth: 640, margin: "16px auto 0" }}>
              Steuerdaten gehören zu den sensibelsten Daten überhaupt. Deshalb ist Sicherheit bei uns kein Feature, sondern das Fundament.
            </p>
            <div className="grid grid-2" style={{ marginTop: 56 }}>
              {security.map((f) => (
                <div className="feature" key={f.title}>
                  <div className="icon-tile" style={{ background: "#2c2c2e" }}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="container container-narrow">
            <h2 className="headline center" style={{ marginBottom: 40 }}>Häufige Fragen</h2>
            <div className="faq">
              <details>
                <summary>Ersetzt Steuerklar meine Steuerberatung?</summary>
                <p>
                  Steuerklar ist eine Software zur Selbsthilfe: Du machst deine Arbeitnehmerveranlagung selbst, die App unterstützt dich beim
                  Erfassen und Berechnen. Für typische Arbeitnehmer-Fälle brauchst du damit meist keine Beratung. Bei Selbständigkeit, Vermietung
                  oder Sonderfällen empfehlen wir weiterhin eine Steuerberatung oder die Arbeiterkammer.
                </p>
              </details>
              <details>
                <summary>Bekomme ich den Bescheid von Steuerklar?</summary>
                <p>
                  Den Einkommensteuerbescheid erlässt ausschließlich das Finanzamt Österreich. Steuerklar berechnet voraus, was im Bescheid
                  stehen wird, und sagt dir genau, was du in FinanzOnline (Formular L1 bzw. L1k) eintragen musst.
                </p>
              </details>
              <details>
                <summary>Muss ich meinen Lohnzettel eintragen?</summary>
                <p>
                  Nein – den Lohnzettel (L16) übermittelt dein Arbeitgeber direkt ans Finanzamt. Wir lesen ihn nur aus, um deine Gutschrift
                  exakt zu berechnen. Eintragen musst du nur Werbungskosten, Sonderausgaben, Krankheitskosten und den Familienbonus.
                </p>
              </details>
              <details>
                <summary>Was passiert mit meinen Fotos?</summary>
                <p>
                  Fotos werden verschlüsselt übertragen, im Arbeitsspeicher von Metadaten befreit, zur Erkennung verarbeitet und anschließend
                  verworfen. Gespeichert werden nur die erkannten Werte – verschlüsselt mit deinem persönlichen Schlüssel.
                </p>
              </details>
              <details>
                <summary>Für welche Jahre funktioniert Steuerklar?</summary>
                <p>Für die Veranlagungsjahre 2024 und 2025, 2026 als Prognose. Die Arbeitnehmerveranlagung kannst du bis zu fünf Jahre rückwirkend machen.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="section-tight center">
          <div className="container">
            <h2 className="headline">Bereit für deine Gutschrift?</h2>
            <p className="lead" style={{ marginTop: 12 }}>Die meisten Arbeitnehmer:innen bekommen beim Steuerausgleich Geld zurück.</p>
            <div className="hero-cta">
              <Link href="/registrieren" className="btn btn-lg">Jetzt starten</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
