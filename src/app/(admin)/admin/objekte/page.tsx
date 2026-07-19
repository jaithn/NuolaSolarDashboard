import Link from "next/link";
import { prisma } from "@/lib/db";
import { StammdatenAnlegenPanel } from "./StammdatenAnlegenPanel";
import { deleteObjektAction, deleteEinheitAction } from "./actions";
import { deleteGeraetAction } from "../geraete/actions";
import { EINHEIT_TYP_LABEL } from "./einheitTyp";

export default async function ObjektePage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { fehler } = await searchParams;
  const objekte = await prisma.objekt.findMany({
    orderBy: { name: "asc" },
    include: {
      einheiten: {
        orderBy: { bezeichnung: "asc" },
        include: { _count: { select: { mietparteien: true, geraetZuordnungen: true } } },
      },
      shellyGeraete: {
        orderBy: { bezeichnung: "asc" },
        include: { _count: { select: { messwerte: true, zuordnungen: true } } },
      },
    },
  });

  const objektOptions = objekte.map((o) => ({
    id: o.id,
    name: o.name,
    vermieterProEinheit: o.vermieterModus === "PRO_EINHEIT",
  }));

  return (
    <div>
      <StammdatenAnlegenPanel objekte={objektOptions} />
      <p style={{ color: "var(--color-muted)", marginTop: "-0.25rem" }}>
        Übersicht aller Objekte mit ihren Einheiten und Geräten. Neues über das +-Menü oben rechts.
      </p>
      {fehler && <div className="form-error" role="alert">{fehler}</div>}

      {objekte.length === 0 && (
        <div className="section">
          <p>Noch keine Objekte angelegt. Lege unten dein erstes Objekt an.</p>
        </div>
      )}

      {objekte.map((o) => (
        <div className="section" key={o.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "0.15rem" }}>
                <Link href={`/admin/objekte/${o.id}`}>{o.name}</Link>
              </h2>
              <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.9rem" }}>
                {o.adresse}
                {o.plz || o.ort ? `, ${o.plz} ${o.ort}`.trimEnd() : ""}
              </p>
            </div>
            <form action={deleteObjektAction}>
              <input type="hidden" name="id" value={o.id} />
              <button className="btn-small btn-danger" type="submit">
                Objekt löschen
              </button>
            </form>
          </div>

          <h3 style={{ marginBottom: "0.4rem" }}>Einheiten ({o.einheiten.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bezeichnung</th>
                <th>Mietparteien</th>
                <th>Zähler</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {o.einheiten.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/admin/einheiten/${e.id}`}>{e.bezeichnung}</Link>
                    {e.typ !== "WOHNEINHEIT" && (
                      <span className="status-badge interessent" style={{ marginLeft: "0.4rem" }}>
                        {EINHEIT_TYP_LABEL[e.typ]}
                      </span>
                    )}
                  </td>
                  <td>{e._count.mietparteien}</td>
                  <td>{e._count.geraetZuordnungen}</td>
                  <td>
                    <form action={deleteEinheitAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="objektId" value={o.id} />
                      <button className="btn-small btn-danger" type="submit">
                        Löschen
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {o.einheiten.length === 0 && (
                <tr>
                  <td colSpan={4}>Noch keine Einheiten.</td>
                </tr>
              )}
            </tbody>
          </table>

          <h3 style={{ marginBottom: "0.4rem", marginTop: "1.25rem" }}>Zähler ({o.shellyGeraete.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bezeichnung</th>
                <th>Device-ID</th>
                <th>Intervall</th>
                <th>Status</th>
                <th>Messwerte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {o.shellyGeraete.map((g) => (
                <tr key={g.id}>
                  <td>
                    <Link href={`/admin/geraete/${g.id}`}>{g.bezeichnung}</Link>
                  </td>
                  <td>{g.deviceId}</td>
                  <td>alle {g.abrufIntervallMinuten} min</td>
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
              {o.shellyGeraete.length === 0 && (
                <tr>
                  <td colSpan={6}>Noch keine Zähler.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
