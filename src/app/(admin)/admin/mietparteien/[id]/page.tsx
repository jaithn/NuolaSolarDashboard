import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MietparteiForm } from "../MietparteiForm";
import { NewAbschlagForm } from "../NewAbschlagForm";
import { ZugangPanel } from "./ZugangPanel";

export default async function MietparteiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [mietpartei, einheiten, steuersaetze, nutzer] = await Promise.all([
    prisma.mietpartei.findUnique({ where: { id }, include: { einheit: { include: { objekt: true } } } }),
    prisma.einheit.findMany({ include: { objekt: true }, orderBy: { bezeichnung: "asc" } }),
    prisma.steuersatz.findMany({ orderBy: { gueltigAb: "desc" } }),
    prisma.nutzer.findUnique({ where: { mietparteiId: id } }),
  ]);
  if (!mietpartei) notFound();

  const abschlaege = await prisma.abschlag.findMany({
    where: { mietparteiId: id },
    orderBy: { gueltigAb: "desc" },
    include: { steuersatz: true },
  });

  const einheitOptions = einheiten.map((e) => ({ id: e.id, label: `${e.objekt.name} – ${e.bezeichnung}` }));

  return (
    <div>
      <h1>{mietpartei.name}</h1>
      <p>
        {mietpartei.einheit.objekt.name} – {mietpartei.einheit.bezeichnung}
      </p>

      <div className="section">
        <h2>Stammdaten</h2>
        <MietparteiForm mode="edit" einheiten={einheitOptions} steuersaetze={steuersaetze} mietpartei={mietpartei} />
      </div>

      <div className="section">
        <h2>Abschläge (Historie)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Netto</th>
              <th>Steuersatz</th>
              <th>Gültig ab</th>
              <th>Gültig bis</th>
            </tr>
          </thead>
          <tbody>
            {abschlaege.map((a) => (
              <tr key={a.id}>
                <td>{a.nettoBetrag.toFixed(2)} €</td>
                <td>{a.steuersatz.prozentsatz}%</td>
                <td>{a.gueltigAb.toLocaleDateString("de-DE")}</td>
                <td>{a.gueltigBis ? a.gueltigBis.toLocaleDateString("de-DE") : "–"}</td>
              </tr>
            ))}
            {abschlaege.length === 0 && (
              <tr>
                <td colSpan={4}>Noch kein Abschlag hinterlegt.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: "1rem" }}>
          <NewAbschlagForm mietparteiId={mietpartei.id} steuersaetze={steuersaetze} />
        </div>
      </div>

      <div className="section">
        <h2>Dashboard-Zugang</h2>
        <ZugangPanel
          mietparteiId={mietpartei.id}
          hasZugang={Boolean(nutzer)}
          username={nutzer?.username}
          mustChangePassword={nutzer?.mustChangePassword}
        />
      </div>
    </div>
  );
}
