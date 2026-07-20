"use client";

import { useActionState, useState } from "react";
import { SeitentitelAnlegen } from "@/components/SeitentitelAnlegen";
import type { SteuersatzOption } from "@/components/PriceInput";
import { NewAbschlagForm } from "../NewAbschlagForm";
import { NewRechnungForm } from "../../rechnungen/NewRechnungForm";
import { ZugangPanel } from "./ZugangPanel";
import {
  StammdatenForm,
  PersonenForm,
  StromkostenForm,
  BankverbindungForm,
  type EinheitOption,
} from "./MietparteiEditForms";
import { uploadDokumentAction, type OnboardingState } from "../actions";
import { createEinheitManualMesswertAction } from "../../actions";

interface WeiterePerson {
  anrede: string;
  vorname: string;
  name: string;
}

export interface MietparteiAktionenProps {
  titel: string;
  mietparteiId: string;
  einheiten: EinheitOption[];
  // Stammdaten
  einheitId: string;
  status: string;
  einzugsdatum: string;
  auszugsdatum: string;
  email: string;
  telefon: string;
  anschrift: string;
  anschriftPlz: string;
  anschriftOrt: string;
  // Personen
  anrede: string;
  firma: string;
  vorname: string;
  name: string;
  weiterePersonen: WeiterePerson[];
  // Stromkosten
  steuersaetze: SteuersatzOption[];
  arbeitspreisNetto: number;
  arbeitspreisSteuersatzId: string;
  grundpreisNetto: number | null;
  grundpreisSteuersatzId: string | null;
  // Bank
  kontoinhaber: string;
  iban: string;
  bankName: string;
  // Rechnung (Einzel-Mietpartei fuer die wiederverwendete NewRechnungForm)
  rechnungLabel: string;
  // Zugang
  hasZugang: boolean;
  username?: string;
  mustChangePassword?: boolean;
  // Manueller Zaehlerwert
  einheitBezeichnung: string;
}

const ITEMS = [
  { key: "stammdaten", label: "Neue Stammdaten" },
  { key: "person", label: "Neue Person" },
  { key: "stromkosten", label: "Neue Stromkosten (Abschlag & Arbeitspreis)" },
  { key: "abschlag", label: "Neuer Abschlag" },
  { key: "bank", label: "Neue Bankverbindung" },
  { key: "rechnung", label: "Neue Rechnung" },
  { key: "zugang", label: "Neuer Dashboard-Zugang" },
  { key: "zaehler", label: "Neuer manueller Zählerwert" },
  { key: "dokument", label: "Neuer Dokumenten-Upload" },
];

export function MietparteiAktionenPanel(props: MietparteiAktionenProps) {
  const [offen, setOffen] = useState<string | null>(null);
  const { mietparteiId } = props;

  return (
    <div>
      <SeitentitelAnlegen titel={props.titel} items={ITEMS} offen={offen} onSelect={setOffen} />

      {offen && (
        <div className="section">
          {offen === "stammdaten" && (
            <>
              <h2 style={{ marginTop: 0 }}>Stammdaten bearbeiten</h2>
              <StammdatenForm
                mietparteiId={mietparteiId}
                einheiten={props.einheiten}
                einheitId={props.einheitId}
                status={props.status}
                einzugsdatum={props.einzugsdatum}
                auszugsdatum={props.auszugsdatum}
                email={props.email}
                telefon={props.telefon}
                anschrift={props.anschrift}
                anschriftPlz={props.anschriftPlz}
                anschriftOrt={props.anschriftOrt}
              />
            </>
          )}
          {offen === "person" && (
            <>
              <h2 style={{ marginTop: 0 }}>Personen bearbeiten</h2>
              <PersonenForm
                mietparteiId={mietparteiId}
                anrede={props.anrede}
                firma={props.firma}
                vorname={props.vorname}
                name={props.name}
                weiterePersonen={props.weiterePersonen}
              />
            </>
          )}
          {offen === "stromkosten" && (
            <>
              <h2 style={{ marginTop: 0 }}>Stromkosten bearbeiten</h2>
              <StromkostenForm
                mietparteiId={mietparteiId}
                steuersaetze={props.steuersaetze}
                arbeitspreisNetto={props.arbeitspreisNetto}
                arbeitspreisSteuersatzId={props.arbeitspreisSteuersatzId}
                grundpreisNetto={props.grundpreisNetto}
                grundpreisSteuersatzId={props.grundpreisSteuersatzId}
              />
            </>
          )}
          {offen === "abschlag" && (
            <>
              <h2 style={{ marginTop: 0 }}>Neuer Abschlag</h2>
              <NewAbschlagForm mietparteiId={mietparteiId} steuersaetze={props.steuersaetze} />
            </>
          )}
          {offen === "bank" && (
            <>
              <h2 style={{ marginTop: 0 }}>Bankverbindung bearbeiten</h2>
              <BankverbindungForm
                mietparteiId={mietparteiId}
                kontoinhaber={props.kontoinhaber}
                iban={props.iban}
                bankName={props.bankName}
              />
            </>
          )}
          {offen === "rechnung" && (
            <>
              <h2 style={{ marginTop: 0 }}>Neue Rechnung (Entwurf)</h2>
              <NewRechnungForm mietparteien={[{ id: mietparteiId, label: props.rechnungLabel }]} />
            </>
          )}
          {offen === "zugang" && (
            <>
              <h2 style={{ marginTop: 0 }}>Dashboard-Zugang</h2>
              <ZugangPanel
                mietparteiId={mietparteiId}
                hasZugang={props.hasZugang}
                username={props.username}
                mustChangePassword={props.mustChangePassword}
              />
            </>
          )}
          {offen === "zaehler" && (
            <>
              <h2 style={{ marginTop: 0 }}>Manueller Zählerwert</h2>
              <ManuellerZaehlerForm
                einheitId={props.einheitId}
                einheitBezeichnung={props.einheitBezeichnung}
                zurueckUrl={`/admin/mietparteien/${mietparteiId}`}
              />
            </>
          )}
          {offen === "dokument" && (
            <>
              <h2 style={{ marginTop: 0 }}>Dokument hochladen</h2>
              <DokumentUploadForm mietparteiId={mietparteiId} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* Kleines Upload-Formular (gescannter Rückläufer) – reuse uploadDokumentAction. */
const uploadInitial: OnboardingState = {};
function DokumentUploadForm({ mietparteiId }: { mietparteiId: string }) {
  const [state, action, pending] = useActionState(uploadDokumentAction, uploadInitial);
  return (
    <form action={action} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.success && (
        <div className="form-notice" role="status">
          {state.success}
        </div>
      )}
      <input type="hidden" name="mietparteiId" value={mietparteiId} />
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="du-typ">Art</label>
        <select id="du-typ" name="typ" className="select-inline" defaultValue="VERTRAG_EIGENSTAENDIG">
          <option value="VERTRAG_EIGENSTAENDIG">Stromliefervertrag</option>
          <option value="VERTRAG_ERGAENZUNG">Ergänzung zum Mietvertrag</option>
          <option value="SEPA">SEPA-Mandat</option>
          <option value="SONSTIGES">Sonstiges</option>
        </select>
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="du-datei">Datei</label>
        <input id="du-datei" name="datei" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Wird hochgeladen…" : "Hochladen"}
      </button>
    </form>
  );
}

/* Manueller Zählerstand für die Einheit der Mietpartei – reuse createEinheitManualMesswertAction. */
function ManuellerZaehlerForm({
  einheitId,
  einheitBezeichnung,
  zurueckUrl,
}: {
  einheitId: string;
  einheitBezeichnung: string;
  zurueckUrl: string;
}) {
  const heute = new Date().toISOString().slice(0, 10);
  return (
    <form action={createEinheitManualMesswertAction} style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="einheitId" value={einheitId} />
      <input type="hidden" name="zurueck" value={zurueckUrl} />
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="mz-datum">Datum</label>
        <input id="mz-datum" name="datum" type="date" required defaultValue={heute} style={{ maxWidth: "10rem" }} />
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="mz-kwh">Zählerstand (kWh)</label>
        <input
          id="mz-kwh"
          name="kwh"
          type="number"
          step="0.001"
          min={0}
          required
          placeholder="kWh"
          aria-label={`Manueller Zählerstand (kWh) für ${einheitBezeichnung}`}
          style={{ maxWidth: "10rem" }}
        />
      </div>
      <button className="btn" type="submit">
        Eintragen
      </button>
    </form>
  );
}
