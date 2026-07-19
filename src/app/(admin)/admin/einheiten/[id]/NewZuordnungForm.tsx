"use client";

import { useActionState } from "react";
import { createZuordnungAction, type ZuordnungFormState } from "../actions";

const initialState: ZuordnungFormState = {};

interface GeraetOption {
  id: string;
  bezeichnung: string;
  deviceId: string;
}

export function NewZuordnungForm({
  einheitId,
  geraete,
  zeigeWaermepumpe = false,
}: {
  einheitId: string;
  geraete: GeraetOption[];
  zeigeWaermepumpe?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createZuordnungAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="einheitId" value={einheitId} />

      <div className="form-grid">
        <div className="field">
          <label htmlFor="shellyGeraetId">Gerät</label>
          <select id="shellyGeraetId" name="shellyGeraetId" className="select-inline" required>
            {geraete.map((g) => (
              <option key={g.id} value={g.id}>
                {g.bezeichnung} ({g.deviceId})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="modus">Verrechnung</label>
          <select id="modus" name="modus" className="select-inline" defaultValue="ADDIEREN">
            <option value="ADDIEREN">Addieren (normaler Verbrauch)</option>
            <option value="SUBTRAHIEREN">Subtrahieren (z.B. Allgemeinstrom-Zwischenzähler)</option>
          </select>
        </div>
      </div>

      {/* Nur bei Allgemeinstrom: Zaehler als Waermepumpe markieren -> getrennter
         Rechnungsausweis (nur Arbeitspreis). */}
      {zeigeWaermepumpe && (
        <div className="field">
          <label>
            <input type="checkbox" name="istWaermepumpe" /> Dieser Zähler ist die Wärmepumpe
          </label>
          <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "0.2rem 0 0" }}>
            Der Verbrauch wird in der Rechnung getrennt ausgewiesen (nur Arbeitspreis, kein Grundpreis).
          </p>
        </div>
      )}

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Zuordnung anlegen"}
      </button>
    </form>
  );
}
