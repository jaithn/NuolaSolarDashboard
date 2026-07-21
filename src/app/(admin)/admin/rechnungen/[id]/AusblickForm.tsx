"use client";

import { useActionState, useState } from "react";
import { PriceInput, GrossPriceInput, type SteuersatzOption } from "@/components/PriceInput";
import { setAusblickAction, type AusblickFormState } from "../actions";
import type { AusblickDaten } from "@/lib/billing/ausblick";

const initialState: AusblickFormState = {};

/**
 * Bei der Prüfung eines Rechnungs-Entwurfs: optionaler „Ausblick" für die
 * Mietpartei – neue Strompreise (mit Grund) und/oder ein neuer monatlicher
 * Abschlag ab einem Stichtag. Wird auf der Rechnung ausgewiesen und bei der
 * Freigabe ins Mietprofil übernommen.
 */
export function AusblickForm({
  rechnungId,
  steuersaetze,
  defaultGueltigAb,
  arbeitspreisNetto,
  arbeitspreisSteuersatzId,
  grundpreisNetto,
  grundpreisSteuersatzId,
  ausblick,
}: {
  rechnungId: string;
  steuersaetze: SteuersatzOption[];
  defaultGueltigAb: string;
  arbeitspreisNetto: number;
  arbeitspreisSteuersatzId: string;
  grundpreisNetto: number | null;
  grundpreisSteuersatzId: string | null;
  ausblick: AusblickDaten | null;
}) {
  const [state, formAction, pending] = useActionState(setAusblickAction, initialState);
  const [preisAktiv, setPreisAktiv] = useState(ausblick?.preis != null);
  const [abschlagAktiv, setAbschlagAktiv] = useState(ausblick?.abschlag != null);
  const [hatGrundpreis, setHatGrundpreis] = useState(
    ausblick?.preis ? ausblick.preis.grundpreisNetto != null : grundpreisNetto != null,
  );

  // Vorbelegung: bereits gespeicherter Ausblick, sonst die aktuellen Mietprofil-Werte.
  const apNetto = ausblick?.preis?.arbeitspreisNetto ?? arbeitspreisNetto;
  const apSatz = ausblick?.preis?.arbeitspreisSteuersatzId ?? arbeitspreisSteuersatzId;
  const gpNetto = ausblick?.preis?.grundpreisNetto ?? grundpreisNetto;
  const gpSatz = ausblick?.preis?.grundpreisSteuersatzId ?? grundpreisSteuersatzId;

  return (
    <form action={formAction} key={state.savedNonce ?? "form"}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.success && (
        <div className="form-notice" role="status">
          {state.success}
        </div>
      )}
      <input type="hidden" name="id" value={rechnungId} />

      <p style={{ marginTop: 0, color: "var(--color-muted)" }}>
        Optionaler Ausblick für die Mietpartei: neue Preise und/oder ein neuer Abschlag ab dem gewählten Datum.
        Wird auf dieser Rechnung ausgewiesen und bei der Freigabe im Mietprofil hinterlegt.
      </p>

      <div className="field">
        <label htmlFor="ab-gueltigAb">Änderungen gültig ab</label>
        <input
          id="ab-gueltigAb"
          name="gueltigAb"
          type="date"
          defaultValue={ausblick?.gueltigAb ?? defaultGueltigAb}
          required
          style={{ maxWidth: "12rem" }}
        />
      </div>

      <div className="field">
        <label>
          <input type="checkbox" name="preisAktiv" checked={preisAktiv} onChange={(e) => setPreisAktiv(e.target.checked)} />{" "}
          Die Strompreise ändern sich
        </label>
      </div>
      {preisAktiv && (
        <div className="section" style={{ marginTop: 0, background: "var(--color-primary-tint)" }}>
          <PriceInput
            label="Neuer Arbeitspreis (€/kWh)"
            nettoName="arbeitspreisNetto"
            steuersatzName="arbeitspreisSteuersatzId"
            defaultNetto={apNetto}
            defaultSteuersatzId={apSatz}
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
              label="Neuer Grundpreis (€/Monat)"
              nettoName="grundpreisNetto"
              steuersatzName="grundpreisSteuersatzId"
              defaultNetto={gpNetto}
              defaultSteuersatzId={gpSatz ?? undefined}
              steuersaetze={steuersaetze}
            />
          )}
          <div className="field">
            <label htmlFor="ab-grund">Grund der Preisänderung</label>
            <textarea
              id="ab-grund"
              name="grund"
              rows={2}
              defaultValue={ausblick?.preis?.grund ?? ""}
              style={{ width: "100%", maxWidth: "36rem" }}
            />
          </div>
        </div>
      )}

      <div className="field">
        <label>
          <input
            type="checkbox"
            name="abschlagAktiv"
            checked={abschlagAktiv}
            onChange={(e) => setAbschlagAktiv(e.target.checked)}
          />{" "}
          Neuer monatlicher Abschlag
        </label>
      </div>
      {abschlagAktiv && (
        <div className="section" style={{ marginTop: 0, background: "var(--color-primary-tint)" }}>
          <GrossPriceInput
            label="Neuer Abschlag (€/Monat, inkl. MwSt.)"
            bruttoName="abschlagBrutto"
            steuersatzName="abschlagSteuersatzId"
            defaultBrutto={ausblick?.abschlag?.bruttoBetrag ?? 0}
            defaultSteuersatzId={ausblick?.abschlag?.steuersatzId}
            steuersaetze={steuersaetze}
            required
          />
        </div>
      )}

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "18rem" }}>
        {pending ? "Wird gespeichert…" : "Ausblick speichern"}
      </button>
    </form>
  );
}
