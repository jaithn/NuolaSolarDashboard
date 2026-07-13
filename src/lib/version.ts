// Anwendungsversion. Quelle ist die von GitHub abgeleitete Version, die beim
// Build in NEXT_PUBLIC_APP_VERSION gesetzt wird (siehe next.config.mjs):
//   - CI (GitHub Actions): exakt die veroeffentlichte Version des Docker-Images
//     ("1.0.<lauf-nr>" bei main-Push bzw. "X.Y.Z" bei einem vX.Y.Z-Release-Tag),
//     per Build-Arg an den Docker-Build uebergeben.
//   - Lokal: aus `git describe --tags --always` abgeleitet (z.B. "v1.0.0" oder
//     "v1.0.0-3-g9b654e3"), sonst als Fallback die package.json-Version.
// So entspricht die im Admin angezeigte Version den GitHub-/Release-Versionen.
import pkg from "../../package.json";

export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || pkg.version;

// Kurz-Commit-Hash, falls beim Build als Env-Variable mitgegeben (z.B. per
// Docker-Build-Arg GIT_SHA -> NEXT_PUBLIC_GIT_SHA). Sonst leer.
export const APP_GIT_SHA: string = (process.env.NEXT_PUBLIC_GIT_SHA ?? "").slice(0, 7);

// Voller Commit-Hash (fuer den Commit-Link auf GitHub), sonst leer.
export const APP_GIT_SHA_FULL: string = process.env.NEXT_PUBLIC_GIT_SHA ?? "";

// Build-/Image-Datum (ISO-String), beim CI-Build als Docker-Build-Arg
// BUILD_DATE -> NEXT_PUBLIC_BUILD_DATE gesetzt. Lokal leer.
export const APP_BUILD_DATE: string = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";

// GitHub-Repository dieses Projekts (fuer Links zu Image/Commit im Admin).
export const REPO_URL = "https://github.com/jaithn/NuolaSolarDashboard";
// GHCR-Paketseite (Container-Images/Versionen) auf GitHub.
export const GHCR_PACKAGE_URL = `${REPO_URL}/pkgs/container/nuolasolardashboard`;

/** GitHub-Link zum Commit dieser Version (leer, wenn kein SHA bekannt). */
export function commitUrl(): string {
  return APP_GIT_SHA_FULL ? `${REPO_URL}/commit/${APP_GIT_SHA_FULL}` : "";
}

/** Build-/Image-Datum als DD.MM.YYYY (leer, wenn unbekannt oder ungueltig). */
export function buildDatumFormatiert(): string {
  if (!APP_BUILD_DATE) return "";
  const d = new Date(APP_BUILD_DATE);
  if (Number.isNaN(d.getTime())) return "";
  const tag = String(d.getUTCDate()).padStart(2, "0");
  const monat = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${tag}.${monat}.${d.getUTCFullYear()}`;
}
