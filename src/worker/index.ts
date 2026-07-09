import cron from "node-cron";
import { pollAllDevices } from "./poll";

const intervalMinutes = Number(process.env.POLL_INTERVAL_MINUTES ?? "10");
if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 59) {
  throw new Error("POLL_INTERVAL_MINUTES muss zwischen 1 und 59 liegen.");
}
const cronExpression = `*/${intervalMinutes} * * * *`;

let cycleRunning = false;

async function runCycle(): Promise<void> {
  if (cycleRunning) {
    console.warn("[worker] Vorheriger Zyklus läuft noch, überspringe diesen Tick.");
    return;
  }
  cycleRunning = true;
  const startedAt = Date.now();
  try {
    await pollAllDevices();
  } catch (err) {
    console.error("[worker] Unerwarteter Fehler im Poll-Zyklus:", err);
  } finally {
    console.log(`[worker] Zyklus abgeschlossen in ${Date.now() - startedAt}ms.`);
    cycleRunning = false;
  }
}

console.log(`[worker] Starte Shelly-Polling-Worker (alle ${intervalMinutes} Minuten).`);

runCycle();
cron.schedule(cronExpression, runCycle);
