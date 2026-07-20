import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { NewZuordnungForm } from "./NewZuordnungForm";
import { EditEinheitForm } from "./EditEinheitForm";
import { deleteZuordnungAction, setZuordnungWaermepumpeAction } from "../actions";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";

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

  // Bei Allgemeinstrom kann ein zugeordneter Zähler nachträglich als Wärmepumpe
  // markiert werden (getrennter Rechnungsausweis, aber dieselbe Partei).
  const istAllgemeinstrom = einheit.typ === "ALLGEMEINSTROM";

  return (
    <div>
      <h1>
        {einheit.objekt.name} – {einheit.bezeichnung}
      </h1>

      <div className="section">
        <h2>Stammdaten</h2>
        <EditEinheitForm
          id={einheit.id}
          bezeichnung={einheit.bezeichnung}
          vermieterProEinheit={einheit.objekt.vermieterModus === "PRO_EINHEIT"}
          typ={einheit.typ}
          vermieterName={einheit.vermieterName}
          vermieterName2={einheit.vermieterName2}
          vermieterAnrede={einheit.vermieterAnrede}
          vermieterAnrede2={einheit.vermieterAnrede2}
          vermieterFirma={einheit.vermieterFirma}
          vermieterAnschrift={einheit.vermieterAnschrift}
          vermieterPlz={einheit.vermieterPlz}
          vermieterOrt={einheit.vermieterOrt}
        />
      </div>

      <div className="section">
        <h2>Zähler-Zuordnungen</h2>
        <p>
          Ein Zähler kann mehreren Einheiten zugeordnet sein. Mit &quot;Subtrahieren&quot; lässt sich z.B. ein
          Allgemeinstrom-Zwischenzähler abbilden, der im Stromkreis dieser Einheit hängt - die Mietpartei
          zahlt dann nur die Differenz aus ihrem Zähler abzüglich des Allgemeinstrom-Zählers.
        </p>
        {istAllgemeinstrom && (
          <p style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>
            <strong>Wärmepumpe:</strong> Ordnen Sie den Wärmepumpen-Zähler hier zu (oder markieren Sie einen
            bereits zugeordneten Zähler über „Als Wärmepumpe markieren“). Wärmepumpe und Allgemeinstrom
            bleiben dabei dieselbe Partei – der Wärmepumpen-Verbrauch wird in der Rechnung nur getrennt
            (nur Arbeitspreis) ausgewiesen.
          </p>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th>Zähler</th>
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
                <td>
                  {z.modus === "SUBTRAHIEREN" ? "Subtrahieren (Allgemeinstrom)" : "Addieren"}
                  {z.istWaermepumpe && (
                    <span className="status-badge interessent" style={{ marginLeft: "0.4rem" }}>
                      Wärmepumpe
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {/* Wärmepumpe nachträglich an-/abwählen (Allgemeinstrom, beliebiger Modus). */}
                    {istAllgemeinstrom && (
                      <form action={setZuordnungWaermepumpeAction}>
                        <input type="hidden" name="id" value={z.id} />
                        <input type="hidden" name="einheitId" value={einheit.id} />
                        <input type="hidden" name="wert" value={z.istWaermepumpe ? "aus" : "an"} />
                        <button className="btn-small" type="submit">
                          {z.istWaermepumpe ? "Keine Wärmepumpe" : "Als Wärmepumpe markieren"}
                        </button>
                      </form>
                    )}
                    <form action={deleteZuordnungAction}>
                      <input type="hidden" name="id" value={z.id} />
                      <input type="hidden" name="einheitId" value={einheit.id} />
                      <button className="btn-small btn-danger" type="submit">
                        Entfernen
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {einheit.geraetZuordnungen.length === 0 && (
              <tr>
                <td colSpan={3}>Noch keine Zähler zugeordnet.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: "1rem" }}>
          {geraeteImObjekt.length === 0 ? (
            <p>Es sind noch keine Zähler in diesem Objekt angelegt.</p>
          ) : (
            <NewZuordnungForm
              einheitId={einheit.id}
              geraete={geraeteImObjekt}
              zeigeWaermepumpe={einheit.typ === "ALLGEMEINSTROM"}
            />
          )}
        </div>
      </div>

      <div className="section">
        <h2>Mietparteien (Historie)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name / Firma</th>
              <th>Lieferbeginn</th>
              <th>Lieferende</th>
            </tr>
          </thead>
          <tbody>
            {einheit.mietparteien.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/admin/mietparteien/${m.id}`}>{mietparteiAnzeigeName(m)}</Link>
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
