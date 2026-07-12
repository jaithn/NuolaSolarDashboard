import { redirect } from "next/navigation";

// Die separate Geräte-Übersicht wurde in die Objekte-Seite integriert
// (Objekte → Einheiten + Geräte in einer Ansicht, inkl. Anlegen). Direkte
// Aufrufe von /admin/geraete werden dorthin umgeleitet; die Geräte-Detailseite
// (/admin/geraete/[id]) bleibt erhalten.
export default function GeraetePage() {
  redirect("/admin/objekte");
}
