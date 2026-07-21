import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { logoutAction } from "@/app/login/actions";
import { BreadcrumbsProvider } from "@/components/AutoBreadcrumbs";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId || session.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <a href="#hauptinhalt" className="skip-link">
        Zum Inhalt springen
      </a>
      <header className="app-header">
        <Link href="/admin" aria-label="Zur Übersicht">
          <BrandLogo />
        </Link>
        <nav>
          <Link href="/admin">Übersicht</Link>
          <Link href="/admin/objekte">Objekte</Link>
          <Link href="/admin/mietparteien">Mietparteien</Link>
          <Link href="/admin/rechnungen">Rechnungen</Link>
          <Link href="/admin/einstellungen">Einstellungen</Link>
          <form action={logoutAction}>
            <button className="logout-btn" type="submit">
              Abmelden
            </button>
          </form>
        </nav>
      </header>
      <main className="app-main" id="hauptinhalt">
        <BreadcrumbsProvider>{children}</BreadcrumbsProvider>
      </main>
      <SiteFooter />
    </div>
  );
}
