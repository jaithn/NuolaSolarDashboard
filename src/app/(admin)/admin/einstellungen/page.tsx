import { prisma } from "@/lib/db";
import { FirmenStammdatenForm } from "./FirmenStammdatenForm";
import { TestMailForm } from "./TestMailForm";
import { ThemeToggle } from "./ThemeToggle";
import { APP_VERSION, APP_GIT_SHA } from "@/lib/version";

export default async function EinstellungenPage() {
  const firma = await prisma.firmenStammdaten.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", name: "Nuola Solar GbR", anschrift: "" },
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
