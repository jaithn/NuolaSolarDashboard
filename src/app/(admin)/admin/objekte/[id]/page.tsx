import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EditObjektForm } from "./EditObjektForm";
import { NewEinheitForm } from "./NewEinheitForm";
import { deleteEinheitAction } from "../actions";

export default async function ObjektDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { id } = await params;
  const { fehler } = await searchParams;

  const objekt = await prisma.objekt.findUnique({
    where: { id },
    include: {
      einheiten: {
        orderBy: { bezeichnung: "asc" },
        include: { _count: { select: { mietparteien: true, geraetZuordnungen: true } } },
      },
    },
  });
  if (!objekt) notFound();

  return (
    <div>
      <h1>{objekt.name}</h1>
      {fehler && <div className="form-error">{fehler}</div>}

      <div className="section">
        <h2>Stammdaten</h2>
        <EditObjektForm
          id={objekt.id}
          name={objekt.name}
          adresse={objekt.adresse}
          plz={objekt.plz}
          ort={objekt.ort}
          vermieterModus={objekt.vermieterModus}
          vermieterName={objekt.vermieterName}
          vermieterName2={objekt.vermieterName2}
          vermieterAnrede={objekt.vermieterAnrede}
          vermieterAnrede2={objekt.vermieterAnrede2}
          vermieterFirma={objekt.vermieterFirma}
          vermieterAnschrift={objekt.vermieterAnschrift}
          vermieterPlz={objekt.vermieterPlz}
          vermieterOrt={objekt.vermieterOrt}
          oeffentlicherZaehler={objekt.oeffentlicherZaehler}
          hausverwaltungName={objekt.hausverwaltungName}
          hausverwaltungAnschrift={objekt.hausverwaltungAnschrift}
          hausverwaltungPlz={objekt.hausverwaltungPlz}
          hausverwaltungOrt={objekt.hausverwaltungOrt}
          ergaenzungUnterzeichner={objekt.ergaenzungUnterzeichner}
          bearbeiterName={objekt.bearbeiterName}
          geplanterLiefertermin={objekt.geplanterLiefertermin ? objekt.geplanterLiefertermin.toISOString().slice(0, 10) : ""}
          hatWaermepumpe={objekt.hatWaermepumpe}
        />
      </div>

      <div className="section">
        <h2>Einheiten</h2>
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
            {objekt.einheiten.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/admin/einheiten/${e.id}`}>{e.bezeichnung}</Link>
                </td>
                <td>{e._count.mietparteien}</td>
                <td>{e._count.geraetZuordnungen}</td>
                <td>
                  <form action={deleteEinheitAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="objektId" value={objekt.id} />
                    <button className="btn-small btn-danger" type="submit">
                      Löschen
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {objekt.einheiten.length === 0 && (
              <tr>
                <td colSpan={4}>Noch keine Einheiten angelegt.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Neue Einheit anlegen</h2>
        <NewEinheitForm objektId={objekt.id} vermieterProEinheit={objekt.vermieterModus === "PRO_EINHEIT"} />
      </div>
    </div>
  );
}
