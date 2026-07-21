import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { EditObjektForm } from "./EditObjektForm";
import { NewEinheitForm } from "./NewEinheitForm";
import { ObjektAktionenPanel } from "./ObjektAktionenPanel";
import { deleteEinheitAction } from "../actions";
import { EINHEIT_TYP_LABEL } from "../einheitTyp";
import { istMietparteiInaktiv, kombiniereNamen } from "@/lib/mietpartei";

/** Read-only-Zeile „Label: Wert" für die Anzeige-Abschnitte. */
function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{label}</div>
      <div>{children ?? "–"}</div>
    </div>
  );
}

const VERMIETER_MODUS_LABEL: Record<string, string> = {
  PRO_OBJEKT: "Ein:e Vermieter:in für das ganze Objekt",
  PRO_EINHEIT: "Je Einheit ein:e eigene:r Vermieter:in",
};

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
        include: {
          _count: { select: { geraetZuordnungen: true } },
          mietparteien: { select: { status: true, auszugsdatum: true } },
        },
      },
    },
  });
  if (!objekt) notFound();

  const vermieterName = kombiniereNamen(objekt.vermieterName, objekt.vermieterName2);
  const proObjekt = objekt.vermieterModus === "PRO_OBJEKT";
  const hatHausverwaltung = Boolean(objekt.hausverwaltungName?.trim());

  return (
    <div>
      {/* Titel + +-Menü (alle Bearbeitungen laufen über das Menü). */}
      <ObjektAktionenPanel
        titel={objekt.name}
        editForm={
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
            hausverwaltungAnsprechperson={objekt.hausverwaltungAnsprechperson}
            hausverwaltungTelefon={objekt.hausverwaltungTelefon}
            hausverwaltungEmail={objekt.hausverwaltungEmail}
            ergaenzungUnterzeichner={objekt.ergaenzungUnterzeichner}
            grundversorgerName={objekt.grundversorgerName}
            grundversorgerTarif={objekt.grundversorgerTarif}
            grundversorgerGrundpreisBrutto={objekt.grundversorgerGrundpreisBrutto}
            grundversorgerArbeitspreisBrutto={objekt.grundversorgerArbeitspreisBrutto}
            grundversorgerStand={objekt.grundversorgerStand ? objekt.grundversorgerStand.toISOString().slice(0, 10) : ""}
            bearbeiterName={objekt.bearbeiterName}
            geplanterLiefertermin={objekt.geplanterLiefertermin ? objekt.geplanterLiefertermin.toISOString().slice(0, 10) : ""}
            hatWaermepumpe={objekt.hatWaermepumpe}
          />
        }
        neueEinheitForm={<NewEinheitForm objektId={objekt.id} vermieterProEinheit={objekt.vermieterModus === "PRO_EINHEIT"} />}
      />

      {fehler && <div className="form-error" role="alert">{fehler}</div>}

      {/* --- Read-only-Abschnitt: Stammdaten --- */}
      <div className="section">
        <h2>Stammdaten</h2>
        <div className="form-grid">
          <Feld label="Adresse">
            {objekt.adresse}, {objekt.plz} {objekt.ort}
          </Feld>
          <Feld label="Vermieter-Modell">{VERMIETER_MODUS_LABEL[objekt.vermieterModus] ?? objekt.vermieterModus}</Feld>
          {proObjekt && <Feld label="Vermieter:in">{objekt.vermieterFirma?.trim() || vermieterName || "–"}</Feld>}
          {proObjekt && (
            <Feld label="Vermieter-Anschrift">
              {objekt.vermieterAnschrift ? `${objekt.vermieterAnschrift}, ${objekt.vermieterPlz} ${objekt.vermieterOrt}` : "–"}
            </Feld>
          )}
          <Feld label="Öffentlicher Zähler (Netz)">{objekt.oeffentlicherZaehler || "–"}</Feld>
          {hatHausverwaltung && (
            <Feld label="Hausverwaltung">
              {objekt.hausverwaltungName}
              {objekt.hausverwaltungAnsprechperson ? ` · ${objekt.hausverwaltungAnsprechperson}` : ""}
            </Feld>
          )}
          <Feld label="Ergänzung unterschreibt">
            {objekt.ergaenzungUnterzeichner === "HAUSVERWALTUNG" ? "Hausverwaltung" : "Vermieter:in"}
          </Feld>
          {objekt.grundversorgerName && (
            <Feld label="Grundversorger-Vergleich">
              {objekt.grundversorgerName}
              {objekt.grundversorgerTarif ? ` (${objekt.grundversorgerTarif})` : ""}
            </Feld>
          )}
          <Feld label="Bearbeiter:in">{objekt.bearbeiterName || "–"}</Feld>
          <Feld label="Wärmepumpe im Objekt">{objekt.hatWaermepumpe ? "ja" : "nein"}</Feld>
        </div>
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
                  {e.typ !== "WOHNEINHEIT" && (
                    <span className="status-badge interessent" style={{ marginLeft: "0.4rem" }}>
                      {EINHEIT_TYP_LABEL[e.typ]}
                    </span>
                  )}
                </td>
                <td>{e.mietparteien.filter((m) => !istMietparteiInaktiv(m)).length}</td>
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
                <td colSpan={4}>Noch keine Einheiten. Über das +-Menü oben anlegen.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
