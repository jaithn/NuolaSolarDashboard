import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MietparteiForm } from "../MietparteiForm";
import { NewAbschlagForm } from "../NewAbschlagForm";
import { ZugangPanel } from "./ZugangPanel";
import { OnboardingPanel } from "./OnboardingPanel";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";

export default async function MietparteiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [mietpartei, einheiten, steuersaetze, nutzer] = await Promise.all([
    prisma.mietpartei.findUnique({ where: { id }, include: { einheit: { include: { objekt: true } } } }),
    prisma.einheit.findMany({ include: { objekt: true }, orderBy: { bezeichnung: "asc" } }),
    prisma.steuersatz.findMany({ orderBy: { gueltigAb: "desc" } }),
    prisma.nutzer.findUnique({ where: { mietparteiId: id } }),
  ]);
  if (!mietpartei) notFound();

  const abschlaege = await prisma.abschlag.findMany({
    where: { mietparteiId: id },
    orderBy: { gueltigAb: "desc" },
    include: { steuersatz: true },
  });

  const dokumente = await prisma.mietparteiDokument.findMany({
    where: { mietparteiId: id },
    orderBy: { hochgeladenAm: "desc" },
  });

  const vertragVersionen = await prisma.vertragVersion.findMany({
    orderBy: [{ art: "asc" }, { gueltigAb: "desc" }],
  });

  // Historie der Jahresverbraeuche: nur FREIGEGEBENE/VERSENDETE (also
  // freigegebene) Rechnungen - Entwuerfe und Stornos bleiben aussen vor.
  const freigegebeneRechnungen = await prisma.rechnung.findMany({
    where: { mietparteiId: id, status: { in: ["FREIGEGEBEN", "VERSENDET"] } },
    orderBy: { zeitraumVon: "desc" },
  });
  const summeVerbrauchKwh = freigegebeneRechnungen.reduce((s, r) => s + r.gesamtVerbrauchKwh, 0);
  const summeVerrechnung = freigegebeneRechnungen.reduce((s, r) => s + r.verrechnungBetrag, 0);

  const einheitOptions = einheiten.map((e) => ({ id: e.id, label: `${e.objekt.name} – ${e.bezeichnung}` }));

  return (
    <div>
      <h1>{mietparteiAnzeigeName(mietpartei)}</h1>
      <p>
        {mietpartei.einheit.objekt.name} – {mietpartei.einheit.bezeichnung}
      </p>

      <div className="section">
        <h2>Stammdaten</h2>
        <MietparteiForm mode="edit" einheiten={einheitOptions} steuersaetze={steuersaetze} mietpartei={mietpartei} />
      </div>

      <div className="section">
        <h2>Jahresverbräuche (freigegebene Rechnungen)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rechnung</th>
              <th>Zeitraum</th>
              <th>Verbrauch (<span className="unit">kWh</span>)</th>
              <th>Verrechnung</th>
            </tr>
          </thead>
          <tbody>
            {freigegebeneRechnungen.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/rechnungen/${r.id}`}>{r.rechnungsnummer ?? "—"}</Link>
                </td>
                <td>
                  {r.zeitraumVon.toLocaleDateString("de-DE")} – {r.zeitraumBis.toLocaleDateString("de-DE")}
                </td>
                <td>{r.gesamtVerbrauchKwh.toFixed(2)}</td>
                <td>
                  {r.verrechnungBetrag >= 0 ? "Nachzahlung" : "Guthaben"}: {Math.abs(r.verrechnungBetrag).toFixed(2)} €
                </td>
              </tr>
            ))}
            {freigegebeneRechnungen.length === 0 ? (
              <tr>
                <td colSpan={4}>Noch keine freigegebenen Rechnungen.</td>
              </tr>
            ) : (
              <tr>
                <td>
                  <strong>Summe</strong>
                </td>
                <td></td>
                <td>
                  <strong>{summeVerbrauchKwh.toFixed(2)}</strong>
                </td>
                <td>
                  <strong>
                    {summeVerrechnung >= 0 ? "Nachzahlung" : "Guthaben"}: {Math.abs(summeVerrechnung).toFixed(2)} €
                  </strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Abschläge (Historie)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Netto</th>
              <th>Steuersatz</th>
              <th>Gültig ab</th>
              <th>Gültig bis</th>
            </tr>
          </thead>
          <tbody>
            {abschlaege.map((a) => (
              <tr key={a.id}>
                <td>{a.nettoBetrag.toFixed(2)} €</td>
                <td>{a.steuersatz.prozentsatz}%</td>
                <td>{a.gueltigAb.toLocaleDateString("de-DE")}</td>
                <td>{a.gueltigBis ? a.gueltigBis.toLocaleDateString("de-DE") : "–"}</td>
              </tr>
            ))}
            {abschlaege.length === 0 && (
              <tr>
                <td colSpan={4}>Noch kein Abschlag hinterlegt.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: "1rem" }}>
          <NewAbschlagForm mietparteiId={mietpartei.id} steuersaetze={steuersaetze} />
        </div>
      </div>

      <div className="section">
        <h2>Onboarding</h2>
        <OnboardingPanel
          mietparteiId={mietpartei.id}
          status={mietpartei.status}
          vertragsart={mietpartei.vertragsart}
          signierteVersionId={mietpartei.vertragVersionId}
          vertragVersionen={vertragVersionen.map((v) => ({
            id: v.id,
            art: v.art,
            version: v.version,
            titel: v.titel,
            gueltigAb: v.gueltigAb.toISOString(),
            gueltigBis: v.gueltigBis ? v.gueltigBis.toISOString() : null,
          }))}
          dokumente={dokumente.map((d) => ({
            id: d.id,
            typ: d.typ,
            dateiname: d.dateiname,
            groesseBytes: d.groesseBytes,
            hochgeladenAm: d.hochgeladenAm.toISOString(),
          }))}
        />
      </div>

      <div className="section">
        <h2>Dashboard-Zugang</h2>
        <ZugangPanel
          mietparteiId={mietpartei.id}
          hasZugang={Boolean(nutzer)}
          username={nutzer?.username}
          mustChangePassword={nutzer?.mustChangePassword}
        />
      </div>
    </div>
  );
}
