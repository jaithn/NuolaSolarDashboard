import Link from "next/link";
import { prisma } from "@/lib/db";
import { mietparteiAnzeigeName } from "@/lib/mietpartei";
import { NewRechnungForm } from "./NewRechnungForm";
import { BatchEntwuerfeForm } from "./BatchEntwuerfeForm";

const STATUS_LABEL: Record<string, string> = {
  ENTWURF: "Entwurf",
  FREIGEGEBEN: "Freigegeben",
  VERSENDET: "Versendet",
  STORNIERT: "Storniert",
};

export default async function RechnungenPage({
  searchParams,
}: {
  searchParams: Promise<{ geloescht?: string }>;
}) {
  const { geloescht } = await searchParams;

  const [rechnungen, mietparteien] = await Promise.all([
    prisma.rechnung.findMany({
      orderBy: { erstelltAm: "desc" },
      include: { mietpartei: true },
      take: 100,
    }),
    prisma.mietpartei.findMany({
      include: { einheit: { include: { objekt: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const mietparteiOptions = mietparteien.map((m) => ({
    id: m.id,
    label: `${mietparteiAnzeigeName(m)} (${m.einheit.objekt.name} – ${m.einheit.bezeichnung})`,
  }));

  return (
    <div>
      <h1>Rechnungen</h1>

      {geloescht === "ok" && <div className="form-notice">Entwurf wurde gelöscht.</div>}

      <div className="section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nummer</th>
              <th>Mietpartei</th>
              <th>Zeitraum</th>
              <th>Verrechnung</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rechnungen.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/rechnungen/${r.id}`}>{r.rechnungsnummer ?? "Entwurf"}</Link>
                </td>
                <td>
                  <Link href={`/admin/mietparteien/${r.mietparteiId}`}>{mietparteiAnzeigeName(r.mietpartei)}</Link>
                </td>
                <td>
                  {r.zeitraumVon.toLocaleDateString("de-DE")} – {r.zeitraumBis.toLocaleDateString("de-DE")}
                </td>
                <td>
                  {r.verrechnungBetrag >= 0 ? "Nachzahlung" : "Guthaben"}: {Math.abs(r.verrechnungBetrag).toFixed(2)} €
                </td>
                <td>{STATUS_LABEL[r.status] ?? r.status}</td>
              </tr>
            ))}
            {rechnungen.length === 0 && (
              <tr>
                <td colSpan={5}>Noch keine Rechnungen erstellt.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Neue Abrechnung erstellen</h2>
        {mietparteiOptions.length === 0 ? (
          <p>Bitte zuerst eine Mietpartei anlegen.</p>
        ) : (
          <NewRechnungForm mietparteien={mietparteiOptions} />
        )}
      </div>

      <div className="section">
        <h2>Entwürfe für alle aktiven Einheiten erzeugen</h2>
        <p>
          Erstellt in einem Schwung Rechnungsentwürfe für alle im Zeitraum aktiven Mietparteien. Einheiten mit bereits
          bestehender, überschneidender Rechnung werden übersprungen.
        </p>
        <BatchEntwuerfeForm />
      </div>
    </div>
  );
}
