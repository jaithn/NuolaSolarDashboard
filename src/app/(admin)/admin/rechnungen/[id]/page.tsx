import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { freigebenAction } from "../actions";

export default async function RechnungDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string; versendet?: string }>;
}) {
  const { id } = await params;
  const { fehler, versendet } = await searchParams;

  const rechnung = await prisma.rechnung.findUnique({
    where: { id },
    include: {
      mietpartei: { include: { einheit: { include: { objekt: true } } } },
      positionen: { include: { steuersatz: true }, orderBy: { sortierung: "asc" } },
    },
  });
  if (!rechnung) notFound();

  return (
    <div>
      <h1>{rechnung.rechnungsnummer}</h1>
      <p>
        {rechnung.mietpartei.name} – {rechnung.mietpartei.einheit.objekt.name} {rechnung.mietpartei.einheit.bezeichnung}
      </p>

      {fehler && <div className="form-error">{fehler}</div>}
      {versendet === "ok" && <div className="form-notice">Rechnung wurde freigegeben und per E-Mail versendet.</div>}

      <div className="section">
        <h2>Zählerstände &amp; Konditionen</h2>
        <p>
          Anfangszählerstand: <strong>{rechnung.anfangszaehlerstandKwh.toFixed(2)} kWh</strong> · Endzählerstand:{" "}
          <strong>{rechnung.endzaehlerstandKwh.toFixed(2)} kWh</strong> · Ermittelter Verbrauch:{" "}
          <strong>{rechnung.gesamtVerbrauchKwh.toFixed(2)} kWh</strong>
          {rechnung.verbrauchGeschaetzt && (
            <span className="status-badge inaktiv" style={{ marginLeft: 8 }}>
              teilw. geschätzt (§ 7)
            </span>
          )}
        </p>
        <p>
          Arbeitspreis: <strong>{rechnung.arbeitspreisNetto.toFixed(4)} €/kWh (netto)</strong>
          {rechnung.grundgebuehrMonatlichNetto !== null && (
            <>
              {" "}
              · Monatliche Grundgebühr: <strong>{rechnung.grundgebuehrMonatlichNetto.toFixed(2)} € (netto)</strong>
            </>
          )}
        </p>
      </div>

      <div className="section">
        <h2>Positionen</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Bezeichnung</th>
              <th>Netto</th>
              <th>Steuersatz</th>
              <th>MwSt.</th>
              <th>Brutto</th>
            </tr>
          </thead>
          <tbody>
            {rechnung.positionen.map((p) => (
              <tr key={p.id}>
                <td>{p.bezeichnung}</td>
                <td>{p.nettoBetrag.toFixed(2)} €</td>
                <td>{p.steuersatz.prozentsatz}%</td>
                <td>{p.steuerBetrag.toFixed(2)} €</td>
                <td>{p.bruttoBetrag.toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: "1rem" }}>
          <p>Verbrauchskosten gesamt (brutto): <strong>{rechnung.verbrauchskostenBrutto.toFixed(2)} €</strong></p>
          <p>Geleistete Abschläge (brutto): <strong>{rechnung.summeAbschlaegeBrutto.toFixed(2)} €</strong></p>
          <p style={{ fontSize: "1.1rem" }}>
            {rechnung.verrechnungBetrag >= 0 ? "Nachzahlung" : "Guthaben"}:{" "}
            <strong>{Math.abs(rechnung.verrechnungBetrag).toFixed(2)} €</strong>
          </p>
        </div>
      </div>

      <div className="section">
        <h2>Status &amp; Freigabe</h2>
        <p>Aktueller Status: <strong>{rechnung.status}</strong></p>

        {rechnung.pdfPfad && (
          <p>
            <a href={`/api/rechnungen/${rechnung.id}/pdf`} target="_blank" rel="noreferrer">
              PDF-Vorschau öffnen
            </a>
          </p>
        )}

        {rechnung.status === "ENTWURF" ? (
          <>
            <p>
              Die Rechnung ist noch ein Entwurf und für den Mieter nicht sichtbar. Nach der Freigabe wird
              sie im Mieterbereich sichtbar und automatisch per E-Mail als PDF versendet.
            </p>
            <form action={freigebenAction}>
              <input type="hidden" name="id" value={rechnung.id} />
              <button className="btn-small" type="submit">
                Freigeben &amp; versenden
              </button>
            </form>
          </>
        ) : (
          <p>Diese Rechnung wurde bereits freigegeben und ist unveränderlich.</p>
        )}
      </div>
    </div>
  );
}
