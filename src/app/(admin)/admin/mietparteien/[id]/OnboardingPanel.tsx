"use client";

import { useActionState } from "react";
import {
  setMietparteiStatusAction,
  setOnboardingOptionenAction,
  uploadDokumentAction,
  deleteDokumentAction,
  type OnboardingState,
} from "../actions";

const initialState: OnboardingState = {};

type Status = "INTERESSENT" | "AKTIV" | "INAKTIV";
type DokTyp = "VERTRAG" | "SEPA" | "ANSCHREIBEN" | "SONSTIGES";
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

const STATUS_LABEL: Record<Status, string> = {
  INTERESSENT: "Interessent:in",
  AKTIV: "Aktiv",
  INAKTIV: "Inaktiv",
};

const DOK_LABEL: Record<DokTyp, string> = {
  VERTRAG: "Vertrag (unterschrieben)",
  SEPA: "SEPA-Mandat",
  ANSCHREIBEN: "Anschreiben",
  SONSTIGES: "Sonstiges",
};


function fmtGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OnboardingPanel({
  mietparteiId,
  status,
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
  const [statusState, statusAction, statusPending] = useActionState(setMietparteiStatusAction, initialState);
  const [optionenState, optionenAction, optionenPending] = useActionState(setOnboardingOptionenAction, initialState);
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadDokumentAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteDokumentAction, initialState);

  const istAktiv = status === "AKTIV";
  // „Interessent:in" wird als Zielstatus nicht mehr angeboten (kein Zurück,
  // sobald aktiviert) - nur Aktiv/Inaktiv.
  const andereStatus = (["AKTIV", "INAKTIV"] as Status[]).filter((s) => s !== status);

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
      {/* 0) Onboarding-Optionen: Anschreiben-Variante + Ergaenzungs-Bedarf,
         waehrend der Interessenten-Phase aenderbar. Sobald die Partei aktiv ist
         (oder bei Allgemeinstrom) entfaellt dieser Block – die zuletzt gewaehlten
         Optionen bleiben gespeichert und steuern weiterhin die PDF-Erzeugung. */}
      {!istAllgemeinstrom && !istAktiv && (
        <>
          <h3 style={{ marginTop: 0 }}>Onboarding-Optionen</h3>
          {optionenState.error && <div className="form-error">{optionenState.error}</div>}
          {optionenState.success && (
            <div className="form-notice" role="status">
              {optionenState.success}
            </div>
          )}
          <form action={optionenAction} style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <input type="hidden" name="mietparteiId" value={mietparteiId} />
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="opt-anschreiben">Anschreiben</label>
              <select
                id="opt-anschreiben"
                name="anschreibenVariante"
                className="select-inline"
                defaultValue={anschreibenVariante === "persoenlich" ? "persoenlich" : "formal"}
              >
                <option value="formal">Formal</option>
                <option value="persoenlich">Persönlich</option>
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>
                <input type="checkbox" name="braucheErgaenzung" defaultChecked={braucheErgaenzung} /> Ergänzung zum
                Mietvertrag erforderlich
              </label>
            </div>
            <button className="btn-small" type="submit" disabled={optionenPending}>
              {optionenPending ? "…" : "Optionen speichern"}
            </button>
          </form>
        </>
      )}

      <h3 style={{ marginTop: istAllgemeinstrom || istAktiv ? 0 : "1.5rem" }}>Verträge</h3>
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

      {/* 1) PDF-Briefe erzeugen */}
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
      {/* Alle relevanten Briefe (gemäß Optionen) in EINEM PDF - praktisch zum
         Ausdrucken/Versenden des kompletten Onboarding-Pakets. */}
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

      {/* 2) Status wechseln - bei aktiven Kunden entfällt der Block (Status wird
         in den Stammdaten oben angezeigt/geändert). */}
      {!istAktiv && (
        <>
          <h3 style={{ marginTop: "1.5rem" }}>Status</h3>
          <p style={{ marginTop: 0 }}>
            Aktueller Status: <strong>{STATUS_LABEL[status]}</strong>
          </p>
          {statusState.error && <div className="form-error">{statusState.error}</div>}
          {statusState.success && (
            <div className="form-notice" role="status">
              {statusState.success}
            </div>
          )}
          <form action={statusAction} style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <input type="hidden" name="mietparteiId" value={mietparteiId} />
            {andereStatus.map((s) => (
              <button key={s} className="btn-small" type="submit" name="status" value={s} disabled={statusPending}>
                {statusPending ? "…" : `In „${STATUS_LABEL[s]}“ überführen`}
              </button>
            ))}
          </form>
        </>
      )}

      {/* 3) Gescannte Rückläufer */}
      <h3 style={{ marginTop: "1.5rem" }}>Gescannte Rückläufer</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginTop: 0 }}>
        Unterschriebenen Vertrag und SEPA-Mandat hier hochladen. Dauerhafte, nicht öffentliche Ablage
        (PDF/JPG/PNG, max. 20 MB).
      </p>

      {dokumente.length > 0 ? (
        <table className="data-table" style={{ marginBottom: "1rem" }}>
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
                  <a
                    href={`/api/mietparteien/${mietparteiId}/dokument/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
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

      {deleteState.error && <div className="form-error">{deleteState.error}</div>}
      {uploadState.error && <div className="form-error">{uploadState.error}</div>}
      {uploadState.success && (
        <div className="form-notice" role="status">
          {uploadState.success}
        </div>
      )}

      <form action={uploadAction} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <input type="hidden" name="mietparteiId" value={mietparteiId} />
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="dok-typ">Art</label>
          <select id="dok-typ" name="typ" className="select-inline" defaultValue="VERTRAG">
            <option value="VERTRAG">Vertrag (unterschrieben)</option>
            <option value="SEPA">SEPA-Mandat</option>
            <option value="ANSCHREIBEN">Anschreiben</option>
            <option value="SONSTIGES">Sonstiges</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="dok-datei">Datei</label>
          <input id="dok-datei" name="datei" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
        </div>
        <button className="btn" type="submit" disabled={uploadPending}>
          {uploadPending ? "Wird hochgeladen…" : "Hochladen"}
        </button>
      </form>
    </div>
  );
}
