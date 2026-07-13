import Link from "next/link";
import { prisma } from "@/lib/db";
import { MietparteiAnlegenPanel } from "./MietparteiAnlegenPanel";
import { isMietparteiEffectivelyAktiv, mietparteiAnzeigeName } from "@/lib/mietpartei";

export default async function MietparteienPage() {
  const [mietparteien, einheiten, steuersaetze] = await Promise.all([
    prisma.mietpartei.findMany({
      // Primaer nach Objektname, dann nach Nachname (Firmen nach firma-Feld).
      orderBy: [
        { einheit: { objekt: { name: "asc" } } },
        { einheit: { bezeichnung: "asc" } },
        { name: "asc" },
        { firma: "asc" },
      ],
      include: { einheit: { include: { objekt: true } } },
    }),
    prisma.einheit.findMany({ include: { objekt: true }, orderBy: { bezeichnung: "asc" } }),
    prisma.steuersatz.findMany({ orderBy: { gueltigAb: "desc" } }),
  ]);

  const einheitOptions = einheiten.map((e) => ({
    id: e.id,
    label: `${e.objekt.name} – ${e.bezeichnung}`,
    adresse: e.objekt.adresse,
    plz: e.objekt.plz,
    ort: e.objekt.ort,
  }));

  return (
    <div>
      <h1>Mietparteien</h1>

      <div className="section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name / Firma</th>
              <th>Einheit</th>
              <th>Lieferbeginn</th>
              <th>Lieferende</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mietparteien.map((m) => {
              const aktiv = isMietparteiEffectivelyAktiv(m);
              // Interessenten sind (noch) nicht effektiv aktiv, aber als eigener
              // Status kenntlich zu machen; sonst greift aktiv/inaktiv.
              const badge =
                m.status === "INTERESSENT"
                  ? { klasse: "interessent", text: "Interessent:in" }
                  : aktiv
                    ? { klasse: "aktiv", text: "aktiv" }
                    : { klasse: "inaktiv", text: "inaktiv" };
              return (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/mietparteien/${m.id}`}>{mietparteiAnzeigeName(m)}</Link>
                  </td>
                  <td>
                    {m.einheit.objekt.name} – {m.einheit.bezeichnung}
                  </td>
                  <td>{m.einzugsdatum.toLocaleDateString("de-DE")}</td>
                  <td>{m.auszugsdatum ? m.auszugsdatum.toLocaleDateString("de-DE") : "–"}</td>
                  <td>
                    <span className={`status-badge ${badge.klasse}`}>{badge.text}</span>
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
        <h2>Neue Mietpartei / Interessent:in anlegen</h2>
        {einheitOptions.length === 0 ? (
          <p>Bitte zuerst ein Objekt mit Einheit anlegen.</p>
        ) : steuersaetze.length === 0 ? (
          <p>Bitte zuerst einen Steuersatz anlegen.</p>
        ) : (
          <MietparteiAnlegenPanel einheiten={einheitOptions} steuersaetze={steuersaetze} />
        )}
      </div>
    </div>
  );
}
