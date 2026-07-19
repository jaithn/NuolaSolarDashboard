"use client";

import { useState } from "react";
import { NewRechnungForm } from "./NewRechnungForm";
import { BatchEntwuerfeForm } from "./BatchEntwuerfeForm";
import { SeitentitelAnlegen } from "@/components/SeitentitelAnlegen";

interface MietparteiOption {
  id: string;
  label: string;
}

/**
 * Seitentitel „Rechnungen" mit +-Anlege-Menü: einzelne Jahresabrechnung,
 * einzelne Schlussrechnung oder Sammel-Entwürfe für alle aktiven Einheiten.
 */
export function RechnungAnlegenPanel({ mietparteien }: { mietparteien: MietparteiOption[] }) {
  const [offen, setOffen] = useState<string | null>(null);
  const keineMietparteien = mietparteien.length === 0;

  return (
    <div>
      <SeitentitelAnlegen
        titel="Rechnungen"
        offen={offen}
        onSelect={setOffen}
        items={[
          { key: "jahres", label: "Neue Jahresabrechnung", disabled: keineMietparteien },
          { key: "schluss", label: "Neue Schlussrechnung", disabled: keineMietparteien },
          { key: "batch", label: "Entwürfe für alle aktiven Einheiten", disabled: keineMietparteien },
        ]}
      />

      {keineMietparteien && (
        <p style={{ color: "var(--color-muted)", marginTop: "-0.25rem" }}>Bitte zuerst eine Mietpartei anlegen.</p>
      )}

      {offen === "jahres" && !keineMietparteien && (
        <div className="section">
          <h2 style={{ marginTop: 0 }}>Neue Jahresabrechnung</h2>
          <NewRechnungForm mietparteien={mietparteien} initialTyp="JAHRESABRECHNUNG" />
        </div>
      )}
      {offen === "schluss" && !keineMietparteien && (
        <div className="section">
          <h2 style={{ marginTop: 0 }}>Neue Schlussrechnung</h2>
          <NewRechnungForm mietparteien={mietparteien} initialTyp="SCHLUSSRECHNUNG" />
        </div>
      )}
      {offen === "batch" && !keineMietparteien && (
        <div className="section">
          <h2 style={{ marginTop: 0 }}>Entwürfe für alle aktiven Einheiten erzeugen</h2>
          <p>
            Erstellt in einem Schwung <strong>Jahresabrechnungs</strong>-Entwürfe für alle im Zeitraum aktiven
            Mietparteien. Einheiten mit bereits bestehender, überschneidender Rechnung werden übersprungen.
            Schlussrechnungen werden hier nicht erzeugt – sie entstehen einzeln beim Auszug/Mieterwechsel.
          </p>
          <BatchEntwuerfeForm />
        </div>
      )}
    </div>
  );
}
