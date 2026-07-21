"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

// Segment-Beschriftungen. Für dynamische [id]-Segmente wird anhand des
// übergeordneten Segments ein sprechender Einzahl-Begriff gewählt.
const LABELS: Record<string, string> = {
  admin: "Übersicht",
  dashboard: "Verbrauch",
  objekte: "Objekte",
  einheiten: "Einheiten",
  geraete: "Zähler",
  mietparteien: "Mietparteien",
  rechnungen: "Rechnungen",
  einstellungen: "Einstellungen",
  steuersaetze: "Steuersätze",
  profil: "Profil",
};
const DETAIL: Record<string, string> = {
  objekte: "Objekt",
  einheiten: "Einheit",
  geraete: "Zähler",
  mietparteien: "Mietpartei",
  rechnungen: "Rechnung",
};

function istId(seg: string): boolean {
  // cuid()/ähnliche IDs: lange alphanumerische Zeichenketten.
  return /^[a-z0-9]{16,}$/i.test(seg);
}

export interface BreadcrumbItem {
  label: string;
  href: string;
}

// Kontext, über den eine einzelne Seite den automatisch erzeugten Pfad durch
// einen expliziten Pfad ersetzen kann (nötig, wenn Namen wie Objekt-/
// Einheitsbezeichnung nicht in der URL stehen, z.B. /admin/einheiten/[id]).
const BreadcrumbsContext = createContext<{
  setOverride: (items: BreadcrumbItem[] | null) => void;
} | null>(null);

export function BreadcrumbsProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<BreadcrumbItem[] | null>(null);
  return (
    <BreadcrumbsContext.Provider value={{ setOverride }}>
      <AutoBreadcrumbs override={override} />
      {children}
    </BreadcrumbsContext.Provider>
  );
}

/**
 * Setzt für die aktuelle Seite einen expliziten Brotkrümel-Pfad (überschreibt
 * den pfadbasierten). Rendert nichts; räumt beim Verlassen wieder auf.
 */
export function SetBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const ctx = useContext(BreadcrumbsContext);
  // Stabiler Schlüssel, damit der Effekt nur bei echten Änderungen neu läuft.
  const schluessel = items.map((i) => `${i.label}|${i.href}`).join(">");
  useEffect(() => {
    ctx?.setOverride(items);
    return () => ctx?.setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
  return null;
}

/**
 * Pfadbasierte Brotkrümel-Navigation ("Sie befinden sich hier"). Wird in den
 * Layouts (über den Provider) eingebunden und gilt damit für JEDE Seite. Eine
 * Seite kann den Pfad per <SetBreadcrumbs> überschreiben. WCAG 2.2: eigenes
 * <nav> mit aria-label, aktuelle Seite mit aria-current="page".
 */
export function AutoBreadcrumbs({ override }: { override?: BreadcrumbItem[] | null }) {
  const pathname = usePathname();

  let items: BreadcrumbItem[];
  if (override && override.length > 0) {
    items = override;
  } else {
    const segs = pathname.split("/").filter(Boolean);
    if (segs.length <= 1) return null; // Auf der Startseite kein Brotkrümel nötig.
    let href = "";
    items = segs.map((seg, i) => {
      href += `/${seg}`;
      const label = istId(seg) ? (DETAIL[segs[i - 1] ?? ""] ?? "Detail") : (LABELS[seg] ?? seg);
      return { label, href };
    });
  }

  return (
    <nav aria-label="Brotkrümelnavigation" className="breadcrumbs">
      <ol>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.href}-${i}`}>
              {isLast ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <Link href={item.href}>{item.label}</Link>
              )}
              {!isLast && (
                <span className="breadcrumbs-sep" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
