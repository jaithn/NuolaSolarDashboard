import Link from "next/link";
import { prisma } from "@/lib/db";
import { MietparteiAnlegenPanel } from "./MietparteiAnlegenPanel";
import { mietparteiAnzeigeName, istMietparteiInaktiv } from "@/lib/mietpartei";

// Status-Badge einer Mietpartei (manuell gepflegter Status; ein zukünftiger
// Lieferbeginn macht eine AKTIVE Partei NICHT inaktiv, nur ein erfolgter Auszug).
function badgeFuer(m: { status: string; auszugsdatum: Date | null }) {
  const ausgezogen = m.auszugsdatum != null && m.auszugsdatum < new Date();
  if (m.status === "INTERESSENT") return { klasse: "interessent", text: "Interessent:in" };
  if (m.status === "AKTIV" && !ausgezogen) return { klasse: "aktiv", text: "aktiv" };
  return { klasse: "inaktiv", text: "inaktiv" };
}

export default async function MietparteienPage() {
  const [mietparteien, einheiten, objekte, steuersaetze] = await Promise.all([
    prisma.mietpartei.findMany({
      // Primaer nach Objektname, dann Einheit, dann Nachname (Firmen nach firma).
      orderBy: [
        { einheit: { objekt: { name: "asc" } } },
        { einheit: { bezeichnung: "asc" } },
        { name: "asc" },
        { firma: "asc" },
      ],
      include: { einheit: { include: { objekt: true } } },
    }),
    prisma.einheit.findMany({ include: { objekt: true }, orderBy: { bezeichnung: "asc" } }),
    prisma.objekt.findMany({
      orderBy: { name: "asc" },
      // Zähler des Objekts für die Allgemeinstrom-Maske (Zuordnung von
      // Allgemeinstrom- und Wärmepumpen-Zähler direkt beim Anlegen). Virtuelle
      // „Manueller Zähler" (serverHost leer) sind hier bewusst mit dabei.
      include: { shellyGeraete: { orderBy: { bezeichnung: "asc" }, select: { id: true, bezeichnung: true } } },
    }),
    prisma.steuersatz.findMany({ orderBy: { gueltigAb: "desc" } }),
  ]);

  const einheitOptions = einheiten.map((e) => ({
    id: e.id,
    label: `${e.objekt.name} – ${e.bezeichnung}`,
    adresse: e.objekt.adresse,
    plz: e.objekt.plz,
    ort: e.objekt.ort,
  }));

  // Objekte mit Vermieter-Daten fuer die Allgemeinstrom-Maske (Vorbelegung).
  const objektOptions = objekte.map((o) => ({
    id: o.id,
    name: o.name,
    vermieterName: o.vermieterName,
    vermieterName2: o.vermieterName2,
    vermieterAnrede: o.vermieterAnrede,
    vermieterFirma: o.vermieterFirma,
    vermieterAnschrift: o.vermieterAnschrift,
    vermieterPlz: o.vermieterPlz,
    vermieterOrt: o.vermieterOrt,
    geraete: o.shellyGeraete.map((g) => ({ id: g.id, bezeichnung: g.bezeichnung })),
  }));

  // Aktive Mietparteien nach Objekt gruppieren (Reihenfolge folgt der Sortierung
  // oben: Objektname → Einheit → Name). Inaktive kommen ins Archiv.
  type Zeile = (typeof mietparteien)[number];
  const aktive = mietparteien.filter((m) => !istMietparteiInaktiv(m));
  const inaktive = mietparteien.filter((m) => istMietparteiInaktiv(m));

  const gruppen: { objekt: Zeile["einheit"]["objekt"]; parteien: Zeile[] }[] = [];
  const idxNachObjekt = new Map<string, number>();
  for (const m of aktive) {
    const o = m.einheit.objekt;
    let i = idxNachObjekt.get(o.id);
    if (i === undefined) {
      i = gruppen.length;
      idxNachObjekt.set(o.id, i);
      gruppen.push({ objekt: o, parteien: [] });
    }
    gruppen[i]!.parteien.push(m);
  }

  return (
    <div>
      <MietparteiAnlegenPanel einheiten={einheitOptions} objekte={objektOptions} steuersaetze={steuersaetze} />

      {mietparteien.length === 0 && (
        <div className="section">
          <p>Noch keine Mietparteien angelegt. Lege über das +-Menü oben rechts deine erste an.</p>
        </div>
      )}

      {mietparteien.length > 0 && gruppen.length === 0 && (
        <div className="section">
          <p>Keine aktiven Mietparteien. Inaktive findest du im Archiv unten.</p>
        </div>
      )}

      {/* Eine Box pro Objekt (wie auf der Objekte-Übersicht). */}
      {gruppen.map((g) => (
        <div className="section" key={g.objekt.id}>
          <h2 style={{ marginTop: 0, marginBottom: "0.15rem" }}>
            <Link href={`/admin/objekte/${g.objekt.id}`}>{g.objekt.name}</Link>
          </h2>
          <p style={{ margin: "0 0 0.6rem", color: "var(--color-muted)", fontSize: "0.9rem" }}>
            {g.objekt.adresse}
            {g.objekt.plz || g.objekt.ort ? `, ${g.objekt.plz} ${g.objekt.ort}`.trimEnd() : ""}
          </p>
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
              {g.parteien.map((m) => {
                const badge = badgeFuer(m);
                return (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/admin/mietparteien/${m.id}`}>{mietparteiAnzeigeName(m)}</Link>
                    </td>
                    <td>{m.einheit.bezeichnung}</td>
                    <td>{m.einzugsdatum.toLocaleDateString("de-DE")}</td>
                    <td>{m.auszugsdatum ? m.auszugsdatum.toLocaleDateString("de-DE") : "–"}</td>
                    <td>
                      <span className={`status-badge ${badge.klasse}`}>{badge.text}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Archiv: inaktive Mietparteien, standardmäßig eingeklappt. */}
      {inaktive.length > 0 && (
        <details className="section archiv-details">
          <summary className="archiv-summary">
            Archiv – {inaktive.length} inaktive {inaktive.length === 1 ? "Mietpartei" : "Mietparteien"}
          </summary>
          <table className="data-table" style={{ marginTop: "1rem" }}>
            <thead>
              <tr>
                <th>Name / Firma</th>
                <th>Objekt – Einheit</th>
                <th>Lieferbeginn</th>
                <th>Lieferende</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inaktive.map((m) => {
                const badge = badgeFuer(m);
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
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
