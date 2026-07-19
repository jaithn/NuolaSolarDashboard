"use client";

import { useActionState } from "react";
import {
  updateProfilAction,
  uploadSepaMandatAction,
  type ProfilFormState,
  type SepaUploadState,
} from "./actions";

const initialState: ProfilFormState = {};
const initialUpload: SepaUploadState = {};

interface ProfilFormProps {
  email: string;
  emailVerifiziert: boolean;
  emailPending: string | null;
  telefon: string | null;
  kontoinhaber: string;
  iban: string | null;
  bankName: string | null;
}

export function ProfilForm({
  email,
  emailVerifiziert,
  emailPending,
  telefon,
  kontoinhaber,
  iban,
  bankName,
}: ProfilFormProps) {
  const [state, formAction, pending] = useActionState(updateProfilAction, initialState);
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadSepaMandatAction, initialUpload);

  return (
    <>
      <form action={formAction}>
        {state.error && <div className="form-error" role="alert">{state.error}</div>}
        {state.success && <div className="form-notice" role="status">{state.success}</div>}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="email">E-Mail-Adresse</label>
            <input id="email" name="email" type="email" defaultValue={email} aria-describedby="email-status" />
            <p id="email-status" className="price-breakdown">
              {emailVerifiziert ? "Bestätigt." : "Noch nicht bestätigt."}
              {emailPending ? ` Änderung auf „${emailPending}" wartet auf Bestätigung per E-Mail.` : ""}
              {" "}Bei Änderung senden wir einen Bestätigungslink an die neue Adresse.
            </p>
          </div>
          <div className="field">
            <label htmlFor="telefon">Telefonnummer</label>
            <input id="telefon" name="telefon" type="tel" defaultValue={telefon ?? ""} />
          </div>
        </div>

        <h3 style={{ marginTop: "1.5rem" }}>Bankverbindung (SEPA-Lastschrift)</h3>
        <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginTop: 0 }}>
          Ändern Sie hier Ihre Kontoverbindung. Bei einer neuen IBAN ist ein neues SEPA-Mandat nötig –
          Sie können es anschließend herunterladen, unterschreiben und wieder hochladen.
        </p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="kontoinhaber">Kontoinhaber:in (Vor- und Nachname)</label>
            <input id="kontoinhaber" name="kontoinhaber" type="text" defaultValue={kontoinhaber} />
          </div>
          <div className="field">
            <label htmlFor="iban">IBAN</label>
            <input id="iban" name="iban" type="text" autoComplete="off" defaultValue={iban ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="bank-anzeige">Bank</label>
            <input id="bank-anzeige" type="text" value={bankName ?? ""} readOnly aria-readonly="true" />
            <p className="price-breakdown">Wird automatisch aus der IBAN ermittelt.</p>
          </div>
        </div>

        <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
          {pending ? "Wird gespeichert…" : "Speichern"}
        </button>
      </form>

      {/* Neues SEPA-Mandat: nach IBAN-Änderung prominent; sonst als Möglichkeit vorhanden. */}
      <div
        className="section"
        style={{
          marginTop: "1.5rem",
          ...(state.sepaNeu ? { borderColor: "var(--color-primary)", background: "var(--color-primary-tint)" } : {}),
        }}
      >
        <h3 style={{ marginTop: 0 }}>Neues SEPA-Mandat</h3>
        <p style={{ marginTop: 0 }}>
          {state.sepaNeu
            ? "Ihre Bankverbindung wurde geändert. Bitte laden Sie das vorausgefüllte Mandat herunter, unterschreiben es und laden es hier wieder hoch."
            : "Falls sich Ihre Bankverbindung geändert hat: Mandat herunterladen, unterschreiben und wieder hochladen."}
        </p>
        <a
          className="btn-small"
          href="/api/mein/sepa-mandat"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", marginBottom: "1rem" }}
        >
          SEPA-Mandat (vorausgefüllt) herunterladen
        </a>

        <form action={uploadAction}>
          {uploadState.error && <div className="form-error" role="alert">{uploadState.error}</div>}
          {uploadState.success && <div className="form-notice" role="status">{uploadState.success}</div>}
          <div className="field">
            <label htmlFor="sepa-datei">Unterschriebenes Mandat hochladen (PDF, JPG oder PNG)</label>
            <input id="sepa-datei" name="datei" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
          </div>
          <button className="btn-small" type="submit" disabled={uploadPending}>
            {uploadPending ? "Wird hochgeladen…" : "Hochladen"}
          </button>
        </form>
      </div>
    </>
  );
}
