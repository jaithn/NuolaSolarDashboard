import type { SessionOptions } from "iron-session";

export type Rolle = "ADMIN" | "MIETER";

export interface SessionData {
  userId?: string;
  role?: Rolle;
  mustChangePassword?: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt.`);
  }
  return value;
}

// Bewusst als Funktion statt als Modul-Level-Konstante: next build fuehrt
// beim "Collecting page data"-Schritt einen Teil des Route-Modul-Codes aus,
// um Metadaten zu sammeln - zu diesem Zeitpunkt ist noch keine .env-Datei
// geladen (die kommt erst zur Laufzeit ins Docker-Volume). Wuerde
// requireEnv("SESSION_SECRET") beim Modul-Import ausgewertet, wuerde der
// Build immer fehlschlagen, egal wie die Laufzeitumgebung spaeter aussieht.
export function getSessionOptions(): SessionOptions {
  return {
    password: requireEnv("SESSION_SECRET"),
    cookieName: "nuola_session",
    // Explizite Session-Lebensdauer (7 Tage) statt iron-session-Default (14):
    // begrenzt das Zeitfenster, in dem ein entwendetes Cookie nutzbar ist.
    ttl: 60 * 60 * 24 * 7,
    cookieOptions: {
      httpOnly: true,
      // Standard: im Produktivbetrieb "Secure" (Cookie nur ueber HTTPS). Hinter
      // dem vorgelagerten nginx mit HTTPS ist das korrekt und soll so bleiben.
      // COOKIE_INSECURE=true schaltet es NUR fuer internes Testen ueber http://
      // (z.B. direkter LAN-IP-Zugriff ohne TLS) ab - Browser speichern ein
      // "Secure"-Cookie sonst nicht, wodurch der Login sofort verloren geht.
      secure: process.env.COOKIE_INSECURE === "true" ? false : process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  };
}
