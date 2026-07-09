import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { logoutAction } from "@/app/login/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <strong>Nuola Admin</strong>
        <nav>
          <a href="/admin">Übersicht</a>
          <a href="/admin/objekte">Objekte</a>
          <a href="/admin/mietparteien">Mietparteien</a>
          <a href="/admin/geraete">Geräte</a>
          <a href="/admin/rechnungen">Rechnungen</a>
          <a href="/admin/einstellungen">Einstellungen</a>
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
