import Link from "next/link";
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
          <Link href="/admin">Übersicht</Link>
          <Link href="/admin/objekte">Objekte</Link>
          <Link href="/admin/mietparteien">Mietparteien</Link>
          <Link href="/admin/geraete">Geräte</Link>
          <Link href="/admin/rechnungen">Rechnungen</Link>
          <Link href="/admin/einstellungen">Einstellungen</Link>
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
