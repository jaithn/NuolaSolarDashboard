import Link from "next/link";
import { prisma } from "@/lib/db";
import { NewObjektForm } from "./NewObjektForm";
import { deleteObjektAction } from "./actions";

export default async function ObjektePage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { fehler } = await searchParams;
  const objekte = await prisma.objekt.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { einheiten: true, shellyGeraete: true } } },
  });

  return (
    <div>
      <h1>Objekte</h1>
      {fehler && <div className="form-error">{fehler}</div>}

      <div className="section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Adresse</th>
              <th>Einheiten</th>
              <th>Geräte</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {objekte.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/objekte/${o.id}`}>{o.name}</Link>
                </td>
                <td>
                  {o.adresse}
                  {o.plz || o.ort ? `, ${o.plz} ${o.ort}`.trimEnd() : ""}
                </td>
                <td>{o._count.einheiten}</td>
                <td>{o._count.shellyGeraete}</td>
                <td>
                  <form action={deleteObjektAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="btn-small btn-danger" type="submit">
                      Löschen
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {objekte.length === 0 && (
              <tr>
                <td colSpan={5}>Noch keine Objekte angelegt.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Neues Objekt anlegen</h2>
        <NewObjektForm />
      </div>
    </div>
  );
}
