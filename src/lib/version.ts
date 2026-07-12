// Anwendungsversion aus der package.json. Der Import wird beim Build inlined,
// sodass die Zahl auch im Standalone-/Docker-Build ohne package.json verfuegbar
// ist. Optionaler Commit-Hash aus der Build-Umgebung (falls gesetzt).
import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;

// Kurz-Commit-Hash, falls beim Build als Env-Variable mitgegeben (z.B. per
// Docker-Build-Arg NEXT_PUBLIC_GIT_SHA). Sonst leer.
export const APP_GIT_SHA: string = (process.env.NEXT_PUBLIC_GIT_SHA ?? "").slice(0, 7);
