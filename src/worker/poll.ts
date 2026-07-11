import { prisma } from "@/lib/db";
import { fetchDeviceStatuses, type ShellyClientConfig, type ShellyDeviceRef, type DeviceStatusResult } from "@/lib/shelly/client";
import { sendMail } from "@/lib/mail/mailer";
import { shellyFehlerEmailHtml, type ShellyFehlerZeile } from "@/lib/mail/templates";

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

// Drosselung der Fehler-Mails: bei anhaltenden Fehlern hoechstens alle 6h eine
// E-Mail (in-memory; ein Worker-Neustart setzt das zurueck).
const FEHLER_MAIL_INTERVALL_MS = 6 * 60 * 60 * 1000;
let letzteFehlerMailAt = 0;

async function benachrichtigeUeberFehler(zeilen: ShellyFehlerZeile[]): Promise<void> {
  if (zeilen.length === 0) return;
  if (Date.now() - letzteFehlerMailAt < FEHLER_MAIL_INTERVALL_MS) return;

  const firma = await prisma.firmenStammdaten.findUnique({ where: { id: "singleton" } });
  const to = firma?.shellyFehlerEmail?.trim();
  if (!to) return;

  try {
    await sendMail({
      to,
      subject: `Shelly-Abruf: ${zeilen.length} Gerät(e) mit Problemen`,
      html: shellyFehlerEmailHtml(zeilen),
    });
    letzteFehlerMailAt = Date.now();
  } catch (err) {
    console.error("[worker] Fehler-Benachrichtigung konnte nicht versendet werden:", err);
  }
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

  const geraete = await prisma.shellyGeraet.findMany({
    where: { aktiv: true },
    include: { objekt: true, zuordnungen: { include: { einheit: true } } },
  });
  if (geraete.length === 0) {
    console.log("[worker] Keine aktiven Shelly-Geräte konfiguriert, überspringe Zyklus.");
    return;
  }

  const refs: ShellyDeviceRef[] = geraete.map((g) => ({ deviceId: g.deviceId, server: g.serverHost }));
  const results = await fetchDeviceStatuses(refs, config);

  const fehler: ShellyFehlerZeile[] = [];
  const fehlerZeile = (geraet: (typeof geraete)[number], grund: string): ShellyFehlerZeile => ({
    geraet: geraet.bezeichnung,
    deviceId: geraet.deviceId,
    objekt: geraet.objekt.name,
    einheiten: geraet.zuordnungen.map((z) => z.einheit.bezeichnung).join(", "),
    grund,
  });

  for (let i = 0; i < geraete.length; i++) {
    const geraet = geraete[i]!;
    const result: PromiseSettledResult<DeviceStatusResult> = results[i]!;

    if (result.status === "rejected") {
      const grund = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[worker] Fehler beim Abruf von Gerät "${geraet.bezeichnung}" (${geraet.deviceId}):`, grund);
      fehler.push(fehlerZeile(geraet, `Abruf fehlgeschlagen: ${grund}`));
      continue;
    }

    const { online, readings, fetchedAt } = result.value;
    if (!online) {
      console.warn(`[worker] Gerät "${geraet.bezeichnung}" (${geraet.deviceId}) ist offline.`);
      fehler.push(fehlerZeile(geraet, "Gerät offline"));
      continue;
    }
    if (readings.length === 0) {
      console.warn(
        `[worker] Gerät "${geraet.bezeichnung}" (${geraet.deviceId}) lieferte keine erkennbaren Energiezähler.`,
      );
      fehler.push(fehlerZeile(geraet, "Keine erkennbaren Energiezähler in der Antwort"));
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

  await benachrichtigeUeberFehler(fehler);
}
