import Link from "next/link";
import { prisma } from "@/lib/db";
import { MietparteiAnlegenPanel } from "./MietparteiAnlegenPanel";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";

export default async function MietparteienPage() {
  const [mietparteien, einheiten, steuersaetze] = await Promise.all([
    prisma.mietpartei.findMany({
      // Primaer nach Objektname, dann nach Nachname (Firmen nach firma-Feld).
      orderBy: [
        { einheit: { objekt: { name: "asc" } } },
        { einheit: { bezeichnung: "asc" } },
        { name: "asc" },
        { firma: "asc" },
      ],
      include: { einheit: { include: { objekt: true } } },
    }),
    prisma.einheit.findMany({ include: { objekt: true }, orderBy: { bezeichnung: "asc" } }),
    prisma.steuersatz.findMany({ orderBy: { gueltigAb: "desc" } }),
  ]);

  const einheitOptions = einheiten.map((e) => ({
    id: e.id,
    label: `${e.objekt.name} – ${e.bezeichnung}`,
    adresse: e.objekt.adresse,
    plz: e.objekt.plz,
    ort: e.objekt.ort,
  }));

  return (
    <div>
      <MietparteiAnlegenPanel einheiten={einheitOptions} steuersaetze={steuersaetze} />

      <div className="section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name / Firma</th>
              <th>Einheit</th>
              <th>Lieferbeginn</th>
              <th>Lieferende</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mietparteien.map((m) => {
              // Die Badge folgt dem manuell gepflegten Status (das, was der Admin
              // eingestellt hat). Ein zukuenftiger Lieferbeginn macht eine als AKTIV
              // gefuehrte Mietpartei bewusst NICHT "inaktiv" (der frueher genutzte
              // "effektiv aktiv"-Check gilt nur fuer Login/Abrechnung/Polling).
              // Nur ein bereits erfolgter Auszug wird zusaetzlich als inaktiv
              // gekennzeichnet.
              const ausgezogen = m.auszugsdatum != null && m.auszugsdatum < new Date();
              const badge =
                m.status === "INTERESSENT"
                  ? { klasse: "interessent", text: "Interessent:in" }
                  : m.status === "AKTIV" && !ausgezogen
                    ? { klasse: "aktiv", text: "aktiv" }
                    : { klasse: "inaktiv", text: "inaktiv" };
              return (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/mietparteien/${m.id}`}>{mietparteiAnzeigeName(m)}</Link>
                  </td>
                  <td>
                    {m.einheit.objekt.name} – {m.einheit.bezeichnung}
                  </td>
                  <td>{m.einzugsdatum.toLocaleDateString("de-DE")}</td>
                  <td>{m.auszugsdatum ? m.auszugsdatum.toLocaleDateString("de-DE") : "–"}</td>
                  <td>
                    <span className={`status-badge ${badge.klasse}`}>{badge.text}</span>
                  </td>
                </tr>
              );
            })}
            {mietparteien.length === 0 && (
              <tr>
                <td colSpan={5}>Noch keine Mietparteien angelegt.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
