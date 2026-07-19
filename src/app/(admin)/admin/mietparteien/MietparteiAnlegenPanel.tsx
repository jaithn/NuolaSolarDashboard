"use client";

import { useState } from "react";
import { MietparteiForm } from "./MietparteiForm";
import { SeitentitelAnlegen } from "@/components/SeitentitelAnlegen";
import { AllgemeinstromForm, type AllgemeinstromObjektOption } from "@/components/AllgemeinstromForm";
import type { SteuersatzOption } from "@/components/PriceInput";

interface EinheitOption {
  id: string;
  label: string;
  adresse: string;
  plz: string;
  ort: string;
}

/**
 * Seitentitel „Mietparteien" mit +-Anlege-Menü: „Neue Mietpartei / Interessent:in"
 * sowie „Allgemeinstrom" (legt Einheit + Vermieter-Mietpartei in einem Schritt an).
 */
export function MietparteiAnlegenPanel({
  einheiten,
  objekte,
  steuersaetze,
}: {
  einheiten: EinheitOption[];
  objekte: AllgemeinstromObjektOption[];
  steuersaetze: SteuersatzOption[];
}) {
  const [offen, setOffen] = useState<string | null>(null);
  // Voraussetzung zum Anlegen: mindestens eine Einheit und ein Steuersatz.
  const bereit = einheiten.length > 0 && steuersaetze.length > 0;
  const allgemeinstromBereit = objekte.length > 0 && steuersaetze.length > 0;

  return (
    <div>
      <SeitentitelAnlegen
        titel="Mietparteien"
        offen={offen}
        onSelect={setOffen}
        items={[
          { key: "mietpartei", label: "Neue Mietpartei / Interessent:in", disabled: !bereit },
          { key: "allgemeinstrom", label: "Allgemeinstrom", disabled: !allgemeinstromBereit },
        ]}
      />

      {!bereit && (
        <p style={{ color: "var(--color-muted)", marginTop: "-0.25rem" }}>
          {einheiten.length === 0
            ? "Bitte zuerst ein Objekt mit Einheit anlegen."
            : "Bitte zuerst einen Steuersatz anlegen."}
        </p>
      )}

      {offen === "mietpartei" && bereit && (
        <div className="section">
          <h2 style={{ marginTop: 0 }}>Neue Mietpartei / Interessent:in</h2>
          <MietparteiForm mode="create" einheiten={einheiten} steuersaetze={steuersaetze} />
        </div>
      )}

      {offen === "allgemeinstrom" && allgemeinstromBereit && (
        <div className="section">
          <h2 style={{ marginTop: 0 }}>Allgemeinstrom anlegen</h2>
          <AllgemeinstromForm objekte={objekte} steuersaetze={steuersaetze} />
        </div>
      )}
    </div>
  );
}
