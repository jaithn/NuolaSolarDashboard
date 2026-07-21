import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { OnboardingPanel } from "./OnboardingPanel";
import { MietparteiAktionenPanel } from "./MietparteiAktionenPanel";
import { deleteAbschlagAction } from "../actions";
import { mietparteiAnzeigeName, anredeKurz, weiterePersonenDerMietpartei, type Anrede } from "@/lib/mietpartei";
import { berechneBrutto } from "@/lib/steuer";

function fmtDatum(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("de-DE") : "–";
}
function toDateInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Read-only-Zeile „Label: Wert" für die Anzeige-Abschnitte. */
function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>{label}</div>
      <div>{children ?? "–"}</div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  INTERESSENT: "Interessent:in",
  AKTIV: "Aktiv",
  INAKTIV: "Inaktiv",
};

export default async function MietparteiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [mietpartei, einheiten, steuersaetze, nutzer] = await Promise.all([
    prisma.mietpartei.findUnique({ where: { id }, include: { einheit: { include: { objekt: true } } } }),
    prisma.einheit.findMany({ include: { objekt: true }, orderBy: { bezeichnung: "asc" } }),
    prisma.steuersatz.findMany({ orderBy: { gueltigAb: "desc" } }),
    prisma.nutzer.findUnique({ where: { mietparteiId: id } }),
  ]);
  if (!mietpartei) notFound();

  const [abschlaege, dokumente, vertragVersionen, freigegebeneRechnungen] = await Promise.all([
    prisma.abschlag.findMany({ where: { mietparteiId: id }, orderBy: { gueltigAb: "desc" }, include: { steuersatz: true } }),
    prisma.mietparteiDokument.findMany({ where: { mietparteiId: id }, orderBy: { hochgeladenAm: "desc" } }),
    prisma.vertragVersion.findMany({ orderBy: [{ art: "asc" }, { gueltigAb: "desc" }] }),
    prisma.rechnung.findMany({
      where: { mietparteiId: id, status: { in: ["FREIGEGEBEN", "VERSENDET"] } },
      orderBy: { zeitraumVon: "desc" },
    }),
  ]);

  const summeVerbrauchKwh = freigegebeneRechnungen.reduce((s, r) => s + r.gesamtVerbrauchKwh, 0);
  const summeVerrechnung = freigegebeneRechnungen.reduce((s, r) => s + r.verrechnungBetrag, 0);

  const einheitOptions = einheiten.map((e) => ({ id: e.id, label: `${e.objekt.name} – ${e.bezeichnung}` }));
  const steuersatzOptions = steuersaetze.map((s) => ({ id: s.id, bezeichnung: s.bezeichnung, prozentsatz: s.prozentsatz }));

  const anzeigeName = mietparteiAnzeigeName(mietpartei);
  const istFirma = mietpartei.anrede === "FIRMA";

  // Personen für die Anzeige (Hauptperson + weitere).
  const weitere = weiterePersonenDerMietpartei(mietpartei);
  const hauptperson = { anrede: mietpartei.anrede as Anrede, vorname: mietpartei.vorname, name: mietpartei.name };
  const alleAnzeigePersonen = [hauptperson, ...weitere];

  // Brutto-Preise für die Anzeige.
  const arbeitspreisSatz = steuersaetze.find((s) => s.id === mietpartei.arbeitspreisSteuersatzId);
  const arbeitspreisBrutto = arbeitspreisSatz
    ? berechneBrutto(mietpartei.arbeitspreisNetto, arbeitspreisSatz.prozentsatz).bruttoBetrag
    : null;
  const grundpreisSatz = steuersaetze.find((s) => s.id === mietpartei.grundpreisSteuersatzId);
  const grundpreisBrutto =
    mietpartei.grundpreisNetto != null && grundpreisSatz
      ? berechneBrutto(mietpartei.grundpreisNetto, grundpreisSatz.prozentsatz).bruttoBetrag
      : null;

  const aktuellerAbschlag = abschlaege[0] ?? null;
  const aktuellerAbschlagBrutto =
    aktuellerAbschlag != null
      ? aktuellerAbschlag.bruttoBetrag ?? berechneBrutto(aktuellerAbschlag.nettoBetrag, aktuellerAbschlag.steuersatz.prozentsatz).bruttoBetrag
      : null;

  return (
    <div>
      {/* Titel + +-Menü (alle Bearbeitungen laufen über das Menü). */}
      <MietparteiAktionenPanel
        titel={anzeigeName}
        mietparteiId={mietpartei.id}
        einheiten={einheitOptions}
        einheitId={mietpartei.einheitId}
        status={mietpartei.status}
        einzugsdatum={toDateInput(mietpartei.einzugsdatum)}
        auszugsdatum={toDateInput(mietpartei.auszugsdatum)}
        email={mietpartei.email}
        telefon={mietpartei.telefon ?? ""}
        anschrift={mietpartei.anschrift ?? ""}
        anschriftPlz={mietpartei.anschriftPlz}
        anschriftOrt={mietpartei.anschriftOrt}
        anrede={mietpartei.anrede ?? ""}
        firma={mietpartei.firma ?? ""}
        vorname={mietpartei.vorname}
        name={mietpartei.name}
        weiterePersonen={weitere.map((p) => ({ anrede: p.anrede ?? "", vorname: p.vorname, name: p.name }))}
        steuersaetze={steuersatzOptions}
        arbeitspreisNetto={mietpartei.arbeitspreisNetto}
        arbeitspreisSteuersatzId={mietpartei.arbeitspreisSteuersatzId}
        grundpreisNetto={mietpartei.grundpreisNetto}
        grundpreisSteuersatzId={mietpartei.grundpreisSteuersatzId}
        kontoinhaber={mietpartei.kontoinhaber}
        iban={mietpartei.iban ?? ""}
        bankName={mietpartei.bankName ?? ""}
        rechnungLabel={`${anzeigeName} – ${mietpartei.einheit.bezeichnung}`}
        hasZugang={Boolean(nutzer)}
        username={nutzer?.username}
        mustChangePassword={nutzer?.mustChangePassword}
        einheitBezeichnung={mietpartei.einheit.bezeichnung}
        istAllgemeinstrom={mietpartei.einheit.typ === "ALLGEMEINSTROM"}
        anschreibenVariante={mietpartei.anschreibenVariante}
        braucheErgaenzung={mietpartei.braucheErgaenzung}
      />

      <p style={{ marginTop: "-0.5rem" }}>
        {mietpartei.einheit.objekt.name} – {mietpartei.einheit.bezeichnung}
        {" · "}
        Kundennummer: <strong>{mietpartei.kundennummer ?? "—"}</strong>
      </p>

      {/* --- Read-only-Abschnitte --- */}
      <div className="section">
        <h2>Stammdaten</h2>
        <div className="form-grid">
          <Feld label="Objekt / Einheit">
            {mietpartei.einheit.objekt.name} – {mietpartei.einheit.bezeichnung}
          </Feld>
          <Feld label="Status">{STATUS_LABEL[mietpartei.status] ?? mietpartei.status}</Feld>
          <Feld label="Beginn der Stromlieferung">{fmtDatum(mietpartei.einzugsdatum)}</Feld>
          <Feld label="Auszugsdatum">{fmtDatum(mietpartei.auszugsdatum)}</Feld>
          <Feld label="E-Mail">{mietpartei.email || "–"}</Feld>
          <Feld label="Telefon">{mietpartei.telefon || "–"}</Feld>
          <Feld label="Anschrift">
            {mietpartei.anschrift ? `${mietpartei.anschrift}, ${mietpartei.anschriftPlz} ${mietpartei.anschriftOrt}` : "– (Objektadresse)"}
          </Feld>
        </div>
      </div>

      <div className="section">
        <h2>Personen</h2>
        {istFirma ? (
          <div className="form-grid">
            <Feld label="Firma">{mietpartei.firma}</Feld>
            {(mietpartei.vorname || mietpartei.name) && (
              <Feld label="Ansprechpartner:in">{[mietpartei.vorname, mietpartei.name].filter(Boolean).join(" ")}</Feld>
            )}
          </div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {alleAnzeigePersonen.map((p, i) => {
              const teile = [anredeKurz(p.anrede), p.vorname, p.name].filter(Boolean).join(" ");
              return <li key={i}>{teile || "–"}</li>;
            })}
          </ul>
        )}
      </div>

      <div className="section">
        <h2>Stromkosten</h2>
        <div className="form-grid">
          <Feld label="Arbeitspreis (brutto)">
            {arbeitspreisBrutto != null ? `${arbeitspreisBrutto.toFixed(4)} €/kWh` : "–"}
          </Feld>
          <Feld label="Grundpreis (brutto)">
            {grundpreisBrutto != null ? `${grundpreisBrutto.toFixed(2)} €/Monat` : "kein Grundpreis"}
          </Feld>
          <Feld label="Aktueller Abschlag (brutto)">
            {aktuellerAbschlagBrutto != null ? `${aktuellerAbschlagBrutto.toFixed(2)} €/Monat` : "–"}
          </Feld>
        </div>
      </div>

      <div className="section">
        <h2>Bankverbindung</h2>
        <div className="form-grid">
          <Feld label="Kontoinhaber:in">{mietpartei.kontoinhaber || "–"}</Feld>
          <Feld label="IBAN">{mietpartei.iban || "–"}</Feld>
          <Feld label="Bank">{mietpartei.bankName || "–"}</Feld>
        </div>
      </div>

      <div className="section">
        <h2>Dashboard-Zugang</h2>
        {nutzer ? (
          <p style={{ margin: 0 }}>
            Zugang vorhanden · Benutzername: <strong>{nutzer.username}</strong>
            {nutzer.mustChangePassword ? " · Passwortänderung ausstehend" : ""}
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--color-muted)" }}>
            Noch kein Zugang – über das +-Menü „Neuer Dashboard-Zugang“ anlegen.
          </p>
        )}
      </div>

      <div className="section">
        <h2>Jahresverbräuche (freigegebene Rechnungen)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rechnung</th>
              <th>Zeitraum</th>
              <th>Verbrauch (<span className="unit">kWh</span>)</th>
              <th>Verrechnung</th>
            </tr>
          </thead>
          <tbody>
            {freigegebeneRechnungen.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/rechnungen/${r.id}`}>{r.rechnungsnummer ?? "—"}</Link>
                </td>
                <td>
                  {r.zeitraumVon.toLocaleDateString("de-DE")} – {r.zeitraumBis.toLocaleDateString("de-DE")}
                </td>
                <td>{r.gesamtVerbrauchKwh.toFixed(2)}</td>
                <td>
                  {r.verrechnungBetrag >= 0 ? "Nachzahlung" : "Guthaben"}: {Math.abs(r.verrechnungBetrag).toFixed(2)} €
                </td>
              </tr>
            ))}
            {freigegebeneRechnungen.length === 0 ? (
              <tr>
                <td colSpan={4}>Noch keine freigegebenen Rechnungen.</td>
              </tr>
            ) : (
              <tr>
                <td>
                  <strong>Summe</strong>
                </td>
                <td></td>
                <td>
                  <strong>{summeVerbrauchKwh.toFixed(2)}</strong>
                </td>
                <td>
                  <strong>
                    {summeVerrechnung >= 0 ? "Nachzahlung" : "Guthaben"}: {Math.abs(summeVerrechnung).toFixed(2)} €
                  </strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Abschläge (Historie)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Netto</th>
              <th>Steuersatz</th>
              <th>Brutto</th>
              <th>Gültig ab</th>
              <th>Gültig bis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {abschlaege.map((a) => {
              const brutto = a.bruttoBetrag ?? berechneBrutto(a.nettoBetrag, a.steuersatz.prozentsatz).bruttoBetrag;
              return (
                <tr key={a.id}>
                  <td>{a.nettoBetrag.toFixed(2)} €</td>
                  <td>{a.steuersatz.prozentsatz}%</td>
                  <td>{brutto.toFixed(2)} €</td>
                  <td>{a.gueltigAb.toLocaleDateString("de-DE")}</td>
                  <td>{a.gueltigBis ? a.gueltigBis.toLocaleDateString("de-DE") : "–"}</td>
                  <td>
                    <form action={deleteAbschlagAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="mietparteiId" value={mietpartei.id} />
                      <button className="btn-small btn-danger" type="submit">
                        Löschen
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {abschlaege.length === 0 && (
              <tr>
                <td colSpan={6}>Noch kein Abschlag hinterlegt.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>{mietpartei.status === "AKTIV" ? "Vertragsunterlagen" : "Onboarding"}</h2>
        <OnboardingPanel
          mietparteiId={mietpartei.id}
          status={mietpartei.status}
          anschreibenVariante={mietpartei.anschreibenVariante}
          braucheErgaenzung={mietpartei.braucheErgaenzung}
          istAllgemeinstrom={mietpartei.einheit.typ === "ALLGEMEINSTROM"}
          vertragVersionen={vertragVersionen.map((v) => ({
            id: v.id,
            art: v.art,
            version: v.version,
            titel: v.titel,
            gueltigAb: v.gueltigAb.toISOString(),
            gueltigBis: v.gueltigBis ? v.gueltigBis.toISOString() : null,
          }))}
          dokumente={dokumente.map((d) => ({
            id: d.id,
            typ: d.typ,
            pfad: d.pfad,
            groesseBytes: d.groesseBytes,
            hochgeladenAm: d.hochgeladenAm.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
