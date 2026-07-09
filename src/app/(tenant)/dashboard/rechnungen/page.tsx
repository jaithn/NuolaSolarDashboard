import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  FREIGEGEBEN: "Freigegeben",
  VERSENDET: "Versendet",
};

export default async function RechnungenPage() {
  const session = await getSession();
  const nutzer = await prisma.nutzer.findUniqueOrThrow({ where: { id: session.userId! } });

  const rechnungen = await prisma.rechnung.findMany({
    where: {
      mietparteiId: nutzer.mietparteiId!,
      status: { in: ["FREIGEGEBEN", "VERSENDET"] },
    },
    orderBy: { ausstellungsdatum: "desc" },
  });

  return (
    <div>
      <h1>Ihre Abrechnungen</h1>

      <div className="section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rechnungsnummer</th>
              <th>Typ</th>
              <th>Zeitraum</th>
              <th>Betrag</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rechnungen.map((r) => (
              <tr key={r.id}>
                <td>{r.rechnungsnummer}</td>
                <td>{r.typ === "SCHLUSSRECHNUNG" ? "Schlussrechnung" : "Jahresabrechnung"}</td>
                <td>
                  {r.zeitraumVon.toLocaleDateString("de-DE")} – {r.zeitraumBis.toLocaleDateString("de-DE")}
                </td>
                <td>{r.verrechnungBetrag >= 0 ? "Nachzahlung" : "Guthaben"}: {Math.abs(r.verrechnungBetrag).toFixed(2)} €</td>
                <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                <td>
                  {r.pdfPfad ? (
                    <a href={`/api/rechnungen/${r.id}/pdf`} target="_blank" rel="noreferrer">
                      PDF herunterladen
                    </a>
                  ) : (
                    "–"
                  )}
                </td>
              </tr>
            ))}
            {rechnungen.length === 0 && (
              <tr>
                <td colSpan={6}>Noch keine freigegebenen Abrechnungen vorhanden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
