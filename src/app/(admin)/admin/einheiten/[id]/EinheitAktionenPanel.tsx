"use client";

import { useState, type ReactNode } from "react";
import { SeitentitelAnlegen } from "@/components/SeitentitelAnlegen";
import { PanelCloseContext } from "@/components/PanelClose";

/**
 * Titel + +-Menü der Einheit-Detailseite. Alle Bearbeitungen laufen über das
 * Menü (analog zur Mietpartei-Detailseite): „Einheit bearbeiten" und
 * „Neue Zähler-Zuordnung". Die konkreten Formulare werden von der RSC-Seite
 * konstruiert und als Elemente übergeben.
 */
export function EinheitAktionenPanel({
  titel,
  editForm,
  neueZuordnungForm,
  kannZuordnen,
}: {
  titel: string;
  editForm: ReactNode;
  neueZuordnungForm: ReactNode;
  kannZuordnen: boolean;
}) {
  const [offen, setOffen] = useState<string | null>(null);
  const schliessen = () => setOffen(null);

  const items = [
    { key: "edit", label: "Einheit bearbeiten" },
    { key: "zuordnung", label: "Neue Zähler-Zuordnung", disabled: !kannZuordnen },
  ];

  return (
    <div>
      <SeitentitelAnlegen titel={titel} items={items} offen={offen} onSelect={setOffen} />
      {offen && (
        <PanelCloseContext.Provider value={schliessen}>
          <div className="section">
            {offen === "edit" && (
              <>
                <h2 style={{ marginTop: 0 }}>Einheit bearbeiten</h2>
                {editForm}
              </>
            )}
            {offen === "zuordnung" && (
              <>
                <h2 style={{ marginTop: 0 }}>Neue Zähler-Zuordnung</h2>
                {neueZuordnungForm}
              </>
            )}
          </div>
        </PanelCloseContext.Provider>
      )}
    </div>
  );
}
