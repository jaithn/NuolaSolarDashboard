import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { verbrauchKwhFuerEinheit } from "@/lib/billing/consumption";
import { isMietparteiEffectivelyAktiv, mietparteiAnzeigeName } from "@/lib/mietpartei";
import { createEinheitManualMesswertAction } from "./actions";
import { startOfMonth, endOfMonth } from "date-fns";

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ objektId?: string; von?: string; bis?: string; ok?: string; fehler?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const von = sp.von ? new Date(sp.von) : startOfMonth(now);
  const bis = sp.bis ? new Date(sp.bis) : endOfMonth(now);

  // Aktuelle Filter als Query fuer den Rueck-Redirect nach dem manuellen Wert.
  const filterQs = new URLSearchParams();
  if (sp.objektId) filterQs.set("objektId", sp.objektId);
  if (sp.von) filterQs.set("von", sp.von);
  if (sp.bis) filterQs.set("bis", sp.bis);
  const zurueckUrl = `/admin${filterQs.toString() ? `?${filterQs.toString()}` : ""}`;

  const pollIntervalMinutes = Number(process.env.POLL_INTERVAL_MINUTES ?? "10");
  const onlineSchwelleMs = pollIntervalMinutes * 2 * 60 * 1000;

  const [objekte, geraete] = await Promise.all([
    prisma.objekt.findMany({ orderBy: { name: "asc" } }),
    prisma.shellyGeraet.findMany({
      // Virtuelle „Manueller Zähler" (serverHost leer) gehören nicht in die
      // Live-Status-Liste - sie werden nicht gepollt.
      where: { serverHost: { not: "" }, ...(sp.objektId ? { objektId: sp.objektId } : {}) },
      include: { objekt: true, zuordnungen: { include: { einheit: true } } },
      orderBy: [{ objekt: { name: "asc" } }, { bezeichnung: "asc" }],
    }),
  ]);

  // Letzten Messwert-Zeitstempel je Geraet in EINER Query ermitteln (statt
  // einer Query pro Geraet).
  const letzteMesswerte = await prisma.messwert.groupBy({
    by: ["geraetId"],
    where: { geraetId: { in: geraete.map((g) => g.id) } },
    _max: { timestamp: true },
  });
  const letzterTimestampProGeraet = new Map(letzteMesswerte.map((m) => [m.geraetId, m._max.timestamp]));

  const geraeteMitStatus = geraete.map((g) => {
    const letzterTimestamp = letzterTimestampProGeraet.get(g.id) ?? null;
    const online = Boolean(letzterTimestamp && now.getTime() - letzterTimestamp.getTime() < onlineSchwelleMs);
    return { ...g, letzterTimestamp, online };
  });

  // Nach Objekt gruppieren (geraeteMitStatus ist bereits nach Objektname
  // sortiert, die Map-Reihenfolge bleibt dadurch erhalten).
  const geraeteNachObjekt = new Map<
    string,
    { objektId: string; objektName: string; geraete: typeof geraeteMitStatus }
  >();
  for (const g of geraeteMitStatus) {
    const gruppe = geraeteNachObjekt.get(g.objektId);
    if (gruppe) {
      gruppe.geraete.push(g);
    } else {
      geraeteNachObjekt.set(g.objektId, { objektId: g.objektId, objektName: g.objekt.name, geraete: [g] });
    }
  }

  const einheiten = await prisma.einheit.findMany({
    where: sp.objektId ? { objektId: sp.objektId } : undefined,
    include: {
      objekt: true,
      mietparteien: true,
      geraetZuordnungen: { where: { modus: "ADDIEREN" }, take: 1 },
    },
    // Innerhalb eines Objekts primaer nach Einheit sortiert.
    orderBy: [{ objekt: { name: "asc" } }, { bezeichnung: "asc" }],
  });
  const verbrauchProEinheit = await Promise.all(
    einheiten.map(async (e) => ({
      einheit: e,
      // Anzuzeigende Mietpartei: bevorzugt die aktuell aktive; ist keine aktiv
      // (z.B. nur Interessent:in oder zukuenftiger Lieferbeginn), fällt die
      // Anzeige auf die jüngste Mietpartei zurück - sonst stünde nur "–".
      mieter:
        e.mietparteien.find((m) => isMietparteiEffectivelyAktiv(m)) ??
        [...e.mietparteien].sort((a, b) => b.einzugsdatum.getTime() - a.einzugsdatum.getTime())[0] ??
        null,
      hatGeraet: e.geraetZuordnungen.length > 0,
      verbrauchKwh: await verbrauchKwhFuerEinheit(e.id, { von, bis }),
    })),
  );

  return (
    <div>
      <h1>Admin-Übersicht</h1>

      <div className="section">
        <h2>Live-Status der Zähler</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Zähler</th>
              <th>Einheit</th>
              <th>Letzter Messwert</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...geraeteNachObjekt.values()].map((gruppe) => (
              <Fragment key={gruppe.objektId}>
                <tr>
                  <th colSpan={4} className="group-row">
                    <Link href={`/admin/objekte/${gruppe.objektId}`}>{gruppe.objektName}</Link>
                  </th>
                </tr>
                {gruppe.geraete.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <Link href={`/admin/geraete/${g.id}`}>{g.bezeichnung}</Link>
                    </td>
                    <td>
                      {g.zuordnungen.length > 0
                        ? g.zuordnungen.map((z) => z.einheit.bezeichnung).join(", ")
                        : "–"}
                    </td>
                    <td>{g.letzterTimestamp ? g.letzterTimestamp.toLocaleString("de-DE") : "–"}</td>
                    <td>
                      {!g.aktiv ? (
                        <span className="status-badge inaktiv">deaktiviert</span>
                      ) : (
                        <span className={`status-badge ${g.online ? "aktiv" : "inaktiv"}`}>
                          {g.online ? "online" : "offline"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {geraeteMitStatus.length === 0 && (
              <tr>
                <td colSpan={4}>Keine Zähler gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Verbrauchsübersicht</h2>
        {sp.ok && <div className="form-notice" role="status">Manueller Zählerstand gespeichert.</div>}
        {sp.fehler && <div className="form-error" role="alert">{sp.fehler}</div>}
        <form method="get" className="form-grid" style={{ marginBottom: "1rem" }}>
          <div className="field">
            <label htmlFor="objektId">Objekt</label>
            <select id="objektId" name="objektId" className="select-inline" defaultValue={sp.objektId ?? ""}>
              <option value="">Alle Objekte</option>
              {objekte.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="von">Von</label>
            <input id="von" name="von" type="date" defaultValue={toDateInputValue(von)} />
          </div>
          <div className="field">
            <label htmlFor="bis">Bis</label>
            <input id="bis" name="bis" type="date" defaultValue={toDateInputValue(bis)} />
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <button className="btn-small" type="submit">
              Filtern
            </button>
          </div>
        </form>

        <table className="data-table">
          <thead>
            <tr>
              <th>Objekt</th>
              <th>Einheit</th>
              <th>Mietpartei</th>
              <th>Verbrauch (<span className="unit">kWh</span>)</th>
              <th>Manueller Zählerstand (<span className="unit">kWh</span>)</th>
            </tr>
          </thead>
          <tbody>
            {verbrauchProEinheit.map(({ einheit, mieter, hatGeraet, verbrauchKwh }) => (
              <tr key={einheit.id}>
                <td>
                  <Link href={`/admin/objekte/${einheit.objektId}`}>{einheit.objekt.name}</Link>
                </td>
                <td>
                  <Link href={`/admin/einheiten/${einheit.id}`}>{einheit.bezeichnung}</Link>
                </td>
                <td>
                  {mieter ? (
                    <Link href={`/admin/mietparteien/${mieter.id}`}>{mietparteiAnzeigeName(mieter)}</Link>
                  ) : (
                    "–"
                  )}
                </td>
                <td>{verbrauchKwh.toFixed(2)}</td>
                <td>
                  {/* Manueller Zählerstand ist immer möglich - fehlt ein Zähler,
                     legt die Action automatisch einen „Manueller Zähler" an. */}
                  <form action={createEinheitManualMesswertAction} style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                    <input type="hidden" name="einheitId" value={einheit.id} />
                    <input type="hidden" name="zurueck" value={zurueckUrl} />
                    <input
                      className="text-input"
                      name="datum"
                      type="date"
                      required
                      defaultValue={toDateInputValue(now)}
                      aria-label={`Datum des Zählerstands für ${einheit.bezeichnung}`}
                      style={{ maxWidth: "9rem" }}
                    />
                    <input
                      className="text-input"
                      name="kwh"
                      type="number"
                      step="0.001"
                      min={0}
                      required
                      aria-label={`Manueller Zählerstand (kWh) für ${einheit.bezeichnung}`}
                      placeholder="kWh"
                      style={{ maxWidth: "8rem" }}
                    />
                    <button className="btn-small" type="submit">
                      Eintragen
                    </button>
                  </form>
                  {!hatGeraet && (
                    <span style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                      Ohne Zähler – legt beim ersten Wert einen manuellen Zähler an.
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {verbrauchProEinheit.length === 0 && (
              <tr>
                <td colSpan={5}>Keine Einheiten gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>

        <p style={{ marginTop: "1rem" }}>
          <a
            href={`/api/admin/export/messwerte?von=${toDateInputValue(von)}&bis=${toDateInputValue(bis)}${
              sp.objektId ? `&objektId=${sp.objektId}` : ""
            }`}
          >
            Rohdaten als CSV exportieren
          </a>
        </p>
      </div>
    </div>
  );
}
