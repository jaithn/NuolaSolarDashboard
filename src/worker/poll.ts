import { prisma } from "@/lib/db";
import { fetchDeviceStatuses, type ShellyClientConfig, type ShellyDeviceRef, type DeviceStatusResult } from "@/lib/shelly/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt.`);
  }
  return value;
}

export function getShellyConfigFromEnv(): ShellyClientConfig {
  return { authKey: requireEnv("SHELLY_CLOUD_AUTH_KEY") };
}

/**
 * Ein Poll-Zyklus: alle aktiven Shelly-Geraete abfragen und die aktuellen
 * (kumulativen) Energiezaehlerstaende je Phase als Messwert persistieren.
 * Jede ShellyGeraet-Zeile entspricht genau einem physischen Geraet (die
 * Zuordnung zu Einheiten inkl. Kanal-Auswahl und Addieren/Subtrahieren
 * erfolgt erst bei der Verbrauchsberechnung ueber GeraetZuordnung) - daher
 * wird hier grundsaetzlich der volle Satz aller vom Geraet gelieferten
 * Phasen gespeichert. Fehler pro Geraet werden geloggt, brechen den Zyklus
 * aber nicht ab.
 */
export async function pollAllDevices(): Promise<void> {
  const config = getShellyConfigFromEnv();

  const geraete = await prisma.shellyGeraet.findMany({ where: { aktiv: true } });
  if (geraete.length === 0) {
    console.log("[worker] Keine aktiven Shelly-Geräte konfiguriert, überspringe Zyklus.");
    return;
  }

  const refs: ShellyDeviceRef[] = geraete.map((g) => ({ deviceId: g.deviceId, server: g.serverHost }));
  const results = await fetchDeviceStatuses(refs, config);

  for (let i = 0; i < geraete.length; i++) {
    const geraet = geraete[i]!;
    const result: PromiseSettledResult<DeviceStatusResult> = results[i]!;

    if (result.status === "rejected") {
      console.error(
        `[worker] Fehler beim Abruf von Gerät "${geraet.bezeichnung}" (${geraet.deviceId}):`,
        result.reason,
      );
      continue;
    }

    const { online, readings, fetchedAt } = result.value;
    if (!online) {
      console.warn(`[worker] Gerät "${geraet.bezeichnung}" (${geraet.deviceId}) ist offline.`);
      continue;
    }
    if (readings.length === 0) {
      console.warn(
        `[worker] Gerät "${geraet.bezeichnung}" (${geraet.deviceId}) lieferte keine erkennbaren Energiezähler.`,
      );
      continue;
    }

    for (const reading of readings) {
      try {
        await prisma.messwert.upsert({
          where: {
            geraetId_phase_timestamp: {
              geraetId: geraet.id,
              phase: reading.phase,
              timestamp: fetchedAt,
            },
          },
          update: { energyWh: reading.energyWh },
          create: {
            geraetId: geraet.id,
            phase: reading.phase,
            timestamp: fetchedAt,
            energyWh: reading.energyWh,
          },
        });
      } catch (err) {
        console.error(
          `[worker] Fehler beim Speichern des Messwerts (Gerät ${geraet.id}, Phase ${reading.phase}):`,
          err,
        );
      }
    }
  }
}
