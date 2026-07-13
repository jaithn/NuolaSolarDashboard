"use client";

import { useActionState, useState } from "react";
import { NewObjektForm } from "./NewObjektForm";
import { GeraetForm } from "../geraete/GeraetForm";
import { createEinheitAction, type ObjektFormState } from "./actions";

interface ObjektOption {
  id: string;
  name: string;
  vermieterProEinheit: boolean;
}

const initialState: ObjektFormState = {};

/**
 * Zwischenschritt zum Anlegen: statt drei dauerhaft offener Formulare gibt es
 * drei Buttons (Objekt / Einheit / Gerät), die das jeweilige Formular
 * ein-/ausklappen. So bleibt die Objekt-Übersicht darüber übersichtlich.
 */
export function StammdatenAnlegenPanel({ objekte }: { objekte: ObjektOption[] }) {
  const [offen, setOffen] = useState<null | "objekt" | "einheit" | "geraet">(null);
  const toggle = (w: "objekt" | "einheit" | "geraet") => setOffen((cur) => (cur === w ? null : w));

  return (
    <div className="section">
      <h2>Neu anlegen</h2>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: offen ? "1.25rem" : 0 }}>
        <button
          type="button"
          className="btn-small"
          aria-expanded={offen === "objekt"}
          onClick={() => toggle("objekt")}
        >
          + Neues Objekt
        </button>
        <button
          type="button"
          className="btn-small"
          aria-expanded={offen === "einheit"}
          onClick={() => toggle("einheit")}
          disabled={objekte.length === 0}
        >
          + Neue Einheit
        </button>
        <button
          type="button"
          className="btn-small"
          aria-expanded={offen === "geraet"}
          onClick={() => toggle("geraet")}
          disabled={objekte.length === 0}
        >
          + Neues Gerät
        </button>
      </div>

      {offen === "objekt" && (
        <div>
          <h3 style={{ marginTop: 0 }}>Neues Objekt</h3>
          <NewObjektForm />
        </div>
      )}

      {offen === "einheit" && (
        <div>
          <h3 style={{ marginTop: 0 }}>Neue Einheit</h3>
          <NewEinheitMitAuswahl objekte={objekte} />
        </div>
      )}

      {offen === "geraet" && (
        <div>
          <h3 style={{ marginTop: 0 }}>Neues Gerät</h3>
          <GeraetForm mode="create" objekte={objekte} />
        </div>
      )}
    </div>
  );
}

function NewEinheitMitAuswahl({ objekte }: { objekte: ObjektOption[] }) {
  const [state, formAction, pending] = useActionState(createEinheitAction, initialState);
  const [objektId, setObjektId] = useState(objekte[0]?.id ?? "");
  // Vermieter-Felder nur zeigen, wenn das gewählte Objekt „pro Wohneinheit" ist.
  const vermieterProEinheit = objekte.find((o) => o.id === objektId)?.vermieterProEinheit ?? false;

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="einheit-objektId">Objekt</label>
          <select
            id="einheit-objektId"
            name="objektId"
            className="select-inline"
            value={objektId}
            onChange={(e) => setObjektId(e.target.value)}
            required
          >
            {objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="einheit-bezeichnung">Bezeichnung</label>
          <input id="einheit-bezeichnung" name="bezeichnung" type="text" required placeholder="Wohnung 1.OG links" />
        </div>
        {vermieterProEinheit && (
          <>
            <div className="field">
              <label htmlFor="einheit-vermieterName">Vermieter (Name)</label>
              <input id="einheit-vermieterName" name="vermieterName" type="text" />
            </div>
            <div className="field">
              <label htmlFor="einheit-vermieterAnschrift">Vermieter (Anschrift)</label>
              <input id="einheit-vermieterAnschrift" name="vermieterAnschrift" type="text" />
            </div>
          </>
        )}
      </div>
      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Einheit anlegen"}
      </button>
    </form>
  );
}
