// Globale Fußzeile für den Web-Bereich (Mieter-Portal und Admin). Verlinkt auf
// Impressum und Datenschutzerklärung, die auf der öffentlichen Homepage
// (nuola.de) liegen – dort werden sie zentral gepflegt.
//
// Copyright, Impressum und Datenschutz stehen in einer Zeile, jeweils durch
// einen Mittelpunkt (·) getrennt. variant="auth": kompakt (ohne Flächen-Band)
// für die Login-/Auth-Seiten.
const HOMEPAGE = "https://nuola.de";

function Trenner() {
  return (
    <span className="footer-trenner" aria-hidden="true">
      ·
    </span>
  );
}

export function SiteFooter({ variant = "app" }: { variant?: "app" | "auth" }) {
  const jahr = new Date().getFullYear();

  const zeile = (
    <div className="footer-zeile">
      <span>© {jahr} Nuola Solar GbR</span>
      <Trenner />
      <a href={`${HOMEPAGE}/impressum.html`}>Impressum</a>
      <Trenner />
      <a href={`${HOMEPAGE}/datenschutz.html`}>Datenschutz</a>
    </div>
  );

  if (variant === "auth") {
    return <footer className="auth-footer">{zeile}</footer>;
  }

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">{zeile}</div>
    </footer>
  );
}
