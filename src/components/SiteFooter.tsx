// Globale Fußzeile für den Web-Bereich (Mieter-Portal und Admin). Verlinkt auf
// Impressum und Datenschutzerklärung, die auf der öffentlichen Homepage
// (nuola.de) liegen – dort werden sie zentral gepflegt.
//
// variant="auth": kompakte, zentrierte Zeile (ohne Flächen-Band) für die
// Login-/Auth-Seiten.
const HOMEPAGE = "https://nuola.de";

export function SiteFooter({ variant = "app" }: { variant?: "app" | "auth" }) {
  const jahr = new Date().getFullYear();

  if (variant === "auth") {
    return (
      <footer className="auth-footer">
        <span>© {jahr} Nuola Solar GbR</span>
        <nav aria-label="Rechtliches">
          <a href={`${HOMEPAGE}/impressum.html`}>Impressum</a>
          <a href={`${HOMEPAGE}/datenschutz.html`}>Datenschutz</a>
        </nav>
      </footer>
    );
  }

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <span>© {jahr} Nuola Solar GbR</span>
        <nav aria-label="Rechtliches">
          <a href={`${HOMEPAGE}/impressum.html`}>Impressum</a>
          <a href={`${HOMEPAGE}/datenschutz.html`}>Datenschutz</a>
        </nav>
      </div>
    </footer>
  );
}
