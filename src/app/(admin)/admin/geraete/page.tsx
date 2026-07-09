import { prisma } from "@/lib/db";
import { GeraetForm } from "./GeraetForm";
import { deleteGeraetAction } from "./actions";

export default async function GeraetePage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { fehler } = await searchParams;

  const [geraete, objekte] = await Promise.all([
    prisma.shellyGeraet.findMany({
      orderBy: [{ objekt: { name: "asc" } }, { bezeichnung: "asc" }],
      include: {
        objekt: true,
        _count: { select: { messwerte: true, zuordnungen: true } },
      },
    }),
    prisma.objekt.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1>Shelly-Geräte</h1>
      {fehler && <div className="form-error">{fehler}</div>}

      <div className="section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bezeichnung</th>
              <th>Objekt</th>
              <th>Device-ID</th>
              <th>Zuordnungen</th>
              <th>Status</th>
              <th>Messwerte</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {geraete.map((g) => (
              <tr key={g.id}>
                <td>
                  <a href={`/admin/geraete/${g.id}`}>{g.bezeichnung}</a>
                </td>
                <td>{g.objekt.name}</td>
                <td>{g.deviceId}</td>
                <td>{g._count.zuordnungen}</td>
                <td>
                  <span className={`status-badge ${g.aktiv ? "aktiv" : "inaktiv"}`}>
                    {g.aktiv ? "aktiv" : "deaktiviert"}
                  </span>
                </td>
                <td>{g._count.messwerte}</td>
                <td>
                  <form action={deleteGeraetAction}>
                    <input type="hidden" name="id" value={g.id} />
                    <button className="btn-small btn-danger" type="submit">
                      Löschen
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {geraete.length === 0 && (
              <tr>
                <td colSpan={7}>Noch keine Geräte angelegt.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Neues Gerät anlegen</h2>
        {objekte.length === 0 ? (
          <p>Bitte zuerst ein Objekt anlegen.</p>
        ) : (
          <GeraetForm mode="create" objekte={objekte} />
        )}
      </div>
    </div>
  );
}
