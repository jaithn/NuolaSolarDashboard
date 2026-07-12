// Security-Header fuer alle Antworten (Seiten + API-Routen). HSTS wird hier
// bewusst NICHT gesetzt - TLS terminiert am vorgelagerten nginx, dort gehoert
// auch der Strict-Transport-Security-Header hin (siehe README/Audit-Hinweise).
//
// CSP: 'unsafe-inline' fuer script-src ist fuer die Inline-Bootstrap-Skripte
// des Next.js App Routers noetig (ohne Nonce-Infrastruktur); style-src
// 'unsafe-inline' fuer React-Inline-Styles/recharts. Verbietet trotzdem
// Fremd-Quellen, Objekt-Einbettung, Framing und fremde Form-Targets.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Von GitHub abgeleitete Anzeige-Version. Bevorzugt eine im Build gesetzte
// NEXT_PUBLIC_APP_VERSION (CI: exakte Release-/Image-Version), sonst lokal aus
// `git describe --tags --always`, sonst die package.json-Version. Der Wert wird
// zur Build-Zeit in den Client inlined (siehe src/lib/version.ts). In Docker
// steht i.d.R. kein Git zur Verfuegung -> dort MUSS die CI den Build-Arg setzen.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function ermittleAppVersion() {
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION;
  try {
    return execSync("git describe --tags --always --dirty", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    try {
      return JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
    } catch {
      return "unbekannt";
    }
  }
}
const APP_VERSION = ermittleAppVersion();

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@react-pdf/renderer", "@prisma/client"],
  poweredByHeader: false,
  // In den Client inlinen, damit die Version im Admin ohne Laufzeit-Git angezeigt
  // werden kann (Standalone-/Docker-Build).
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
