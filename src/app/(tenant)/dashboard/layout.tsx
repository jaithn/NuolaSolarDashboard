import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/app/login/actions";
import { isMietparteiEffectivelyAktiv } from "@/lib/mietpartei";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId || session.role !== "MIETER") {
    redirect("/login");
  }

  const nutzer = await prisma.nutzer.findUnique({
    where: { id: session.userId },
    include: { mietpartei: true },
  });

  // Verteidigung in der Tiefe: selbst bei einer noch gueltigen Session muss
  // die Mietpartei aktuell aktiv sein - deaktivierte/ausgezogene Mietparteien
  // verlieren den Zugriff sofort, auch ohne erneuten Login. WICHTIG: Session-
  // Cookies koennen in einer Server Component (Layout/Page-Rendering) nicht
  // veraendert werden (nur in Server Actions/Route Handlern) - daher hier
  // kein session.destroy(), sondern Redirect auf eine eigene Seite, die den
  // eigentlichen Logout (inkl. Cookie-Loeschung) ueber eine Server Action
  // anstoesst. Ein Redirect direkt auf /login wuerde sonst durch die
  // Middleware (isAuthed + !mustChangePassword) sofort zurueck auf
  // /dashboard geleitet werden - eine Redirect-Schleife.
  if (!nutzer || !nutzer.mietpartei || !isMietparteiEffectivelyAktiv(nutzer.mietpartei)) {
    redirect("/access-revoked");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <strong>Nuola Mieter-Dashboard</strong>
        <nav>
          <a href="/dashboard">Verbrauch</a>
          <a href="/dashboard/rechnungen">Abrechnungen</a>
          <form action={logoutAction}>
            <button className="logout-btn" type="submit">
              Abmelden
            </button>
          </form>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
