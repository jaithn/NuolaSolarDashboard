"use client";

import { useActionState, useEffect } from "react";
import { GrossPriceInput, type SteuersatzOption } from "@/components/PriceInput";
import { createAbschlagAction, type AbschlagFormState } from "./actions";

const initialState: AbschlagFormState = {};

export function NewAbschlagForm({
  mietparteiId,
  steuersaetze,
  onSaved,
}: {
  mietparteiId: string;
  steuersaetze: SteuersatzOption[];
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createAbschlagAction, initialState);
  useEffect(() => {
    if (state.savedNonce) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedNonce]);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <input type="hidden" name="mietparteiId" value={mietparteiId} />

      <GrossPriceInput
        label="Monatlicher Abschlag (inkl. MwSt.)"
        bruttoName="bruttoBetrag"
        steuersatzName="steuersatzId"
        defaultBrutto={0}
        steuersaetze={steuersaetze}
        required
      />

      <div className="form-grid">
        <div className="field">
          <label htmlFor="gueltigAb">Gültig ab</label>
          <input id="gueltigAb" name="gueltigAb" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="gueltigBis">Gültig bis (optional)</label>
          <input id="gueltigBis" name="gueltigBis" type="date" />
        </div>
      </div>

      <button className="btn" type="submit" disabled={pending} style={{ maxWidth: "16rem" }}>
        {pending ? "Wird gespeichert…" : "Abschlag anlegen"}
      </button>
    </form>
  );
}
