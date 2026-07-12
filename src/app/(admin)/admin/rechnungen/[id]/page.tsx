import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";
import { freigebenAction, erneutVersendenAction, loescheEntwurfAction, storniereAction } from "../actions";

const STATUS_LABEL: Record<string, string> = {
  ENTWURF: "Entwurf",
  FREIGEGEBEN: "Freigegeben",
  VERSENDET: "Versendet",
  STORNIERT: "Storniert",
};

export default async function RechnungDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string; versendet?: string; storniert?: string }>;
}) {
  const { id } = await params;
  const { fehler, versendet, storniert } = await searchParams;

  const rechnung = await prisma.rechnung.findUnique({
    where: { id },
    include: {
      mietpartei: { include: { einheit: { include: { objekt: true } } } },
      positionen: { include: { steuersatz: true }, orderBy: { sortierung: "asc" } },
      stornoVon: true,
      storniertDurch: true,
    },
  });
  if (!rechnung) notFound();

  const titel = rechnung.rechnungsnummer ?? "Entwurf (noch keine Nummer)";
  const istStorno = rechnung.stornoVonId !== null;

  return (
    <div>
      <h1>{titel}</h1>
      <p>
        {mietparteiAnzeigeName(rechnung.mietpartei)} – {rechnung.mietpartei.einheit.objekt.name}{" "}
        {rechnung.mietpartei.einheit.bezeichnung}
      </p>

      {fehler && <div className="form-error">{fehler}</div>}
      {versendet === "ok" && <div className="form-notice">Rechnung wurde erfolgreich per E-Mail versendet.</div>}
      {storniert === "ok" && (
        <div className="form-notice">
          Stornorechnung wurde erstellt. Für den Zeitraum kann nun eine neue (korrigierte) Rechnung erstellt werden.
        </div>
      )}

      {istStorno && rechnung.stornoVon && (
        <div className="form-notice">
          Dies ist eine <strong>Stornorechnung</strong> zur Rechnung{" "}
          <Link href={`/admin/rechnungen/${rechnung.stornoVonId}`}>
            {rechnung.stornoVon.rechnungsnummer ?? rechnung.stornoVonId}
          </Link>
          .
        </div>
      )}
      {rechnung.storniertDurch.length > 0 && (
        <div className="form-error">
          Diese Rechnung wurde storniert durch{" "}
          {rechnung.storniertDurch.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={`/admin/rechnungen/${s.id}`}>{s.rechnungsnummer ?? s.id}</Link>
            </span>
          ))}
          .
        </div>
      )}

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
          <p>
            Verbrauchskosten gesamt (brutto): <strong>{rechnung.verbrauchskostenBrutto.toFixed(2)} €</strong>
          </p>
          <p>
            Geleistete Abschläge (brutto): <strong>{rechnung.summeAbschlaegeBrutto.toFixed(2)} €</strong>
          </p>
          <p style={{ fontSize: "1.1rem" }}>
            {rechnung.verrechnungBetrag >= 0 ? "Nachzahlung" : "Guthaben"}:{" "}
            <strong>{Math.abs(rechnung.verrechnungBetrag).toFixed(2)} €</strong>
          </p>
        </div>
      </div>

      <div className="section">
        <h2>Status &amp; Freigabe</h2>
        <p>
          Aktueller Status: <strong>{STATUS_LABEL[rechnung.status] ?? rechnung.status}</strong>
        </p>

        {rechnung.emailFehler && (
          <div className="form-error">
            Der E-Mail-Versand ist gescheitert: {rechnung.emailFehler}
            <form action={erneutVersendenAction} style={{ marginTop: "0.6rem" }}>
              <input type="hidden" name="id" value={rechnung.id} />
              <button className="btn-small" type="submit">
                E-Mail erneut senden
              </button>
            </form>
          </div>
        )}

        {rechnung.pdfPfad && (
          <p>
            <a href={`/api/rechnungen/${rechnung.id}/pdf`} target="_blank" rel="noreferrer">
              PDF-Vorschau öffnen
            </a>
          </p>
        )}

        {rechnung.status === "ENTWURF" && (
          <>
            <p>
              Die Rechnung ist noch ein Entwurf (ohne offizielle Nummer) und für die Mietpartei nicht sichtbar. Bei der
              Freigabe wird die lückenlose Rechnungsnummer vergeben, das PDF final erzeugt und automatisch per E-Mail
              versendet.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <form action={freigebenAction}>
                <input type="hidden" name="id" value={rechnung.id} />
                <button className="btn-small" type="submit">
                  Freigeben &amp; versenden
                </button>
              </form>
              <form action={loescheEntwurfAction}>
                <input type="hidden" name="id" value={rechnung.id} />
                <button className="btn-small btn-danger" type="submit">
                  Entwurf löschen
                </button>
              </form>
            </div>
          </>
        )}

        {(rechnung.status === "FREIGEGEBEN" || rechnung.status === "VERSENDET") && !istStorno && (
          <>
            <p>
              Diese Rechnung ist freigegeben und unveränderlich. Zur Korrektur bitte stornieren (erzeugt eine
              Stornorechnung mit eigener Nummer, die die Beträge aufhebt) und anschließend eine neue Rechnung erstellen.
            </p>
            <form action={storniereAction}>
              <input type="hidden" name="id" value={rechnung.id} />
              <button className="btn-small btn-danger" type="submit">
                Rechnung stornieren
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
