// Prueft, ob die App ueber den in APP_BASE_URL konfigurierten Host aufgerufen
// wird. Wird sie ueber einen anderen Host erreicht (z.B. direkt per LAN-IP
// statt ueber die konfigurierte Domain), liefert checkAppHost ok:false - die
// Middleware zeigt dann eine erklaerende Fehlerseite. Reine Funktion (kein
// Next/Request), damit sie isoliert testbar ist.

export interface AppHostResult {
  ok: boolean;
  expectedHost?: string;
  actualHost?: string;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
// Platzhalter aus .env.example - solange die konfigurierte Domain nicht auf
// einen echten Wert geaendert wurde, wird nichts erzwungen.
const PLACEHOLDER_HOSTS = new Set(["mieterportal.example.com", "example.com"]);

/** Extrahiert den reinen Hostnamen (ohne Port) in Kleinschreibung. */
export function normalizeHost(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (LOCAL_HOSTS.has(s)) return s;
  if (s.startsWith("[")) {
    // [ipv6] bzw. [ipv6]:port
    const end = s.indexOf("]");
    return end > -1 ? s.slice(0, end + 1) : s;
  }
  const i = s.lastIndexOf(":");
  if (i > -1 && /^\d+$/.test(s.slice(i + 1))) return s.slice(0, i);
  return s;
}

export function checkAppHost(params: {
  appBaseUrl: string | undefined | null;
  actualHost: string | null | undefined;
  cookieInsecure: boolean;
}): AppHostResult {
  // Testmodus (HTTP-Zugriff per LAN-IP): Host-Erzwingung aus.
  if (params.cookieInsecure) return { ok: true };
  if (!params.appBaseUrl) return { ok: true };

  let expectedHostRaw: string;
  try {
    expectedHostRaw = new URL(params.appBaseUrl).host;
  } catch {
    return { ok: true }; // ungueltige APP_BASE_URL -> nicht erzwingen
  }

  const expected = normalizeHost(expectedHostRaw);
  if (!expected || PLACEHOLDER_HOSTS.has(expected) || LOCAL_HOSTS.has(expected)) {
    return { ok: true };
  }

  const actual = normalizeHost(params.actualHost ?? "");
  // Ohne ermittelbaren Host (bzw. lokale/Health-Zugriffe) nicht blockieren.
  if (!actual || LOCAL_HOSTS.has(actual)) return { ok: true };

  if (actual === expected) return { ok: true };

  return { ok: false, expectedHost: expected, actualHost: actual };
}
