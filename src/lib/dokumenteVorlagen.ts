// Reine Parser-Helfer fuer die editierbaren Texte aus dem "Dokumente"-Ordner
// (Front-Matter der Vertraege, benannte Abschnitte der Briefe, Platzhalter).
// Bewusst ohne DB/IO, damit sie unabhaengig testbar sind.

/** Zerlegt eine Markdown-Datei mit YAML-Front-Matter in Metadaten + Rumpf. */
export function parseFrontMatter(md: string): { meta: Record<string, string>; body: string } {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: md.trim() };
  const meta: Record<string, string> = {};
  for (const line of (m[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) meta[key] = val;
  }
  return { meta, body: (m[2] ?? "").trim() };
}

/**
 * Zerlegt einen Brieftext in benannte Abschnitte anhand der `## schluessel`-
 * Ueberschriften. Inhalt vor der ersten `##`-Ueberschrift (Titel/Beschreibung)
 * wird ignoriert.
 */
export function parseAbschnitte(md: string): Map<string, string> {
  const map = new Map<string, string>();
  const parts = md.split(/^##[ \t]+/m);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    if (block === undefined) continue;
    const nl = block.indexOf("\n");
    const key = (nl === -1 ? block : block.slice(0, nl)).trim();
    const text = (nl === -1 ? "" : block.slice(nl + 1)).trim();
    if (key) map.set(key, text);
  }
  return map;
}

/** Ersetzt Platzhalter der Form {name} durch die Werte aus vars (fehlend -> leer). */
export function ersetzePlatzhalter(text: string, vars: Record<string, string> = {}): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/**
 * Text eines Abschnitts (mit Platzhalter-Ersetzung). Fehlt der Abschnitt in der
 * Vorlage, greift der uebergebene Standardtext.
 */
export function abschnitt(
  map: Map<string, string>,
  schluessel: string,
  standard: string,
  vars: Record<string, string> = {},
): string {
  const roh = map.get(schluessel);
  return ersetzePlatzhalter(roh != null && roh !== "" ? roh : standard, vars);
}

/**
 * Aufzaehlungspunkte eines Abschnitts (Zeilen mit fuehrendem "- "). Fehlt der
 * Abschnitt, greift die Standard-Liste.
 */
export function abschnittZeilen(
  map: Map<string, string>,
  schluessel: string,
  standard: string[],
  vars: Record<string, string> = {},
): string[] {
  const roh = map.get(schluessel);
  if (roh == null || roh === "") return standard.map((z) => ersetzePlatzhalter(z, vars));
  const zeilen = roh
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => z.startsWith("- "))
    .map((z) => ersetzePlatzhalter(z.slice(2).trim(), vars));
  return zeilen.length > 0 ? zeilen : standard.map((z) => ersetzePlatzhalter(z, vars));
}
