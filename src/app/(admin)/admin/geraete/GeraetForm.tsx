"use client";

import { useActionState } from "react";
import { createGeraetAction, updateGeraetAction, type GeraetFormState } from "./actions";

const initialState: GeraetFormState = {};

interface ObjektOption {
  id: string;
  name: string;
}

interface GeraetFormProps {
  objekte: ObjektOption[];
  mode: "create" | "edit";
  geraet?: {
    id: string;
    objektId: string;
    deviceId: string;
    serverHost: string;
    bezeichnung: string;
    abrufIntervallMinuten: number;
  };
}

export function GeraetForm({ objekte, mode, geraet }: GeraetFormProps) {
  const action = mode === "create" ? createGeraetAction : updateGeraetAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.warning && <div className="form-error" role="status">{state.warning}</div>}
      {!state.warning && state.success && <div className="form-notice" role="status">{state.success}</div>}
      {geraet && <input type="hidden" name="id" value={geraet.id} />}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="objektId">Objekt</label>
          <select id="objektId" name="objektId" className="select-inline" defaultValue={geraet?.objektId ?? objekte[0]?.id} required>
            {objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bezeichnung">Bezeichnung</label>
          <input
            id="bezeichnung"
            name="bezeichnung"
            type="text"
            required
            defaultValue={geraet?.bezeichnung}
            placeholder="Pro 3EM Keller"
          />
        </div>
        <div className="field">
          <label htmlFor="deviceId">Shelly Device-ID</label>
          <input id="deviceId" name="deviceId" type="text" required defaultValue={geraet?.deviceId} />
        </div>
        <div className="field">
          <label htmlFor="serverHost">Cloud-Server</label>
          <input
            id="serverHost"
            name="serverHost"
            type="text"
            required
            defaultValue={geraet?.serverHost}
            placeholder="shelly-103-eu.shelly.cloud"
            aria-describedby="serverHost-hilfe"
          />
          <p id="serverHost-hilfe" className="price-breakdown">
            Mit oder ohne „https://&quot; – wird automatisch bereinigt.
          </p>
        </div>
        <div className="field">
          <label htmlFor="abrufIntervallMinuten">Abrufintervall (Minuten)</label>
          <input
            id="abrufIntervallMinuten"
            name="abrufIntervallMinuten"
            type="number"
            min={1}
            step={1}
            defaultValue={geraet?.abrufIntervallMinuten ?? 15}
            aria-describedby="intervall-hilfe"
          />
          <p id="intervall-hilfe" className="price-breakdown">
            Wie oft dieses Gerät abgefragt wird. Standard: alle 15 Minuten.
          </p>
        </div>
      </div>

      <p style={{ fontSize: "0.85rem", color: "#475569" }}>
        Welchen Einheiten dieses Gerät zugeordnet ist (und ob es addiert oder als
        Allgemeinstrom-Zwischenzähler subtrahiert wird), wird auf der jeweiligen Einheiten-Seite
        gepflegt.
      </p>

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : mode === "create" ? "Gerät anlegen" : "Speichern"}
      </button>
    </form>
  );
}
