"use client";

import { useState, type ReactNode } from "react";
import { SeitentitelAnlegen } from "@/components/SeitentitelAnlegen";
import { PanelCloseContext } from "@/components/PanelClose";

/**
 * Titel + +-Menü der Objekt-Detailseite. Alle Bearbeitungen laufen über das
 * Menü (analog zur Mietpartei-Detailseite): „Objekt bearbeiten" und
 * „Neue Einheit". Die konkreten Formulare werden von der RSC-Seite konstruiert
 * und als Elemente übergeben; der Schließen-Callback kommt per PanelCloseContext.
 */
export function ObjektAktionenPanel({
  titel,
  editForm,
  neueEinheitForm,
}: {
  titel: string;
  editForm: ReactNode;
  neueEinheitForm: ReactNode;
}) {
  const [offen, setOffen] = useState<string | null>(null);
  const schliessen = () => setOffen(null);

  const items = [
    { key: "edit", label: "Objekt bearbeiten" },
    { key: "einheit", label: "Neue Einheit" },
  ];

  return (
    <div>
      <SeitentitelAnlegen titel={titel} items={items} offen={offen} onSelect={setOffen} />
      {offen && (
        <PanelCloseContext.Provider value={schliessen}>
          <div className="section">
            {offen === "edit" && (
              <>
                <h2 style={{ marginTop: 0 }}>Objekt bearbeiten</h2>
                {editForm}
              </>
            )}
            {offen === "einheit" && (
              <>
                <h2 style={{ marginTop: 0 }}>Neue Einheit</h2>
                {neueEinheitForm}
              </>
            )}
          </div>
        </PanelCloseContext.Provider>
      )}
    </div>
  );
}
