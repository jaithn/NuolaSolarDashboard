"use client";

import { useActionState } from "react";
import { deleteDokumentAction, type OnboardingState } from "../actions";

const initialState: OnboardingState = {};

type Status = "INTERESSENT" | "AKTIV" | "INAKTIV";
// Aktuell angebotene Ruecklaeufer-Typen + Legacy-Werte (nur noch zur Anzeige
// bereits abgelegter Dokumente).
type DokTyp =
  | "VERTRAG_EIGENSTAENDIG"
  | "VERTRAG_ERGAENZUNG"
  | "SEPA"
  | "SONSTIGES"
  | "VERTRAG"
  | "ANSCHREIBEN";
type VertragArt = "EIGENSTAENDIG" | "ERGAENZUNG";

interface VertragVersion {
  id: string;
  art: VertragArt;
  version: string;
  titel: string;
  gueltigAb: string; // ISO
  gueltigBis: string | null; // ISO
}

const VERTRAGSART_LABEL: Record<VertragArt, string> = {
  EIGENSTAENDIG: "Eigenständiger Vertrag",
  ERGAENZUNG: "Ergänzung zum Mietvertrag",
};

interface Dokument {
  id: string;
  typ: DokTyp;
  // Automatisch vergebener, einheitlicher Dateiname (Kundennummer_Name_TYP_Datum) -
  // wird angezeigt; der Original-Upload-Name ist bewusst nicht die Anzeige.
  pfad: string;
  groesseBytes: number;
  hochgeladenAm: string; // ISO
}

const DOK_LABEL: Record<DokTyp, string> = {
  VERTRAG_EIGENSTAENDIG: "Stromliefervertrag",
  VERTRAG_ERGAENZUNG: "Ergänzung zum Mietvertrag",
  SEPA: "SEPA-Mandat",
  SONSTIGES: "Sonstiges",
  // Legacy (nicht mehr im Upload wählbar):
  VERTRAG: "Vertrag (unterschrieben)",
  ANSCHREIBEN: "Anschreiben",
};

function fmtGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Vertragsunterlagen/Onboarding – bewusst als ANZEIGE-Abschnitt (read-only):
 * Onboarding-Optionen, Vertragsversionen, PDF-Downloads und die Liste der
 * gescannten Rückläufer. Alle aktiven Bearbeitungen (Onboarding-Optionen ändern,
 * Status wechseln, Dokument hochladen) laufen über das +-Menü oben. Einzige
 * Ausnahme hier: das Löschen einer einzelnen Scan-Datei (Zeilen-Aktion).
 */
export function OnboardingPanel({
  mietparteiId,
  anschreibenVariante,
  braucheErgaenzung,
  istAllgemeinstrom = false,
  vertragVersionen,
  dokumente,
}: {
  mietparteiId: string;
  status: Status;
  anschreibenVariante: string;
  braucheErgaenzung: boolean;
  // Allgemeinstrom: kein Anschreiben, keine Ergaenzung/Onboarding-Optionen.
  istAllgemeinstrom?: boolean;
  vertragVersionen: VertragVersion[];
  dokumente: Dokument[];
}) {
  const [deleteState, deleteAction, deletePending] = useActionState(deleteDokumentAction, initialState);

  // Aktuell gültige Version je Vertragsart.
  const aktiveVersion = (art: VertragArt) =>
    vertragVersionen.find((v) => v.art === art && v.gueltigBis === null) ?? null;

  // PDF-Links folgen den Onboarding-Optionen: nur die gewaehlte Anschreiben-
  // Variante und die Ergaenzung nur, wenn sie erforderlich ist.
  const anschreibenDok = anschreibenVariante === "persoenlich" ? "anschreiben-persoenlich" : "anschreiben";
  const anschreibenLabel =
    anschreibenVariante === "persoenlich" ? "Anschreiben (persönlich)" : "Anschreiben (formal)";
  const pdfLinks: { dok: string; label: string }[] = [
    ...(istAllgemeinstrom ? [] : [{ dok: anschreibenDok, label: anschreibenLabel }]),
    { dok: "vertrag-eigenstaendig", label: "Stromliefervertrag" },
    ...(braucheErgaenzung ? [{ dok: "vertrag-ergaenzung", label: "Ergänzung zum Mietvertrag" }] : []),
    { dok: "sepa", label: "SEPA-Lastschriftmandat" },
  ];

  return (
    <div>
      {/* 0) Onboarding-Optionen – read-only. Änderung über das +-Menü. */}
      {!istAllgemeinstrom && (
        <>
          <h3 style={{ marginTop: 0 }}>Onboarding-Optionen</h3>
          <p style={{ marginTop: 0 }}>
            Anschreiben: <strong>{anschreibenVariante === "persoenlich" ? "Persönlich" : "Formal"}</strong>
            {" · "}
            Ergänzung zum Mietvertrag:{" "}
            <strong>{braucheErgaenzung ? "erforderlich" : "nicht erforderlich"}</strong>
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginTop: 0 }}>
            Änderbar über das +-Menü oben („Onboarding-Optionen“).
          </p>
        </>
      )}

      <h3 style={{ marginTop: istAllgemeinstrom ? 0 : "1.5rem" }}>Verträge</h3>
      <ul style={{ marginTop: 0 }}>
        {(braucheErgaenzung
          ? (["EIGENSTAENDIG", "ERGAENZUNG"] as VertragArt[])
          : (["EIGENSTAENDIG"] as VertragArt[])
        ).map((art) => {
          const v = aktiveVersion(art);
          return (
            <li key={art}>
              {VERTRAGSART_LABEL[art]}:{" "}
              {v ? (
                <>
                  aktuell gültige Version <strong>{v.version}</strong>
                </>
              ) : (
                <span style={{ color: "var(--color-muted)" }}>keine gültige Version (bitte Texte synchronisieren)</span>
              )}
            </li>
          );
        })}
      </ul>

      {/* 1) PDF-Briefe erzeugen (Download) */}
      <h3 style={{ marginTop: "1.5rem" }}>Onboarding-Unterlagen (PDF)</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginTop: 0 }}>
        Werden bei jedem Abruf frisch aus den aktuellen Stammdaten erzeugt.
      </p>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        {pdfLinks.map((l) => (
          <a
            key={l.dok}
            className="btn-small"
            href={`/api/mietparteien/${mietparteiId}/onboarding-pdf/${l.dok}`}
            target="_blank"
            rel="noreferrer"
          >
            {l.label} öffnen
          </a>
        ))}
      </div>
      {/* Alle relevanten Briefe (gemäß Optionen) in EINEM PDF. */}
      <div style={{ marginTop: "0.75rem" }}>
        <a
          className="btn"
          href={`/api/mietparteien/${mietparteiId}/onboarding-pdf/gesamt`}
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", maxWidth: "22rem" }}
        >
          Alle Unterlagen als ein PDF öffnen
        </a>
      </div>

      {/* 2) Gescannte Rückläufer – Anzeige + Download; Upload über das +-Menü. */}
      <h3 style={{ marginTop: "1.5rem" }}>Gescannte Rückläufer</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginTop: 0 }}>
        Hochladen über das +-Menü oben („Neuer Dokumenten-Upload“). Dauerhafte, nicht öffentliche Ablage.
      </p>

      {deleteState.error && <div className="form-error">{deleteState.error}</div>}

      {dokumente.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Art</th>
              <th>Datei</th>
              <th>Größe</th>
              <th>Hochgeladen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dokumente.map((d) => (
              <tr key={d.id}>
                <td>{DOK_LABEL[d.typ]}</td>
                <td>
                  <a href={`/api/mietparteien/${mietparteiId}/dokument/${d.id}`} target="_blank" rel="noreferrer">
                    {d.pfad}
                  </a>
                </td>
                <td>{fmtGroesse(d.groesseBytes)}</td>
                <td>{new Date(d.hochgeladenAm).toLocaleDateString("de-DE")}</td>
                <td>
                  <form action={deleteAction}>
                    <input type="hidden" name="mietparteiId" value={mietparteiId} />
                    <input type="hidden" name="dokumentId" value={d.id} />
                    <button className="btn-small btn-danger" type="submit" disabled={deletePending}>
                      Löschen
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Noch keine Dokumente hinterlegt.</p>
      )}
    </div>
  );
}
