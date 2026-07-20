"use client";

import { useState } from "react";
import { createEinheitManualMesswertAction } from "./actions";
import { NuolaPlusIcon } from "@/components/SeitentitelAnlegen";

/**
 * Zelle „Manueller Zählerstand" in der Verbrauchsübersicht: standardmäßig nur ein
 * +-Button (gleiche Nuola-Optik wie das Anlege-Menü). Erst ein Klick klappt die
 * Eingabefelder (Datum, kWh) auf – so ist die Tabelle nicht mit Formularfeldern
 * für jede Partei überladen.
 */
export function ManuellerZaehlerZelle({
  einheitId,
  einheitBezeichnung,
  zurueckUrl,
  hatGeraet,
  defaultDatum,
}: {
  einheitId: string;
  einheitBezeichnung: string;
  zurueckUrl: string;
  hatGeraet: boolean;
  defaultDatum: string;
}) {
  const [offen, setOffen] = useState(false);

  if (!offen) {
    return (
      <button
        type="button"
        className="anlegen-plus anlegen-plus-klein"
        aria-expanded={false}
        aria-label={`Manuellen Zählerstand für ${einheitBezeichnung} eintragen`}
        onClick={() => setOffen(true)}
      >
        <NuolaPlusIcon size={22} />
      </button>
    );
  }

  return (
    <div>
      {/* Manueller Zählerstand ist immer möglich - fehlt ein Zähler, legt die
         Action automatisch einen „Manueller Zähler" an. */}
      <form
        action={createEinheitManualMesswertAction}
        style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}
      >
        <input type="hidden" name="einheitId" value={einheitId} />
        <input type="hidden" name="zurueck" value={zurueckUrl} />
        <input
          className="text-input"
          name="datum"
          type="date"
          required
          defaultValue={defaultDatum}
          aria-label={`Datum des Zählerstands für ${einheitBezeichnung}`}
          style={{ maxWidth: "9rem" }}
        />
        <input
          className="text-input"
          name="kwh"
          type="number"
          step="0.001"
          min={0}
          required
          aria-label={`Manueller Zählerstand (kWh) für ${einheitBezeichnung}`}
          placeholder="kWh"
          style={{ maxWidth: "8rem" }}
        />
        <button className="btn-small" type="submit">
          Eintragen
        </button>
        <button
          className="btn-small"
          type="button"
          onClick={() => setOffen(false)}
          style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
        >
          Abbrechen
        </button>
      </form>
      {!hatGeraet && (
        <span style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
          Ohne Zähler – legt beim ersten Wert einen manuellen Zähler an.
        </span>
      )}
    </div>
  );
}
