import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { GeraetForm } from "../GeraetForm";
import { ManualMesswertForm } from "./ManualMesswertForm";
import { toggleGeraetAktivAction } from "../actions";

export default async function GeraetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [geraet, objekte, messwerte] = await Promise.all([
    prisma.shellyGeraet.findUnique({
      where: { id },
      include: { zuordnungen: { include: { einheit: { include: { objekt: true } } } } },
    }),
    prisma.objekt.findMany({ orderBy: { name: "asc" } }),
    prisma.messwert.findMany({ where: { geraetId: id }, orderBy: { timestamp: "desc" }, take: 60 }),
  ]);
  if (!geraet) notFound();

  // Phasen, aktueller Zaehlerstand je Phase, und die letzten 10 Abfragen
  // (nach Zeitstempel gruppiert, ein Messwert je Phase pro Abfrage).
  const phasen = [...new Set(messwerte.map((m) => m.phase))].sort();
  const aktuellProPhase = new Map<string, { energyWh: number; timestamp: Date; quelle: string }>();
  for (const m of messwerte) {
    if (!aktuellProPhase.has(m.phase)) {
      aktuellProPhase.set(m.phase, { energyWh: m.energyWh, timestamp: m.timestamp, quelle: m.quelle });
    }
  }
  const abfragen = new Map<number, { timestamp: Date; werte: Map<string, { energyWh: number; quelle: string }> }>();
  for (const m of messwerte) {
    const key = m.timestamp.getTime();
    let g = abfragen.get(key);
    if (!g) {
      g = { timestamp: m.timestamp, werte: new Map() };
      abfragen.set(key, g);
    }
    g.werte.set(m.phase, { energyWh: m.energyWh, quelle: m.quelle });
  }
  const letzteAbfragen = [...abfragen.values()]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);

  const kwh = (wh: number) => (wh / 1000).toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div>
      <h1>{geraet.bezeichnung}</h1>

      <div className="section">
        <h2>Stammdaten</h2>
        <GeraetForm mode="edit" objekte={objekte} geraet={geraet} />
      </div>

      <div className="section">
        <h2>Zugeordnete Einheiten</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Objekt</th>
              <th>Einheit</th>
              <th>Modus</th>
            </tr>
          </thead>
          <tbody>
            {geraet.zuordnungen.map((z) => (
              <tr key={z.id}>
                <td>{z.einheit.objekt.name}</td>
                <td>
                  <Link href={`/admin/einheiten/${z.einheit.id}`}>{z.einheit.bezeichnung}</Link>
                </td>
                <td>{z.modus === "SUBTRAHIEREN" ? "Subtrahieren (Allgemeinstrom)" : "Addieren"}</td>
              </tr>
            ))}
            {geraet.zuordnungen.length === 0 && (
              <tr>
                <td colSpan={3}>Noch keiner Einheit zugeordnet.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p style={{ fontSize: "0.85rem", color: "#475569", marginTop: "0.5rem" }}>
          Zuordnungen werden auf der jeweiligen Einheiten-Seite angelegt/entfernt.
        </p>
      </div>

      <div className="section">
        <h2>Aktueller Zählerstand</h2>
        {phasen.length === 0 ? (
          <p>Noch keine Messwerte erfasst.</p>
        ) : (
          <table className="data-table" style={{ maxWidth: "32rem" }}>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Zählerstand (kWh)</th>
                <th>Zeitpunkt</th>
              </tr>
            </thead>
            <tbody>
              {phasen.map((p) => {
                const a = aktuellProPhase.get(p)!;
                return (
                  <tr key={p}>
                    <td>{p}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      {kwh(a.energyWh)}
                      {a.quelle === "MANUELL" && (
                        <span className="status-badge inaktiv" style={{ marginLeft: 6 }}>
                          manuell
                        </span>
                      )}
                    </td>
                    <td>{a.timestamp.toLocaleString("de-DE")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Letzte 10 Abfragen</h2>
        {letzteAbfragen.length === 0 ? (
          <p>Noch keine Abfragen erfasst.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Zeitpunkt</th>
                {phasen.map((p) => (
                  <th key={p}>Phase {p} (kWh)</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {letzteAbfragen.map((a) => (
                <tr key={a.timestamp.getTime()}>
                  <td>{a.timestamp.toLocaleString("de-DE")}</td>
                  {phasen.map((p) => {
                    const zelle = a.werte.get(p);
                    return (
                      <td key={p} style={{ fontFamily: "var(--font-mono)" }}>
                        {zelle ? kwh(zelle.energyWh) : "–"}
                        {zelle?.quelle === "MANUELL" && (
                          <span className="status-badge inaktiv" style={{ marginLeft: 6 }}>
                            manuell
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Manuellen Messwert eintragen</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>
          Kumulativer Zählerstand (kWh) zu einem Zeitpunkt, z.B. bei Ausfall oder manueller Ablesung.
          Manuelle Werte werden im Log und auf der Rechnung markiert.
        </p>
        <ManualMesswertForm geraetId={geraet.id} />
      </div>

      <div className="section">
        <h2>Status</h2>
        <p>
          Aktuell: <span className={`status-badge ${geraet.aktiv ? "aktiv" : "inaktiv"}`}>
            {geraet.aktiv ? "aktiv" : "deaktiviert"}
          </span>
          {geraet.deaktiviertAb && ` seit ${geraet.deaktiviertAb.toLocaleDateString("de-DE")}`}
        </p>
        <p>
          Ein deaktiviertes Gerät wird vom Worker nicht mehr abgefragt, bereits erfasste Messwerte
          bleiben aber vollständig erhalten.
        </p>
        <form action={toggleGeraetAktivAction}>
          <input type="hidden" name="id" value={geraet.id} />
          <button className="btn-small" type="submit">
            {geraet.aktiv ? "Deaktivieren" : "Reaktivieren"}
          </button>
        </form>
      </div>
    </div>
  );
}
