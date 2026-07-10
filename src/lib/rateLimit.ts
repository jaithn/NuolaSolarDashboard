// Einfacher In-Memory-Rate-Limiter (Sliding Window). Bewusst ohne externe
// Abhaengigkeit (z.B. Redis): die App laeuft als einzelner Node-Prozess in
// einem Container, ein prozesslokaler Speicher genuegt daher. Bei einem
// Neustart beginnen die Zaehler bei 0 - fuer Brute-Force-Schutz akzeptabel.

const buckets = new Map<string, number[]>();

const MAX_BUCKETS = 10_000;
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS && buckets.size < MAX_BUCKETS) return;
  lastSweep = now;
  for (const [key, timestamps] of buckets) {
    const alive = timestamps.filter((t) => now - t < windowMs);
    if (alive.length === 0) buckets.delete(key);
    else buckets.set(key, alive);
  }
}

/**
 * Registriert einen Versuch fuer `key` und liefert false, wenn im Fenster
 * `windowMs` bereits `maxAttempts` Versuche registriert wurden.
 */
export function consumeRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now, windowMs);
  const attempts = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (attempts.length >= maxAttempts) {
    buckets.set(key, attempts);
    return false;
  }
  attempts.push(now);
  buckets.set(key, attempts);
  return true;
}

/** Setzt den Zaehler fuer einen Schluessel zurueck (z.B. nach erfolgreichem Login). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Nur fuer Tests. */
export function clearAllRateLimits(): void {
  buckets.clear();
}
