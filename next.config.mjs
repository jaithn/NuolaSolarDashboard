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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
