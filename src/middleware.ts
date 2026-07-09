import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  const { pathname } = request.nextUrl;
  const isAuthed = Boolean(session.userId);
  const loginUrl = new URL("/login", request.url);

  const isAdminRoute = pathname.startsWith("/admin");
  const isTenantRoute = pathname.startsWith("/dashboard");

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
  matcher: ["/admin/:path*", "/dashboard/:path*", "/login", "/change-password"],
};
