import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";
import { getMonatsverbraeuche } from "@/lib/billing/monatsverbrauch";
import { VerbrauchsChart } from "./VerbrauchsChart";

function vergleich(aktuell: number, vorher: number | undefined): string {
  if (vorher === undefined || vorher === 0) return "–";
  const diffProzent = ((aktuell - vorher) / vorher) * 100;
  const vorzeichen = diffProzent > 0 ? "+" : "";
  return `${vorzeichen}${diffProzent.toFixed(1)}%`;
}

export default async function DashboardPage() {
  const session = await getSession();
  const nutzer = await prisma.nutzer.findUniqueOrThrow({
    where: { id: session.userId! },
    include: { mietpartei: true },
  });
  const einheitId = nutzer.mietpartei!.einheitId;

  // 13 Monate anfordern, damit sowohl der Vormonat als auch derselbe Monat
  // des Vorjahres fuer den Vergleich verfuegbar sind.
  const monate = await getMonatsverbraeuche(einheitId, 13);
  const chartDaten = monate.slice(1); // fuer die Grafik nur die letzten 12 anzeigen

  const aktuellerMonat = monate[monate.length - 1]!;
  const vormonat = monate[monate.length - 2];
  const vorjahresmonat = monate[0];

  return (
    <div>
      <h1>Ihr Stromverbrauch</h1>

      <div className="section">
        <h2>{aktuellerMonat.label}</h2>
        <p style={{ fontSize: "1.75rem", margin: "0.25rem 0" }}>{aktuellerMonat.verbrauchKwh.toFixed(2)} kWh</p>
        <p>
          Vormonat: {vergleich(aktuellerMonat.verbrauchKwh, vormonat?.verbrauchKwh)} · Vorjahresmonat:{" "}
          {vergleich(aktuellerMonat.verbrauchKwh, vorjahresmonat?.verbrauchKwh)}
        </p>
      </div>

      <div className="section">
        <h2>Verlauf der letzten 12 Monate</h2>
        <VerbrauchsChart daten={chartDaten} />
      </div>
    </div>
  );
}
