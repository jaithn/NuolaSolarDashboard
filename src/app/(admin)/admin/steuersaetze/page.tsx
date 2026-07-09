import { prisma } from "@/lib/db";
import { NewSteuersatzForm } from "./NewSteuersatzForm";

function formatDate(d: Date | null): string {
  if (!d) return "–";
  return d.toLocaleDateString("de-DE");
}

export default async function SteuersaetzePage() {
  const steuersaetze = await prisma.steuersatz.findMany({ orderBy: { gueltigAb: "desc" } });

  return (
    <div>
      <h1>Steuersätze</h1>
      <p>
        Steuersätze werden nie überschrieben oder gelöscht, damit rückwirkende Rechnungsberechnungen
        stets den zum Leistungszeitpunkt gültigen Satz verwenden. Ein neuer Satz mit künftigem
        Gültig-ab-Datum ergänzt die Historie.
      </p>

      <div className="section">
        <h2>Historie</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Bezeichnung</th>
              <th>Prozentsatz</th>
              <th>Gültig ab</th>
              <th>Gültig bis</th>
            </tr>
          </thead>
          <tbody>
            {steuersaetze.map((s) => (
              <tr key={s.id}>
                <td>{s.bezeichnung}</td>
                <td>{s.prozentsatz}%</td>
                <td>{formatDate(s.gueltigAb)}</td>
                <td>{formatDate(s.gueltigBis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Neuen Steuersatz anlegen</h2>
        <NewSteuersatzForm />
      </div>
    </div>
  );
}
