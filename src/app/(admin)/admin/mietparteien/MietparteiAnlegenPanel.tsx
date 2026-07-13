"use client";

import { useState } from "react";
import { MietparteiForm } from "./MietparteiForm";
import type { SteuersatzOption } from "@/components/PriceInput";

interface EinheitOption {
  id: string;
  label: string;
  adresse: string;
  plz: string;
  ort: string;
}

/**
 * Klappt das Anlege-Formular für Mietparteien erst auf Knopfdruck auf (analog
 * zum Anlegen von Objekt/Einheit/Gerät auf der Objekt-Seite), damit die
 * Mietparteien-Übersicht darüber nicht dauerhaft von einem großen Formular
 * verdeckt wird.
 */
export function MietparteiAnlegenPanel({
  einheiten,
  steuersaetze,
}: {
  einheiten: EinheitOption[];
  steuersaetze: SteuersatzOption[];
}) {
  const [offen, setOffen] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="btn-small"
        aria-expanded={offen}
        onClick={() => setOffen((o) => !o)}
      >
        {offen ? "Abbrechen" : "+ Neue Mietpartei / Interessent:in"}
      </button>
      {offen && (
        <div style={{ marginTop: "1.25rem" }}>
          <MietparteiForm mode="create" einheiten={einheiten} steuersaetze={steuersaetze} />
        </div>
      )}
    </div>
  );
}
