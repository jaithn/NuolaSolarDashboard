"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createRechnungsentwurfAction, storniereAction, type RechnungFormState } from "./actions";

const initialState: RechnungFormState = {};

interface MietparteiOption {
  id: string;
  label: string;
}

export function NewRechnungForm({
  mietparteien,
  initialTyp = "JAHRESABRECHNUNG",
}: {
  mietparteien: MietparteiOption[];
  initialTyp?: "JAHRESABRECHNUNG" | "SCHLUSSRECHNUNG";
}) {
  const [state, formAction, pending] = useActionState(createRechnungsentwurfAction, initialState);
  const jetzt = new Date();
  const jahresanfang = `${jetzt.getFullYear()}-01-01`;
  const jahresende = `${jetzt.getFullYear()}-12-31`;

  return (
    <>
      {/* Konflikt-Panel bewusst AUSSERHALB des Erstell-Formulars (kein
          verschachteltes <form> - die Storno-Aktion ist ein eigenes Formular). */}
      {state.konflikt && (
        <div className="form-error">
          {state.konflikt.istEntwurf ? (
            <>
              Es existiert bereits ein <strong>Entwurf</strong> für diesen Zeitraum.{" "}
              <Link href={`/admin/rechnungen/${state.konflikt.existierendeRechnungId}`}>Entwurf öffnen</Link> – dort
              können Sie ihn bearbeiten oder löschen und danach neu erstellen.
            </>
          ) : (
            <>
              Es existiert bereits eine <strong>freigegebene Rechnung</strong>
              {state.konflikt.rechnungsnummer ? ` (${state.konflikt.rechnungsnummer})` : ""} für diesen Zeitraum. Zur
              Korrektur muss diese zuerst storniert werden (Stornorechnung mit eigener Nummer), danach kann die neue
              Rechnung erstellt werden.
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                <Link className="btn-small" href={`/admin/rechnungen/${state.konflikt.existierendeRechnungId}`}>
                  Bestehende Rechnung öffnen
                </Link>
                <form action={storniereAction}>
                  <input type="hidden" name="id" value={state.konflikt.existierendeRechnungId} />
                  <button className="btn-small btn-danger" type="submit">
                    Bestehende Rechnung stornieren
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      <form action={formAction}>
        {state.error && !state.konflikt && <div className="form-error">{state.error}</div>}
        <div className="form-grid">
        <div className="field">
          <label htmlFor="mietparteiId">Mietpartei</label>
          <select id="mietparteiId" name="mietparteiId" className="select-inline" required>
            {mietparteien.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="typ">Typ</label>
          <select id="typ" name="typ" className="select-inline" defaultValue={initialTyp}>
            <option value="JAHRESABRECHNUNG">Jahresabrechnung</option>
            <option value="SCHLUSSRECHNUNG">Schlussrechnung</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="von">Zeitraum von</label>
          <input id="von" name="von" type="date" required defaultValue={jahresanfang} />
        </div>
        <div className="field">
          <label htmlFor="bis">Zeitraum bis</label>
          <input id="bis" name="bis" type="date" required defaultValue={jahresende} />
        </div>
      </div>
        <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
          {pending ? "Wird erstellt…" : "Entwurf erstellen"}
        </button>
      </form>
    </>
  );
}
