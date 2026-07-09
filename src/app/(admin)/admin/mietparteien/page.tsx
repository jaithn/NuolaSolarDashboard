import Link from "next/link";
import { prisma } from "@/lib/db";
import { MietparteiForm } from "./MietparteiForm";
import { isMietparteiEffectivelyAktiv } from "@/lib/mietpartei";

export default async function MietparteienPage() {
  const [mietparteien, einheiten, steuersaetze] = await Promise.all([
    prisma.mietpartei.findMany({
      orderBy: { createdAt: "desc" },
      include: { einheit: { include: { objekt: true } } },
    }),
    prisma.einheit.findMany({ include: { objekt: true }, orderBy: { bezeichnung: "asc" } }),
    prisma.steuersatz.findMany({ orderBy: { gueltigAb: "desc" } }),
  ]);

  const einheitOptions = einheiten.map((e) => ({ id: e.id, label: `${e.objekt.name} – ${e.bezeichnung}` }));

  return (
    <div>
      <h1>Mietparteien</h1>

      <div className="section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Einheit</th>
              <th>Einzug</th>
              <th>Auszug</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mietparteien.map((m) => {
              const aktiv = isMietparteiEffectivelyAktiv(m);
              return (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/mietparteien/${m.id}`}>{m.name}</Link>
                  </td>
                  <td>
                    {m.einheit.objekt.name} – {m.einheit.bezeichnung}
                  </td>
                  <td>{m.einzugsdatum.toLocaleDateString("de-DE")}</td>
                  <td>{m.auszugsdatum ? m.auszugsdatum.toLocaleDateString("de-DE") : "–"}</td>
                  <td>
                    <span className={`status-badge ${aktiv ? "aktiv" : "inaktiv"}`}>
                      {aktiv ? "aktiv" : "inaktiv"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {mietparteien.length === 0 && (
              <tr>
                <td colSpan={5}>Noch keine Mietparteien angelegt.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Neue Mietpartei anlegen</h2>
        {einheitOptions.length === 0 ? (
          <p>Bitte zuerst ein Objekt mit Einheit anlegen.</p>
        ) : steuersaetze.length === 0 ? (
          <p>Bitte zuerst einen Steuersatz anlegen.</p>
        ) : (
          <MietparteiForm mode="create" einheiten={einheitOptions} steuersaetze={steuersaetze} />
        )}
      </div>
    </div>
  );
}
