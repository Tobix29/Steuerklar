import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

const features = [
  { icon: "📸", title: "Fotografieren statt abtippen", text: "Lohnsteuerbescheinigung, Spendenquittung, Handwerkerrechnung – einfach ein Foto oder PDF. Die KI erkennt Belegart und alle relevanten Werte." },
  { icon: "🧮", title: "Rechnet wie das Finanzamt", text: "Aktueller Einkommensteuertarif, Splitting, Kinder-Günstigerprüfung, Progressionsvorbehalt, Soli und Kirchensteuer – geprüft durch automatisierte Tests." },
  { icon: "✅", title: "Du behältst die Kontrolle", text: "Jeder erkannte Wert wird dir zur Prüfung vorgelegt. Erst wenn du bestätigst, fließt er in deine Erklärung ein." },
  { icon: "💡", title: "Findet, was du vergisst", text: "Homeoffice-Pauschale, Arbeitsmittel, haushaltsnahe Dienstleistungen: Steuerklar zeigt dir, wo noch Geld liegt." },
  { icon: "📄", title: "Fertig ausgefüllt", text: "Du erhältst eine vollständige Ausfüllhilfe nach amtlichen Anlagen inkl. Steuerberechnung – bereit für ELSTER." },
  { icon: "📱", title: "Web & App", text: "Im Browser oder als App auf dem Homescreen – mit Kamera-Upload direkt vom iPhone oder Android." },
];

const security = [
  { icon: "🔐", title: "Verschlüsselt gespeichert", text: "Alle Steuerdaten liegen mit AES-256-GCM verschlüsselt vor – mit einem eigenen Schlüssel pro Konto (Envelope Encryption). Übertragung nur per TLS." },
  { icon: "🗑️", title: "Keine Belegfotos gespeichert", text: "Fotos werden nur im Arbeitsspeicher verarbeitet, Metadaten (z. B. GPS) entfernt und danach sofort verworfen." },
  { icon: "🛡️", title: "Zwei-Faktor-Anmeldung", text: "Argon2id-Passwort-Hashing, optionale TOTP-2FA, Schutz vor Brute-Force, strenge Content-Security-Policy." },
  { icon: "🇪🇺", title: "DSGVO by Design", text: "Datensparsam, Export und vollständige Löschung per Klick, Audit-Log ohne Klartext-IP-Adressen." },
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="hero container">
          <p className="eyebrow">Einkommensteuererklärung {new Date().getFullYear() - 1}</p>
          <h1 className="display">
            Steuererklärung.
            <br />
            <span className="gradient-text">Einfach fotografiert.</span>
          </h1>
          <p className="lead">
            Belege fotografieren, die KI erkennt jeden Wert, du prüfst kurz – und bekommst deine fertig ausgefüllte Steuererklärung samt
            Erstattungsprognose.
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
                  <div className="small" style={{ fontWeight: 600 }}>Lohnsteuerbescheinigung</div>
                  <div className="tiny muted">14 Werte erkannt · geprüft</div>
                </div>
                <span className="badge badge-green">✓</span>
              </div>
            </div>
            <div className="float-card b">
              <div className="tiny muted">Homeoffice-Pauschale</div>
              <div className="title-2 num">+ 1.260,00 €</div>
              <div className="tiny muted">210 Tage × 6 €</div>
            </div>
            <div className="phone">
              <div className="phone-screen">
                <div className="phone-island" />
                <div className="tiny muted">Steuerjahr 2025</div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Übersicht</div>
                <div className="card" style={{ marginTop: 14, padding: 18, textAlign: "center" }}>
                  <div className="tiny muted">Voraussichtliche Erstattung</div>
                  <div className="refund num" style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.04em" }}>1.284 €</div>
                  <div className="progress" style={{ marginTop: 12 }}><div style={{ width: "80%" }} /></div>
                </div>
                <div className="list" style={{ marginTop: 14 }}>
                  {[["💼", "Arbeitslohn", "52.000 €"], ["🚗", "Fahrtkosten", "1.422 €"], ["🏠", "Homeoffice", "240 €"], ["💝", "Spenden", "150 €"]].map(([i, l, v]) => (
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
                ["Fragen beantworten", "Familienstand, Arbeitsweg, Homeoffice – ein paar kurze Fragen statt 40 Seiten Formulare."],
                ["Belege fotografieren", "Die KI liest Lohnsteuerbescheinigung & Co. aus und ordnet alles der richtigen Anlage zu."],
                ["Prüfen & fertig", "Du kontrollierst die Werte, siehst sofort deine Erstattung und lädst die fertige Erklärung herunter."],
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
              Für Arbeitnehmer:innen, Paare und Familien – mit den Rechenregeln, die das Finanzamt anwendet.
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
                  Steuerklar ist eine Software zur Selbsthilfe: Du erstellst deine Erklärung selbst, die App unterstützt dich beim Erfassen und
                  Berechnen. Für typische Arbeitnehmer-Fälle brauchst du damit meist keine Beratung. Bei Selbständigkeit, Vermietung oder
                  komplexen Sonderfällen empfehlen wir weiterhin eine Steuerberatung oder einen Lohnsteuerhilfeverein.
                </p>
              </details>
              <details>
                <summary>Bekomme ich den Steuerbescheid von Steuerklar?</summary>
                <p>
                  Den Einkommensteuerbescheid erlässt ausschließlich dein Finanzamt. Steuerklar erstellt die vollständig ausgefüllte Erklärung
                  und berechnet voraus, was im Bescheid stehen wird – inklusive Erstattung oder Nachzahlung.
                </p>
              </details>
              <details>
                <summary>Welche Belege werden erkannt?</summary>
                <p>
                  Lohnsteuerbescheinigungen, Rechnungen für Arbeitsmittel und Fortbildungen, Spendenbescheinigungen, Handwerker- und
                  Nebenkostenabrechnungen, Krankheitskosten, Kita-Rechnungen sowie Elterngeld- und ALG-Bescheide.
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
                <p>Für die Steuerjahre 2024 und 2025. 2026 steht als Prognose zur Verfügung.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="section-tight center">
          <div className="container">
            <h2 className="headline">Bereit für deine Erstattung?</h2>
            <p className="lead" style={{ marginTop: 12 }}>Die meisten Arbeitnehmer:innen bekommen Geld zurück – oft mehrere hundert Euro.</p>
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
