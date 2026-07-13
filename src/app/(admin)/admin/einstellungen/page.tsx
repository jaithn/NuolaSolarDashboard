import { prisma } from "@/lib/db";
import { FirmenStammdatenForm } from "./FirmenStammdatenForm";
import { TestMailForm } from "./TestMailForm";
import { ThemeToggle } from "./ThemeToggle";
import { VertragstexteSync } from "./VertragstexteSync";
import { VERTRAGSART_LABEL } from "@/lib/vertrag";
import { APP_VERSION, APP_GIT_SHA } from "@/lib/version";

export default async function EinstellungenPage() {
  const firma = await prisma.firmenStammdaten.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", name: "Nuola Solar GbR", anschrift: "" },
  });

  const vertragVersionen = await prisma.vertragVersion.findMany({
    orderBy: [{ art: "asc" }, { gueltigAb: "desc" }],
  });

  return (
    <div>
      <h1>Einstellungen</h1>

      <div className="section">
        <h2>Firmenstammdaten</h2>
        <p>Werden auf jeder Rechnung als Pflichtangaben nach § 14 UStG ausgewiesen.</p>
        <FirmenStammdatenForm {...firma} />
      </div>

      <div className="section">
        <h2>Darstellung</h2>
        <p>Zwischen hellem und dunklem Design umschalten. Die Auswahl gilt für dieses Gerät.</p>
        <ThemeToggle />
      </div>

      <div className="section">
        <h2>SMTP-Test</h2>
        <p>
          Sendet eine Test-E-Mail an eine frei wählbare Adresse, um zu prüfen, ob die
          SMTP-Zugangsdaten (aus der <code>.env</code>) korrekt sind und E-Mails versendet werden
          können.
        </p>
        <TestMailForm />
      </div>

      <div className="section">
        <h2>Vertragstexte</h2>
        <p>
          Die Vertrags- und Brieftexte werden im Ordner <code>Dokumente/</code> als Markdown gepflegt.
          Nach dem Bearbeiten hier neu einlesen. Eine neue Vertragsversion (z.&nbsp;B.{" "}
          <code>…-v1.1.md</code>) beendet automatisch die vorherige; die Historie bleibt erhalten.
        </p>
        <table className="data-table" style={{ marginBottom: "1rem" }}>
          <thead>
            <tr>
              <th>Vertragsart</th>
              <th>Version</th>
              <th>Gültig ab</th>
              <th>Gültig bis</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vertragVersionen.map((v) => (
              <tr key={v.id}>
                <td>{VERTRAGSART_LABEL[v.art]}</td>
                <td>{v.version}</td>
                <td>{v.gueltigAb.toLocaleDateString("de-DE")}</td>
                <td>{v.gueltigBis ? v.gueltigBis.toLocaleDateString("de-DE") : "–"}</td>
                <td>
                  {v.gueltigBis === null ? (
                    <span className="status-badge aktiv">aktuell</span>
                  ) : (
                    <span className="status-badge inaktiv">Historie</span>
                  )}
                </td>
              </tr>
            ))}
            {vertragVersionen.length === 0 && (
              <tr>
                <td colSpan={5}>Noch keine Vertragsversionen – bitte einlesen.</td>
              </tr>
            )}
          </tbody>
        </table>
        <VertragstexteSync />
      </div>

      <div className="section">
        <h2>Version</h2>
        <p>
          Nuola Energy Dashboard{" "}
          <strong>v{APP_VERSION}</strong>
          {APP_GIT_SHA && (
            <>
              {" "}
              (<code>{APP_GIT_SHA}</code>)
            </>
          )}
        </p>
      </div>
    </div>
  );
}
