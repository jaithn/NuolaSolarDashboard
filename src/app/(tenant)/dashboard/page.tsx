import { getSession } from "@/lib/auth/getSession";
import { prisma } from "@/lib/db";
import { getMonatsverbraeuche } from "@/lib/billing/monatsverbrauch";
import { berechneBrutto } from "@/lib/steuer";
import { VerbrauchsChart } from "./VerbrauchsChart";
import { KostenChart } from "./KostenChart";

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
    include: { mietpartei: { include: { arbeitspreisSteuersatz: true, grundpreisSteuersatz: true } } },
  });
  const mietpartei = nutzer.mietpartei!;
  const einheitId = mietpartei.einheitId;

  // 13 Monate anfordern, damit sowohl der Vormonat als auch derselbe Monat
  // des Vorjahres fuer den Vergleich verfuegbar sind.
  const monate = await getMonatsverbraeuche(einheitId, 13);
  const chartDaten = monate.slice(1); // fuer die Grafik nur die letzten 12 anzeigen

  const aktuellerMonat = monate[monate.length - 1]!;
  const vormonat = monate[monate.length - 2];
  const vorjahresmonat = monate[0];

  // Kosten (brutto) je Monat: Verbrauch × Arbeitspreis + monatliche Grundgebühr,
  // jeweils inkl. des am Vertrag hinterlegten Steuersatzes.
  const arbeitsProz = mietpartei.arbeitspreisSteuersatz.prozentsatz;
  const grundBruttoProMonat =
    mietpartei.grundpreisNetto && mietpartei.grundpreisSteuersatz
      ? berechneBrutto(mietpartei.grundpreisNetto, mietpartei.grundpreisSteuersatz.prozentsatz).bruttoBetrag
      : 0;
  const kostenDaten = chartDaten.map((m) => {
    const arbeitBrutto = berechneBrutto(m.verbrauchKwh * mietpartei.arbeitspreisNetto, arbeitsProz).bruttoBetrag;
    return { label: m.label, kostenBrutto: Math.round((arbeitBrutto + grundBruttoProMonat) * 100) / 100 };
  });

  // Aktueller Stand: Zeitpunkt des jüngsten Messwerts der zugeordneten Geräte.
  // Wird bei jedem Seitenaufruf (Server-Render) neu gelesen.
  const zuordnungen = await prisma.geraetZuordnung.findMany({
    where: { einheitId },
    select: { shellyGeraetId: true },
  });
  const geraetIds = zuordnungen.map((z) => z.shellyGeraetId);
  const letzter =
    geraetIds.length > 0
      ? await prisma.messwert.aggregate({ where: { geraetId: { in: geraetIds } }, _max: { timestamp: true } })
      : null;
  const stand = letzter?._max.timestamp ?? null;

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
        <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: 0 }}>
          Stand: {stand ? stand.toLocaleString("de-DE") : "noch keine Messwerte"}
        </p>
      </div>

      <div className="section">
        <h2>Verlauf der letzten 12 Monate</h2>
        <VerbrauchsChart daten={chartDaten} />
      </div>

      <div className="section">
        <h2>Kosten im Jahresverlauf</h2>
        <p style={{ color: "var(--color-muted)", marginTop: 0, fontSize: "0.85rem" }}>
          Geschätzte monatliche Stromkosten (brutto): Verbrauch × Arbeitspreis
          {grundBruttoProMonat > 0 ? " zzgl. monatlicher Grundgebühr" : ""}. Die verbindliche Abrechnung
          erfolgt über Ihre Jahres-/Schlussrechnung.
        </p>
        <KostenChart daten={kostenDaten} />
      </div>
    </div>
  );
}
