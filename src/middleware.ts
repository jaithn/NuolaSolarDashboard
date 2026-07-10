import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/auth/session";
import { checkAppHost } from "@/lib/appHost";

/** HTML-Escaping - der Host-Header ist client-kontrolliert, daher pflichtig. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrongHostResponse(appBaseUrl: string, expectedHost: string, actualHost: string): NextResponse {
  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Falsche Adresse</title></head>
<body style="font-family: 'IBM Plex Sans', system-ui, sans-serif; max-width: 36rem; margin: 3rem auto; padding: 0 1rem; color: #1c1c21;">
  <h1 style="color:#a2762b;">Falsche Adresse</h1>
  <p>Dieses Portal ist für die Adresse <strong>${escapeHtml(expectedHost)}</strong> konfiguriert,
  wurde aber über <strong>${escapeHtml(actualHost)}</strong> aufgerufen.</p>
  <p>Bitte rufen Sie das Portal über die konfigurierte Adresse auf:
  <a href="${escapeHtml(appBaseUrl)}">${escapeHtml(appBaseUrl)}</a></p>
  <p style="color:#64748b; font-size:0.85rem;">(Konfiguriert über die Umgebungsvariable <code>APP_BASE_URL</code>.
  Für internes Testen ohne Domain kann <code>COOKIE_INSECURE=true</code> gesetzt werden.)</p>
</body></html>`;
  return new NextResponse(html, {
    status: 421, // Misdirected Request
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function middleware(request: NextRequest) {
  // 1) Host-Check zuerst (ohne Session-Zugriff): stellt sicher, dass die App
  // ueber die in APP_BASE_URL konfigurierte Domain aufgerufen wird.
  const appBaseUrl = process.env.APP_BASE_URL;
  const hostCheck = checkAppHost({
    appBaseUrl,
    actualHost: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    cookieInsecure: process.env.COOKIE_INSECURE === "true",
  });
  if (!hostCheck.ok && appBaseUrl) {
    return wrongHostResponse(appBaseUrl, hostCheck.expectedHost ?? "", hostCheck.actualHost ?? "");
  }

  // 2) Session-/Auth-Logik nur fuer die relevanten Pfade - andere Seiten
  // (reset-password, access-revoked, ...) brauchen hier keinen Session-Zugriff.
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isTenantRoute = pathname.startsWith("/dashboard");
  const needsSession = isAdminRoute || isTenantRoute || pathname === "/login" || pathname === "/change-password";
  if (!needsSession) return NextResponse.next();

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, getSessionOptions());
  const isAuthed = Boolean(session.userId);
  const loginUrl = new URL("/login", request.url);

  if (isAdminRoute && (!isAuthed || session.role !== "ADMIN")) {
    return NextResponse.redirect(loginUrl);
  }
  if (isTenantRoute && (!isAuthed || session.role !== "MIETER")) {
    return NextResponse.redirect(loginUrl);
  }

  if ((isAdminRoute || isTenantRoute) && session.mustChangePassword) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (pathname === "/change-password" && !isAuthed) {
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isAuthed && !session.mustChangePassword) {
    const target = session.role === "ADMIN" ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return response;
}

export const config = {
  // Alle Seiten (fuer den Host-Check), aber ohne statische Assets und API-Routen.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
