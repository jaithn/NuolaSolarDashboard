"use client";

import { useActionState } from "react";
import {
  setMietparteiStatusAction,
  uploadDokumentAction,
  deleteDokumentAction,
  setSignierteVersionAction,
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
  dateiname: string;
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

const PDF_LINKS: { dok: string; label: string }[] = [
  { dok: "anschreiben", label: "Anschreiben" },
  { dok: "vertrag", label: "Vertrag" },
  { dok: "sepa", label: "SEPA-Lastschriftmandat" },
];

function fmtGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function OnboardingPanel({
  mietparteiId,
  status,
  vertragsart,
  signierteVersionId,
  vertragVersionen,
  dokumente,
}: {
  mietparteiId: string;
  status: Status;
  vertragsart: VertragArt | null;
  signierteVersionId: string | null;
  vertragVersionen: VertragVersion[];
  dokumente: Dokument[];
}) {
  const [statusState, statusAction, statusPending] = useActionState(setMietparteiStatusAction, initialState);
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadDokumentAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteDokumentAction, initialState);
  const [versionState, versionAction, versionPending] = useActionState(setSignierteVersionAction, initialState);

  const andereStatus = (["INTERESSENT", "AKTIV", "INAKTIV"] as Status[]).filter((s) => s !== status);

  // Versionen der gewählten Vertragsart (für die Auswahl der unterschriebenen Version).
  const versionenDerArt = vertragsart ? vertragVersionen.filter((v) => v.art === vertragsart) : [];
  const aktiveVersion = versionenDerArt.find((v) => v.gueltigBis === null) ?? null;
  const signierteVersion = vertragVersionen.find((v) => v.id === signierteVersionId) ?? null;

  return (
    <div>
      {/* 0) Vertrag: Art + Version */}
      <h3 style={{ marginTop: 0 }}>Vertrag</h3>
      {vertragsart ? (
        <>
          <p style={{ marginTop: 0 }}>
            Vertragsart: <strong>{VERTRAGSART_LABEL[vertragsart]}</strong>
            {aktiveVersion ? (
              <>
                {" "}
                · aktuell gültige Version: <strong>{aktiveVersion.version}</strong>
              </>
            ) : (
              " · keine gültige Version vorhanden (bitte Texte synchronisieren)"
            )}
          </p>
          <p style={{ marginTop: 0 }}>
            Unterschriebene Version:{" "}
            <strong>{signierteVersion ? signierteVersion.version : "— noch nicht dokumentiert —"}</strong>
            {signierteVersion ? "" : aktiveVersion ? " (PDF nutzt die aktuell gültige Version)" : ""}
          </p>
          {versionState.error && <div className="form-error">{versionState.error}</div>}
          {versionState.success && (
            <div className="form-notice" role="status">
              {versionState.success}
            </div>
          )}
          <form action={versionAction} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <input type="hidden" name="mietparteiId" value={mietparteiId} />
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="vertragVersionId">Unterschriebene Version dokumentieren</label>
              <select
                id="vertragVersionId"
                name="vertragVersionId"
                className="select-inline"
                defaultValue={signierteVersionId ?? ""}
              >
                <option value="">— keine —</option>
                {versionenDerArt.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.version}
                    {v.gueltigBis === null ? " (aktuell)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-small" type="submit" disabled={versionPending}>
              {versionPending ? "…" : "Speichern"}
            </button>
          </form>
        </>
      ) : (
        <p style={{ marginTop: 0, color: "var(--color-muted)" }}>
          Noch keine Vertragsart gewählt. Bitte oben in den Stammdaten festlegen (eigenständiger Vertrag oder
          Ergänzung zum Mietvertrag).
        </p>
      )}

      {/* 1) PDF-Briefe erzeugen */}
      <h3 style={{ marginTop: "1.5rem" }}>Onboarding-Unterlagen (PDF)</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginTop: 0 }}>
        Werden bei jedem Abruf frisch aus den aktuellen Stammdaten erzeugt.
      </p>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        {PDF_LINKS.map((l) => (
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

      {/* 2) Status wechseln */}
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
            {statusPending ? "…" : `In „${STATUS_LABEL[s]}" überführen`}
          </button>
        ))}
      </form>

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
                    {d.dateiname}
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
