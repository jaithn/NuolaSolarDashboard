"use client";

import { useState } from "react";
import { MietparteiForm } from "./MietparteiForm";
import { SeitentitelAnlegen } from "@/components/SeitentitelAnlegen";
import type { SteuersatzOption } from "@/components/PriceInput";

interface EinheitOption {
  id: string;
  label: string;
  adresse: string;
  plz: string;
  ort: string;
}

/**
 * Seitentitel „Mietparteien" mit +-Anlege-Menü. „Neue Mietpartei / Interessent:in"
 * klappt das Anlege-Formular direkt unter dem Titel auf. (Der „Allgemeinstrom"-
 * Eintrag folgt in Phase 7.)
 */
export function MietparteiAnlegenPanel({
  einheiten,
  steuersaetze,
}: {
  einheiten: EinheitOption[];
  steuersaetze: SteuersatzOption[];
}) {
  const [offen, setOffen] = useState<string | null>(null);
  // Voraussetzung zum Anlegen: mindestens eine Einheit und ein Steuersatz.
  const bereit = einheiten.length > 0 && steuersaetze.length > 0;

  return (
    <div>
      <SeitentitelAnlegen
        titel="Mietparteien"
        offen={offen}
        onSelect={setOffen}
        items={[{ key: "mietpartei", label: "Neue Mietpartei / Interessent:in", disabled: !bereit }]}
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
    </div>
  );
}
