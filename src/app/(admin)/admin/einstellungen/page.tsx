import { prisma } from "@/lib/db";
import { FirmenStammdatenForm } from "./FirmenStammdatenForm";
import { DesignvorlageForm } from "./DesignvorlageForm";
import { TestMailForm } from "./TestMailForm";

export default async function EinstellungenPage() {
  const [firma, designvorlage] = await Promise.all([
    prisma.firmenStammdaten.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", name: "Nuola Solar GbR", anschrift: "" },
    }),
    prisma.rechnungsDesignvorlage.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
  ]);

  return (
    <div>
      <h1>Einstellungen</h1>

      <div className="section">
        <h2>Firmenstammdaten</h2>
        <p>Werden auf jeder Rechnung als Pflichtangaben nach § 14 UStG ausgewiesen.</p>
        <FirmenStammdatenForm {...firma} />
      </div>

      <div className="section">
        <h2>Rechnungs-Designvorlage</h2>
        <p>Logo, Farben und Fußzeile für das PDF-Layout der Rechnungen.</p>
        <DesignvorlageForm {...designvorlage} />
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
    </div>
  );
}
