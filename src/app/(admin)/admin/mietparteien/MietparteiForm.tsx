"use client";

import { useActionState, useState } from "react";
import { PriceInput, type SteuersatzOption } from "@/components/PriceInput";
import { createMietparteiAction, updateMietparteiAction, type MietparteiFormState } from "./actions";

const initialState: MietparteiFormState = {};

function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

interface EinheitOption {
  id: string;
  label: string;
}

interface MietparteiFormProps {
  mode: "create" | "edit";
  einheiten: EinheitOption[];
  steuersaetze: SteuersatzOption[];
  mietpartei?: {
    id: string;
    einheitId: string;
    name: string;
    email: string;
    telefon: string | null;
    einzugsdatum: Date;
    auszugsdatum: Date | null;
    status: "AKTIV" | "INAKTIV";
    arbeitspreisNetto: number;
    arbeitspreisSteuersatzId: string;
    grundpreisNetto: number | null;
    grundpreisSteuersatzId: string | null;
  };
}

export function MietparteiForm({ mode, einheiten, steuersaetze, mietpartei }: MietparteiFormProps) {
  const action = mode === "create" ? createMietparteiAction : updateMietparteiAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // Fallback-Kette fuer unkontrollierte Felder: nach einem Validierungsfehler
  // die zuletzt eingegebenen Werte (state.values), sonst der bestehende
  // Datensatz (edit), sonst leer. So bleiben Eingaben bei ungueltiger E-Mail
  // erhalten (React 19 wuerde das Formular sonst zuruecksetzen).
  const val = (key: string, fallback = ""): string => state.values?.[key] ?? fallback;

  // Grundpreis standardmaessig aktiviert (neue Mietparteien haben i.d.R. einen).
  const grundpreisInitial =
    state.values?.hatGrundpreis !== undefined
      ? state.values.hatGrundpreis === "on"
      : mode === "create" || Boolean(mietpartei?.grundpreisNetto);
  const [hatGrundpreis, setHatGrundpreis] = useState(grundpreisInitial);

  const [einzugsdatum, setEinzugsdatum] = useState(val("einzugsdatum", toDateInputValue(mietpartei?.einzugsdatum)));
  // Abschlag gilt standardmaessig ab dem Einzugsdatum und folgt diesem, solange
  // nicht manuell abweichend gesetzt.
  const [abschlagGueltigAb, setAbschlagGueltigAb] = useState(val("abschlagGueltigAb") || einzugsdatum);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      {mietpartei && <input type="hidden" name="id" value={mietpartei.id} />}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="einheitId">Einheit</label>
          <select
            id="einheitId"
            name="einheitId"
            className="select-inline"
            defaultValue={val("einheitId", mietpartei?.einheitId ?? einheiten[0]?.id ?? "")}
            required
          >
            {einheiten.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required defaultValue={val("name", mietpartei?.name ?? "")} />
        </div>
        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" required defaultValue={val("email", mietpartei?.email ?? "")} />
        </div>
        <div className="field">
          <label htmlFor="telefon">Telefon</label>
          <input id="telefon" name="telefon" type="text" defaultValue={val("telefon", mietpartei?.telefon ?? "")} />
        </div>
        <div className="field">
          <label htmlFor="einzugsdatum">Einzugsdatum</label>
          <input
            id="einzugsdatum"
            name="einzugsdatum"
            type="date"
            required
            value={einzugsdatum}
            onChange={(e) => {
              // Abschlag-Startdatum folgt dem Einzugsdatum, solange es damit
              // uebereinstimmte (noch nicht manuell abweichend gesetzt).
              if (abschlagGueltigAb === einzugsdatum) setAbschlagGueltigAb(e.target.value);
              setEinzugsdatum(e.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="auszugsdatum">Auszugsdatum (optional)</label>
          <input
            id="auszugsdatum"
            name="auszugsdatum"
            type="date"
            defaultValue={val("auszugsdatum", toDateInputValue(mietpartei?.auszugsdatum))}
          />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            className="select-inline"
            defaultValue={val("status", mietpartei?.status ?? "AKTIV")}
          >
            <option value="AKTIV">Aktiv</option>
            <option value="INAKTIV">Inaktiv</option>
          </select>
        </div>
      </div>

      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: 0 }}>
        Die Anschrift entspricht der Adresse des Objekts und muss nicht separat erfasst werden.
      </p>

      <PriceInput
        label="Arbeitspreis (€/kWh)"
        nettoName="arbeitspreisNetto"
        steuersatzName="arbeitspreisSteuersatzId"
        defaultNetto={mietpartei?.arbeitspreisNetto}
        defaultSteuersatzId={mietpartei?.arbeitspreisSteuersatzId}
        steuersaetze={steuersaetze}
        required
      />

      <div className="field">
        <label>
          <input
            type="checkbox"
            name="hatGrundpreis"
            checked={hatGrundpreis}
            onChange={(e) => setHatGrundpreis(e.target.checked)}
          />{" "}
          Monatlicher Grundpreis
        </label>
      </div>

      {hatGrundpreis && (
        <PriceInput
          label="Grundpreis (€/Monat)"
          nettoName="grundpreisNetto"
          steuersatzName="grundpreisSteuersatzId"
          defaultNetto={mietpartei?.grundpreisNetto ?? 0}
          defaultSteuersatzId={mietpartei?.grundpreisSteuersatzId}
          steuersaetze={steuersaetze}
        />
      )}

      {mode === "create" && (
        <div className="section" style={{ marginTop: "1rem", background: "var(--color-primary-tint)" }}>
          <h3 style={{ marginTop: 0 }}>Monatlicher Abschlag</h3>
          <PriceInput
            label="Abschlag (€/Monat)"
            nettoName="abschlagNetto"
            steuersatzName="abschlagSteuersatzId"
            defaultNetto={0}
            steuersaetze={steuersaetze}
          />
          <div className="field">
            <label htmlFor="abschlagGueltigAb">Abschlag gültig ab</label>
            <input
              id="abschlagGueltigAb"
              name="abschlagGueltigAb"
              type="date"
              value={abschlagGueltigAb}
              onChange={(e) => setAbschlagGueltigAb(e.target.value)}
            />
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: 0 }}>
            Wird bei Betrag 0 nicht angelegt. Standard-Beginn ist das Einzugsdatum.
          </p>
        </div>
      )}

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem", marginTop: "1rem" }}>
        {pending ? "Wird gespeichert…" : mode === "create" ? "Mietpartei anlegen" : "Speichern"}
      </button>
    </form>
  );
}
