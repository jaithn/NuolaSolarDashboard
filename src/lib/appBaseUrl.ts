import "server-only";
import { headers } from "next/headers";

/**
 * Basis-URL der Anwendung fuer absolute Links in E-Mails/Briefen. Bevorzugt
 * APP_BASE_URL (empfohlen, da eindeutig und unabhaengig vom aktuellen
 * Request). Ist die Variable nicht gesetzt, wird als Fallback der tatsaechlich
 * aufgerufene Host aus den (vom nginx gesetzten) Proxy-Headern abgeleitet,
 * damit z.B. das Anlegen eines Zugangs nicht hart mit "APP_BASE_URL ist nicht
 * gesetzt" fehlschlaegt.
 *
 * Nur in request-gebundenen Server-Kontexten aufrufen (Server Action, Route
 * Handler) - dort ist headers() verfuegbar.
 */
export async function getAppBaseUrl(): Promise<string> {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  throw new Error(
    "APP_BASE_URL ist nicht gesetzt und der Host konnte nicht ermittelt werden. Bitte APP_BASE_URL in der .env/Container-Umgebung setzen.",
  );
}
