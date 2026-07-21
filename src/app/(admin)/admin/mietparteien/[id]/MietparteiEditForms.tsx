"use client";

import { useActionState, useEffect, useState, type CSSProperties } from "react";
import { PriceInput, type SteuersatzOption } from "@/components/PriceInput";
import {
  updateStammdatenAction,
  updatePersonenAction,
  updateStromkostenAction,
  updateBankverbindungAction,
  bankAusIbanAction,
  type MietparteiFormState,
} from "../actions";

const initialState: MietparteiFormState = {};

export interface EinheitOption {
  id: string;
  label: string;
}

/** Ruft onSaved auf, sobald ein neues savedNonce eintrifft (erfolgreiches
 *  Speichern) - so schließt sich der Bearbeitungsmodus im +-Menü automatisch. */
function useAutoClose(savedNonce: string | undefined, onSaved?: () => void) {
  useEffect(() => {
    if (savedNonce) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedNonce]);
}

// Einheitliche Karten-Optik für alle Personen (identisch zu MietparteiForm).
const personBoxStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  padding: "0.5rem 1rem 0.75rem",
  marginBottom: "0.75rem",
  maxWidth: "26rem",
};
const personLegendStyle: CSSProperties = { fontSize: "0.85rem", fontWeight: 600, padding: "0 0.4rem" };

function Hinweis({ state }: { state: MietparteiFormState }) {
  return (
    <>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.success && (
        <div className="form-notice" role="status">
          {state.success}
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------------- */
/* Stammdaten (Einheit, Status, Liefer-Zeitraum, Kontakt)                 */
/* --------------------------------------------------------------------- */
export function StammdatenForm({
  mietparteiId,
  einheiten,
  einheitId,
  status,
  einzugsdatum,
  auszugsdatum,
  email,
  telefon,
  anschrift,
  anschriftPlz,
  anschriftOrt,
  onSaved,
}: {
  mietparteiId: string;
  einheiten: EinheitOption[];
  einheitId: string;
  status: string;
  einzugsdatum: string;
  auszugsdatum: string;
  email: string;
  telefon: string;
  anschrift: string;
  anschriftPlz: string;
  anschriftOrt: string;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateStammdatenAction, initialState);
  useAutoClose(state.savedNonce, onSaved);
  return (
    <form action={formAction} key={state.savedNonce ?? "form"}>
      <Hinweis state={state} />
      <input type="hidden" name="id" value={mietparteiId} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="sd-einheit">Einheit</label>
          <select id="sd-einheit" name="einheitId" className="select-inline" defaultValue={einheitId} required>
            {einheiten.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sd-status">Status</label>
          <select id="sd-status" name="status" className="select-inline" defaultValue={status}>
            <option value="INTERESSENT">Interessent:in</option>
            <option value="AKTIV">Aktiv</option>
            <option value="INAKTIV">Inaktiv</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sd-einzug">Beginn der Stromlieferung</label>
          <input id="sd-einzug" name="einzugsdatum" type="date" defaultValue={einzugsdatum} required />
        </div>
        <div className="field">
          <label htmlFor="sd-auszug">Auszugsdatum (optional)</label>
          <input id="sd-auszug" name="auszugsdatum" type="date" defaultValue={auszugsdatum} />
        </div>
        <div className="field">
          <label htmlFor="sd-email">E-Mail (optional)</label>
          <input id="sd-email" name="email" type="email" defaultValue={email} />
        </div>
        <div className="field">
          <label htmlFor="sd-telefon">Telefon</label>
          <input id="sd-telefon" name="telefon" type="text" defaultValue={telefon} />
        </div>
        <div className="field">
          <label htmlFor="sd-anschrift">Anschrift (Straße &amp; Hausnr.)</label>
          <input id="sd-anschrift" name="anschrift" type="text" defaultValue={anschrift} />
        </div>
        <div className="field">
          <label htmlFor="sd-plz">PLZ</label>
          <input id="sd-plz" name="anschriftPlz" type="text" inputMode="numeric" defaultValue={anschriftPlz} />
        </div>
        <div className="field">
          <label htmlFor="sd-ort">Ort</label>
          <input id="sd-ort" name="anschriftOrt" type="text" defaultValue={anschriftOrt} />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Stammdaten speichern"}
      </button>
    </form>
  );
}

/* --------------------------------------------------------------------- */
/* Personen (Hauptperson + beliebig viele weitere)                        */
/* --------------------------------------------------------------------- */
interface WeiterePerson {
  anrede: string;
  vorname: string;
  name: string;
}
export function PersonenForm({
  mietparteiId,
  anrede: anredeDefault,
  firma,
  vorname,
  name,
  weiterePersonen: weitereDefault,
  onSaved,
}: {
  mietparteiId: string;
  anrede: string;
  firma: string;
  vorname: string;
  name: string;
  weiterePersonen: WeiterePerson[];
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updatePersonenAction, initialState);
  useAutoClose(state.savedNonce, onSaved);
  const [anrede, setAnrede] = useState(anredeDefault);
  const istFirma = anrede === "FIRMA";
  const [weitere, setWeitere] = useState<WeiterePerson[]>(weitereDefault);

  const setzePerson = (i: number, feld: keyof WeiterePerson, wert: string) =>
    setWeitere((l) => l.map((p, idx) => (idx === i ? { ...p, [feld]: wert } : p)));
  const entferne = (i: number) => setWeitere((l) => l.filter((_, idx) => idx !== i));
  const hinzu = () => setWeitere((l) => [...l, { anrede: "", vorname: "", name: "" }]);

  return (
    <form action={formAction} key={state.savedNonce ?? "form"}>
      <Hinweis state={state} />
      <input type="hidden" name="id" value={mietparteiId} />
      <fieldset style={personBoxStyle}>
        <legend style={personLegendStyle}>{istFirma ? "Firma" : "1. Person"}</legend>
        <div className="field">
          <label htmlFor="pf-anrede">Anrede</label>
          <select
            id="pf-anrede"
            name="anrede"
            className="select-inline"
            style={{ width: "100%" }}
            value={anrede}
            onChange={(e) => setAnrede(e.target.value)}
          >
            <option value="">— keine —</option>
            <option value="HERR">Herr</option>
            <option value="FRAU">Frau</option>
            <option value="FAMILIE">Familie</option>
            <option value="FIRMA">Firma</option>
          </select>
        </div>
        {istFirma && (
          <div className="field">
            <label htmlFor="pf-firma">Firma</label>
            <input id="pf-firma" name="firma" type="text" defaultValue={firma} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="pf-vorname">{istFirma ? "Vorname (Ansprechpartner:in, optional)" : "Vorname"}</label>
          <input id="pf-vorname" name="vorname" type="text" defaultValue={vorname} />
        </div>
        <div className="field">
          <label htmlFor="pf-name">{istFirma ? "Name (Ansprechpartner:in, optional)" : "Name"}</label>
          <input id="pf-name" name="name" type="text" defaultValue={name} required={!istFirma} />
        </div>
      </fieldset>

      {!istFirma && (
        <div>
          <input type="hidden" name="weiterePersonen" value={JSON.stringify(weitere)} />
          {weitere.map((p, i) => (
            <fieldset key={i} style={personBoxStyle}>
              <legend style={personLegendStyle}>{i + 2}. Person</legend>
              <div className="field">
                <label htmlFor={`pf-wp-anrede-${i}`}>Anrede</label>
                <select
                  id={`pf-wp-anrede-${i}`}
                  className="select-inline"
                  style={{ width: "100%" }}
                  value={p.anrede}
                  onChange={(e) => setzePerson(i, "anrede", e.target.value)}
                >
                  <option value="">— keine —</option>
                  <option value="HERR">Herr</option>
                  <option value="FRAU">Frau</option>
                  <option value="FAMILIE">Familie</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`pf-wp-vorname-${i}`}>Vorname</label>
                <input
                  id={`pf-wp-vorname-${i}`}
                  type="text"
                  value={p.vorname}
                  onChange={(e) => setzePerson(i, "vorname", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor={`pf-wp-name-${i}`}>Name</label>
                <input
                  id={`pf-wp-name-${i}`}
                  type="text"
                  value={p.name}
                  onChange={(e) => setzePerson(i, "name", e.target.value)}
                />
              </div>
              <button type="button" className="btn-small btn-danger" onClick={() => entferne(i)}>
                {i + 2}. Person entfernen
              </button>
            </fieldset>
          ))}
          <button type="button" className="btn-small" onClick={hinzu} style={{ marginBottom: "0.75rem" }}>
            + Weitere Person
          </button>
        </div>
      )}

      <div>
        <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
          {pending ? "Wird gespeichert…" : "Personen speichern"}
        </button>
      </div>
    </form>
  );
}

/* --------------------------------------------------------------------- */
/* Stromkosten (Arbeits-/Grundpreis + optional neuer Abschlag)            */
/* --------------------------------------------------------------------- */
export function StromkostenForm({
  mietparteiId,
  steuersaetze,
  arbeitspreisNetto,
  arbeitspreisSteuersatzId,
  grundpreisNetto,
  grundpreisSteuersatzId,
  onSaved,
}: {
  mietparteiId: string;
  steuersaetze: SteuersatzOption[];
  arbeitspreisNetto: number;
  arbeitspreisSteuersatzId: string;
  grundpreisNetto: number | null;
  grundpreisSteuersatzId: string | null;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateStromkostenAction, initialState);
  useAutoClose(state.savedNonce, onSaved);
  const [hatGrundpreis, setHatGrundpreis] = useState(grundpreisNetto != null);
  return (
    <form action={formAction} key={state.savedNonce ?? "form"}>
      <Hinweis state={state} />
      <input type="hidden" name="id" value={mietparteiId} />
      <PriceInput
        label="Arbeitspreis (€/kWh)"
        nettoName="arbeitspreisNetto"
        steuersatzName="arbeitspreisSteuersatzId"
        defaultNetto={arbeitspreisNetto}
        defaultSteuersatzId={arbeitspreisSteuersatzId}
        steuersaetze={steuersaetze}
        required
      />
      <div className="field">
        <label>
          <input type="checkbox" name="hatGrundpreis" checked={hatGrundpreis} onChange={(e) => setHatGrundpreis(e.target.checked)} />{" "}
          Monatlicher Grundpreis
        </label>
      </div>
      {hatGrundpreis && (
        <PriceInput
          label="Grundpreis (€/Monat)"
          nettoName="grundpreisNetto"
          steuersatzName="grundpreisSteuersatzId"
          defaultNetto={grundpreisNetto}
          defaultSteuersatzId={grundpreisSteuersatzId ?? undefined}
          steuersaetze={steuersaetze}
        />
      )}
      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
        Der monatliche Abschlag wird separat über „Neuer Abschlag“ gepflegt.
      </p>

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Stromkosten speichern"}
      </button>
    </form>
  );
}

/* --------------------------------------------------------------------- */
/* Bankverbindung (Kontoinhaber:in, IBAN, Bank aus IBAN)                  */
/* --------------------------------------------------------------------- */
export function BankverbindungForm({
  mietparteiId,
  kontoinhaber,
  iban,
  bankName,
  onSaved,
}: {
  mietparteiId: string;
  kontoinhaber: string;
  iban: string;
  bankName: string;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateBankverbindungAction, initialState);
  useAutoClose(state.savedNonce, onSaved);
  const [bank, setBank] = useState(bankName);

  async function beiIbanBlur(e: React.FocusEvent<HTMLInputElement>) {
    const wert = e.target.value.trim();
    if (!wert) {
      setBank("");
      return;
    }
    const info = await bankAusIbanAction(wert);
    if (info) setBank(info.bankName);
  }

  return (
    <form action={formAction} key={state.savedNonce ?? "form"}>
      <Hinweis state={state} />
      <input type="hidden" name="id" value={mietparteiId} />
      <input type="hidden" name="bankName" value={bank} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="bk-kontoinhaber">Kontoinhaber:in</label>
          <input id="bk-kontoinhaber" name="kontoinhaber" type="text" defaultValue={kontoinhaber} />
        </div>
        <div className="field">
          <label htmlFor="bk-iban">IBAN</label>
          <input id="bk-iban" name="iban" type="text" defaultValue={iban} onBlur={beiIbanBlur} />
        </div>
        <div className="field">
          <label>Bank (aus IBAN)</label>
          <p style={{ margin: 0 }}>{bank || "—"}</p>
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Bankverbindung speichern"}
      </button>
    </form>
  );
}
