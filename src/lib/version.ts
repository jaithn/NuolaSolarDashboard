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
