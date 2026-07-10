import "server-only";
import { headers } from "next/headers";

/**
 * Client-IP hinter dem vorgelagerten nginx (fuer Rate-Limiting/Brute-Force-
 * Schutz). Setzt voraus, dass der App-Port NICHT direkt aus dem Internet
 * erreichbar ist (siehe docker-compose.yml: Bind auf 127.0.0.1) und nginx die
 * Header wie in nginx.example.conf setzt.
 *
 * WICHTIG - Spoofing-Schutz: Ein Client kann seinem Request selbst einen
 * X-Forwarded-For-Header mitgeben. nginx haengt mit
 * `$proxy_add_x_forwarded_for` die ECHTE Remote-Adresse HINTEN an, ein
 * gefaelschter Wert steht also immer weiter vorne. Deshalb darf NICHT der
 * erste Eintrag verwendet werden. Bevorzugt wird X-Real-IP, das nginx auf
 * `$remote_addr` setzt und dabei einen mitgeschickten Wert ueberschreibt -
 * also nicht faelschbar.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();

  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // Fallback ohne X-Real-IP: aeusserster (letzter) X-Forwarded-For-Eintrag,
  // das ist der von nginx angehaengte, vertrauenswuerdige Wert.
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  return "unknown";
}
