import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { NewZuordnungForm } from "./NewZuordnungForm";
import { deleteZuordnungAction } from "../actions";

export default async function EinheitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const einheit = await prisma.einheit.findUnique({
    where: { id },
    include: {
      objekt: true,
      geraetZuordnungen: { include: { shellyGeraet: true }, orderBy: { createdAt: "asc" } },
      mietparteien: { orderBy: { einzugsdatum: "desc" }, take: 5 },
    },
  });
  if (!einheit) notFound();

  const geraeteImObjekt = await prisma.shellyGeraet.findMany({
    where: { objektId: einheit.objektId },
    orderBy: { bezeichnung: "asc" },
  });

  return (
    <div>
      <h1>
        {einheit.objekt.name} – {einheit.bezeichnung}
      </h1>

      <div className="section">
        <h2>Geräte-Zuordnungen</h2>
        <p>
          Ein Gerät kann mehreren Einheiten zugeordnet sein. Mit &quot;Subtrahieren&quot; lässt sich z.B. ein
          Allgemeinstrom-Zwischenzähler abbilden, der im Stromkreis dieser Einheit hängt - der Mieter
          zahlt dann nur die Differenz aus seinem Zähler abzüglich des Allgemeinstrom-Zählers.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Gerät</th>
              <th>Modus</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {einheit.geraetZuordnungen.map((z) => (
              <tr key={z.id}>
                <td>
                  <Link href={`/admin/geraete/${z.shellyGeraet.id}`}>{z.shellyGeraet.bezeichnung}</Link>
                </td>
                <td>{z.modus === "SUBTRAHIEREN" ? "Subtrahieren (Allgemeinstrom)" : "Addieren"}</td>
                <td>
                  <form action={deleteZuordnungAction}>
                    <input type="hidden" name="id" value={z.id} />
                    <input type="hidden" name="einheitId" value={einheit.id} />
                    <button className="btn-small btn-danger" type="submit">
                      Entfernen
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {einheit.geraetZuordnungen.length === 0 && (
              <tr>
                <td colSpan={3}>Noch keine Geräte zugeordnet.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: "1rem" }}>
          {geraeteImObjekt.length === 0 ? (
            <p>Es sind noch keine Geräte in diesem Objekt angelegt.</p>
          ) : (
            <NewZuordnungForm einheitId={einheit.id} geraete={geraeteImObjekt} />
          )}
        </div>
      </div>

      <div className="section">
        <h2>Mietparteien (Historie)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Einzug</th>
              <th>Auszug</th>
            </tr>
          </thead>
          <tbody>
            {einheit.mietparteien.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/admin/mietparteien/${m.id}`}>{m.name}</Link>
                </td>
                <td>{m.einzugsdatum.toLocaleDateString("de-DE")}</td>
                <td>{m.auszugsdatum ? m.auszugsdatum.toLocaleDateString("de-DE") : "–"}</td>
              </tr>
            ))}
            {einheit.mietparteien.length === 0 && (
              <tr>
                <td colSpan={3}>Noch keine Mietpartei zugeordnet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
