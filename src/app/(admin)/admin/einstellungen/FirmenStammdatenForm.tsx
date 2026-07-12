"use client";

import { useActionState } from "react";
import { updateFirmenStammdatenAction, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = {};

export function FirmenStammdatenForm(props: {
  name: string;
  anschrift: string;
  plz: string;
  ort: string;
  steuernummer: string | null;
  ustIdNr: string | null;
  bankname: string | null;
  bankverbindung: string | null;
  kontaktTelefon: string | null;
  kontaktEmail: string | null;
  kontaktEmailVerifiziert: boolean;
  kontaktEmailPending: string | null;
  shellyFehlerEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateFirmenStammdatenAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      {state.success && <div className="form-notice" role="status">{state.success}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required defaultValue={props.name} />
        </div>
        <div className="field">
          <label htmlFor="anschrift">Straße &amp; Hausnummer</label>
          <input id="anschrift" name="anschrift" type="text" required defaultValue={props.anschrift} />
        </div>
        <div className="field">
          <label htmlFor="plz">PLZ</label>
          <input id="plz" name="plz" type="text" defaultValue={props.plz} inputMode="numeric" />
        </div>
        <div className="field">
          <label htmlFor="ort">Ort</label>
          <input id="ort" name="ort" type="text" defaultValue={props.ort} />
        </div>
        <div className="field">
          <label htmlFor="steuernummer">Steuernummer</label>
          <input id="steuernummer" name="steuernummer" type="text" defaultValue={props.steuernummer ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="ustIdNr">USt-IdNr.</label>
          <input id="ustIdNr" name="ustIdNr" type="text" defaultValue={props.ustIdNr ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="bankname">Bankname</label>
          <input id="bankname" name="bankname" type="text" defaultValue={props.bankname ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="bankverbindung">Bankverbindung (IBAN)</label>
          <input id="bankverbindung" name="bankverbindung" type="text" defaultValue={props.bankverbindung ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="kontaktTelefon">Kontakt-Telefon</label>
          <input id="kontaktTelefon" name="kontaktTelefon" type="tel" defaultValue={props.kontaktTelefon ?? ""} placeholder="0123 456789" />
        </div>
        <div className="field">
          <label htmlFor="kontaktEmail">Kontakt-E-Mail</label>
          <input
            id="kontaktEmail"
            name="kontaktEmail"
            type="email"
            defaultValue={props.kontaktEmail ?? ""}
            placeholder="kontakt@nuola-solar.de"
            aria-describedby="kontaktEmail-status"
          />
          <p id="kontaktEmail-status" className="price-breakdown">
            {props.kontaktEmail
              ? props.kontaktEmailVerifiziert
                ? "Bestätigt."
                : "Noch nicht bestätigt."
              : "Optional – erscheint in der Fußzeile der Briefe."}
            {props.kontaktEmailPending ? ` Änderung auf „${props.kontaktEmailPending}" wartet auf Bestätigung.` : ""}
            {" "}Bei Änderung wird ein Bestätigungslink an die neue Adresse gesendet.
          </p>
        </div>
        <div className="field">
          <label htmlFor="shellyFehlerEmail">E-Mail für Shelly-Fehlermeldungen</label>
          <input
            id="shellyFehlerEmail"
            name="shellyFehlerEmail"
            type="email"
            defaultValue={props.shellyFehlerEmail ?? ""}
            placeholder="technik@nuola-solar.de"
          />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Speichern"}
      </button>
    </form>
  );
}
