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
    anschrift: string | null;
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
  const [hatGrundpreis, setHatGrundpreis] = useState(Boolean(mietpartei?.grundpreisNetto));

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
            defaultValue={mietpartei?.einheitId ?? einheiten[0]?.id}
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
          <input id="name" name="name" type="text" required defaultValue={mietpartei?.name} />
        </div>
        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" required defaultValue={mietpartei?.email} />
        </div>
        <div className="field">
          <label htmlFor="telefon">Telefon</label>
          <input id="telefon" name="telefon" type="text" defaultValue={mietpartei?.telefon ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="anschrift">Anschrift</label>
          <input id="anschrift" name="anschrift" type="text" defaultValue={mietpartei?.anschrift ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="einzugsdatum">Einzugsdatum</label>
          <input
            id="einzugsdatum"
            name="einzugsdatum"
            type="date"
            required
            defaultValue={toDateInputValue(mietpartei?.einzugsdatum)}
          />
        </div>
        <div className="field">
          <label htmlFor="auszugsdatum">Auszugsdatum (optional)</label>
          <input
            id="auszugsdatum"
            name="auszugsdatum"
            type="date"
            defaultValue={toDateInputValue(mietpartei?.auszugsdatum)}
          />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" className="select-inline" defaultValue={mietpartei?.status ?? "AKTIV"}>
            <option value="AKTIV">Aktiv</option>
            <option value="INAKTIV">Inaktiv</option>
          </select>
        </div>
      </div>

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
          Grundpreis vereinbaren
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

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : mode === "create" ? "Mietpartei anlegen" : "Speichern"}
      </button>
    </form>
  );
}
