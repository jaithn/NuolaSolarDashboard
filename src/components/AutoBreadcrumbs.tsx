"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

/**
 * Pfadbasierte Brotkrümel-Navigation ("Sie befinden sich hier"). Wird in den
 * Layouts eingebunden und gilt damit für JEDE Seite. WCAG 2.2: eigenes <nav>
 * mit aria-label, aktuelle Seite mit aria-current="page".
 */
export function AutoBreadcrumbs() {
  const pathname = usePathname();
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length <= 1) return null; // Auf der Startseite kein Brotkrümel nötig.

  let href = "";
  const items = segs.map((seg, i) => {
    href += `/${seg}`;
    const label = istId(seg) ? (DETAIL[segs[i - 1] ?? ""] ?? "Detail") : (LABELS[seg] ?? seg);
    return { label, href };
  });

  return (
    <nav aria-label="Brotkrümelnavigation" className="breadcrumbs">
      <ol>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.href}>
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
