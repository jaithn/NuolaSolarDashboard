"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

function readCookieTheme(): Theme {
  const m = document.cookie.match(/(?:^|;\s*)theme=(light|dark)/);
  return (m?.[1] as Theme) ?? "system";
}

/**
 * Umschalter Hell/Dunkel/System. Speichert die Wahl in einem Cookie (vom
 * Root-Layout serverseitig gelesen, um data-theme flackerfrei zu setzen) und
 * aktualisiert data-theme am <html> sofort. "System" folgt der Betriebssystem-
 * Einstellung (prefers-color-scheme) und löscht das Cookie.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(readCookieTheme()), []);

  function apply(t: Theme) {
    setTheme(t);
    const root = document.documentElement;
    if (t === "system") {
      document.cookie = "theme=; path=/; max-age=0; samesite=lax";
      root.removeAttribute("data-theme");
    } else {
      document.cookie = `theme=${t}; path=/; max-age=31536000; samesite=lax`;
      root.setAttribute("data-theme", t);
    }
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Design auswählen">
      {(["light", "dark", "system"] as const).map((t) => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => apply(t)}>
          {t === "light" ? "Hell" : t === "dark" ? "Dunkel" : "System"}
        </button>
      ))}
    </div>
  );
}
