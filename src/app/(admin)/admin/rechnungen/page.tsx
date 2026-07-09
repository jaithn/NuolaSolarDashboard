import Link from "next/link";
import { prisma } from "@/lib/db";
import { NewRechnungForm } from "./NewRechnungForm";

const STATUS_LABEL: Record<string, string> = {
  ENTWURF: "Entwurf",
  FREIGEGEBEN: "Freigegeben",
  VERSENDET: "Versendet",
  STORNIERT: "Storniert",
};

export default async function RechnungenPage() {
  const [rechnungen, mietparteien] = await Promise.all([
    prisma.rechnung.findMany({
      orderBy: { erstelltAm: "desc" },
      include: { mietpartei: true },
      take: 100,
    }),
    prisma.mietpartei.findMany({ include: { einheit: { include: { objekt: true } } }, orderBy: { name: "asc" } }),
  ]);

  const mietparteiOptions = mietparteien.map((m) => ({
    id: m.id,
    label: `${m.name} (${m.einheit.objekt.name} – ${m.einheit.bezeichnung})`,
  }));

  return (
    <div>
      <h1>Rechnungen</h1>

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
                  <Link href={`/admin/rechnungen/${r.id}`}>{r.rechnungsnummer}</Link>
                </td>
                <td>{r.mietpartei.name}</td>
                <td>
                  {r.zeitraumVon.toLocaleDateString("de-DE")} – {r.zeitraumBis.toLocaleDateString("de-DE")}
                </td>
                <td>{r.verrechnungBetrag >= 0 ? "Nachzahlung" : "Guthaben"}: {Math.abs(r.verrechnungBetrag).toFixed(2)} €</td>
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
    </div>
  );
}
