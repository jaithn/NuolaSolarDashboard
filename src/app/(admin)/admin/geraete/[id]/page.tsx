import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GeraetForm } from "../GeraetForm";
import { toggleGeraetAktivAction } from "../actions";

export default async function GeraetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [geraet, objekte] = await Promise.all([
    prisma.shellyGeraet.findUnique({
      where: { id },
      include: { zuordnungen: { include: { einheit: { include: { objekt: true } } } } },
    }),
    prisma.objekt.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!geraet) notFound();

  return (
    <div>
      <h1>{geraet.bezeichnung}</h1>

      <div className="section">
        <h2>Stammdaten</h2>
        <GeraetForm mode="edit" objekte={objekte} geraet={geraet} />
      </div>

      <div className="section">
        <h2>Zugeordnete Einheiten</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Objekt</th>
              <th>Einheit</th>
              <th>Modus</th>
            </tr>
          </thead>
          <tbody>
            {geraet.zuordnungen.map((z) => (
              <tr key={z.id}>
                <td>{z.einheit.objekt.name}</td>
                <td>
                  <Link href={`/admin/einheiten/${z.einheit.id}`}>{z.einheit.bezeichnung}</Link>
                </td>
                <td>{z.modus === "SUBTRAHIEREN" ? "Subtrahieren (Allgemeinstrom)" : "Addieren"}</td>
              </tr>
            ))}
            {geraet.zuordnungen.length === 0 && (
              <tr>
                <td colSpan={3}>Noch keiner Einheit zugeordnet.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p style={{ fontSize: "0.85rem", color: "#475569", marginTop: "0.5rem" }}>
          Zuordnungen werden auf der jeweiligen Einheiten-Seite angelegt/entfernt.
        </p>
      </div>

      <div className="section">
        <h2>Status</h2>
        <p>
          Aktuell: <span className={`status-badge ${geraet.aktiv ? "aktiv" : "inaktiv"}`}>
            {geraet.aktiv ? "aktiv" : "deaktiviert"}
          </span>
          {geraet.deaktiviertAb && ` seit ${geraet.deaktiviertAb.toLocaleDateString("de-DE")}`}
        </p>
        <p>
          Ein deaktiviertes Gerät wird vom Worker nicht mehr abgefragt, bereits erfasste Messwerte
          bleiben aber vollständig erhalten.
        </p>
        <form action={toggleGeraetAktivAction}>
          <input type="hidden" name="id" value={geraet.id} />
          <button className="btn-small" type="submit">
            {geraet.aktiv ? "Deaktivieren" : "Reaktivieren"}
          </button>
        </form>
      </div>
    </div>
  );
}
