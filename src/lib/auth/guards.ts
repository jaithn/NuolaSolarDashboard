import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./getSession";
import type { SessionData } from "./session";
import type { IronSession } from "iron-session";

/**
 * Erzwingt eine angemeldete Admin-Session. Muss als erste Anweisung in JEDER
 * Admin-Server-Action aufgerufen werden: Server Actions sind eigenstaendige
 * HTTP-Endpunkte - die Middleware schuetzt nur die Seitennavigation und darf
 * nicht die einzige Verteidigungslinie sein (Defense in Depth, vgl. auch
 * CVE-2025-29927, Middleware-Bypass in Next.js < 15.2.3).
 */
export async function requireAdmin(): Promise<IronSession<SessionData>> {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    redirect("/login");
  }
  return session;
}

/** Erzwingt eine beliebige angemeldete Session (Admin oder Mieter). */
export async function requireSession(): Promise<IronSession<SessionData>> {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }
  return session;
}
