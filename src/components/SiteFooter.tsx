export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <p>
          Steuerklar ist eine Software zur Erstellung der eigenen Steuererklärung (Hilfe zur Selbsthilfe). Sie erbringt keine
          Steuerberatung im Sinne des Steuerberatungsgesetzes. Alle Berechnungen sind Prognosen; maßgeblich ist der Bescheid des Finanzamts.
        </p>
        <p>Die Belegerkennung erfolgt KI-gestützt. Bitte prüfe alle erkannten Werte vor der Übernahme.</p>
        <p>© {new Date().getFullYear()} Steuerklar · Impressum · Datenschutz · AGB</p>
      </div>
    </footer>
  );
}
