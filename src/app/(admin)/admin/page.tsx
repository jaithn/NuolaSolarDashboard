import { prisma } from "@/lib/db";
import { verbrauchKwhFuerEinheit } from "@/lib/billing/consumption";
import { startOfMonth, endOfMonth } from "date-fns";

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ objektId?: string; von?: string; bis?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const von = sp.von ? new Date(sp.von) : startOfMonth(now);
  const bis = sp.bis ? new Date(sp.bis) : endOfMonth(now);

  const pollIntervalMinutes = Number(process.env.POLL_INTERVAL_MINUTES ?? "10");
  const onlineSchwelleMs = pollIntervalMinutes * 2 * 60 * 1000;

  const [objekte, geraete] = await Promise.all([
    prisma.objekt.findMany({ orderBy: { name: "asc" } }),
    prisma.shellyGeraet.findMany({
      where: sp.objektId ? { objektId: sp.objektId } : undefined,
      include: { objekt: true, zuordnungen: { include: { einheit: true } } },
      orderBy: [{ objekt: { name: "asc" } }, { bezeichnung: "asc" }],
    }),
  ]);

  const geraeteMitStatus = await Promise.all(
    geraete.map(async (g) => {
      const letzter = await prisma.messwert.findFirst({ where: { geraetId: g.id }, orderBy: { timestamp: "desc" } });
      const online = Boolean(letzter && now.getTime() - letzter.timestamp.getTime() < onlineSchwelleMs);
      return { ...g, letzterMesswert: letzter, online };
    }),
  );

  const einheiten = await prisma.einheit.findMany({
    where: sp.objektId ? { objektId: sp.objektId } : undefined,
    include: { objekt: true },
    orderBy: [{ objekt: { name: "asc" } }, { bezeichnung: "asc" }],
  });
  const verbrauchProEinheit = await Promise.all(
    einheiten.map(async (e) => ({
      einheit: e,
      verbrauchKwh: await verbrauchKwhFuerEinheit(e.id, { von, bis }),
    })),
  );

  return (
    <div>
      <h1>Admin-Übersicht</h1>

      <div className="section">
        <h2>Live-Status der Geräte</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Gerät</th>
              <th>Objekt</th>
              <th>Einheit</th>
              <th>Letzter Messwert</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {geraeteMitStatus.map((g) => (
              <tr key={g.id}>
                <td>
                  <a href={`/admin/geraete/${g.id}`}>{g.bezeichnung}</a>
                </td>
                <td>{g.objekt.name}</td>
                <td>
                  {g.zuordnungen.length > 0
                    ? g.zuordnungen.map((z) => z.einheit.bezeichnung).join(", ")
                    : "–"}
                </td>
                <td>{g.letzterMesswert ? g.letzterMesswert.timestamp.toLocaleString("de-DE") : "–"}</td>
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
            {geraeteMitStatus.length === 0 && (
              <tr>
                <td colSpan={5}>Keine Geräte gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Verbrauchsübersicht</h2>
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
              <th>Verbrauch (kWh)</th>
            </tr>
          </thead>
          <tbody>
            {verbrauchProEinheit.map(({ einheit, verbrauchKwh }) => (
              <tr key={einheit.id}>
                <td>{einheit.objekt.name}</td>
                <td>{einheit.bezeichnung}</td>
                <td>{verbrauchKwh.toFixed(2)}</td>
              </tr>
            ))}
            {verbrauchProEinheit.length === 0 && (
              <tr>
                <td colSpan={3}>Keine Einheiten gefunden.</td>
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
