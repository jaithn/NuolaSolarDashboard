"use client";

import { useEffect, useRef, useState } from "react";

export interface AnlegenItem {
  key: string;
  label: string;
  disabled?: boolean;
}

/**
 * Seitentitel (<h1>) mit einem +-Button oben rechts. Der Button trägt das
 * Nuola-Solar-Rahmenzeichen (abgerundetes Quadrat) – ohne Sonne, dafür mit einem
 * goldenen Plus – und öffnet ein Menü mit den Anlege-Optionen. Die Auswahl wird
 * über onSelect nach oben gereicht; das aufrufende Panel entscheidet, welches
 * Formular es darunter aufklappt. Erneute Auswahl derselben Option schließt das
 * offene Formular wieder.
 */
export function SeitentitelAnlegen({
  titel,
  items,
  offen,
  onSelect,
}: {
  titel: string;
  items: AnlegenItem[];
  offen: string | null;
  onSelect: (key: string | null) => void;
}) {
  const [menuOffen, setMenuOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Klick außerhalb bzw. Escape schließt das Menü (Tastatur-/Maus-Bedienung).
  useEffect(() => {
    if (!menuOffen) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOffen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOffen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOffen]);

  function waehle(key: string) {
    setMenuOffen(false);
    // Erneute Wahl der bereits offenen Option schließt das Formular.
    onSelect(offen === key ? null : key);
  }

  return (
    <div className="seitentitel">
      <h1 style={{ margin: 0 }}>{titel}</h1>
      <div className="anlegen-menu" ref={ref}>
        <button
          type="button"
          className="anlegen-plus"
          aria-haspopup="menu"
          aria-expanded={menuOffen}
          aria-label={`Neu anlegen – ${titel}`}
          onClick={() => setMenuOffen((o) => !o)}
        >
          <PlusZeichen />
        </button>
        {menuOffen && (
          <ul className="anlegen-liste" role="menu">
            {items.map((it) => (
              <li key={it.key} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="anlegen-eintrag"
                  disabled={it.disabled}
                  aria-current={offen === it.key || undefined}
                  onClick={() => waehle(it.key)}
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Nuola-Rahmen (abgerundetes Quadrat) mit goldenem Plus statt der Sonne. */
function PlusZeichen() {
  return <NuolaPlusIcon size={30} />;
}

/**
 * Wiederverwendbares Nuola-Plus-Icon (goldenes Plus im abgerundeten Rahmen).
 * Wird u. a. auch für die aufklappbaren +-Buttons in Tabellenzeilen genutzt.
 */
export function NuolaPlusIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="48" height="48" rx="12" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="32" y1="20" x2="32" y2="44" stroke="#D9A441" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="20" y1="32" x2="44" y2="32" stroke="#D9A441" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
