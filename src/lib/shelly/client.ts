// Shelly Cloud API Client
//
// Der Anwendungsserver steht nicht im selben Netz wie die Shelly-Geraete, daher
// erfolgt der Zugriff ausschliesslich ueber die Shelly Cloud API (nicht per
// lokalem RPC/WebSocket). Verwendet wird der klassische, gut dokumentierte
// `/device/status`-Endpoint (GET, id + auth_key als Query-Parameter), da die
// oeffentliche Dokumentation zur neueren gebuendelten v2-API
// (`/v2/devices/api/get`) das genaue Body-/Response-Format nicht verlaesslich
// spezifiziert. `/device/status` liefert fuer Gen2/3-Geraete (Shelly Pro 3EM)
// den vollstaendigen RPC-Komponenten-Snapshot, inkl. der Energiezaehler-
// Komponenten "emdata:0" (Triphase-Profil, ein Zaehler fuer alle 3 Phasen) bzw.
// "em1data:0..2" (Monophase-Profil, ein Zaehler je Kanal).
//
// Rate-Limit: die Shelly Cloud API drosselt auf 1 Request/Sekunde - wir
// serialisieren daher alle Aufrufe und halten mindestens 1100ms Abstand.

const MIN_REQUEST_INTERVAL_MS = 1100;

export interface ShellyClientConfig {
  authKey: string;
}

export interface ShellyDeviceRef {
  deviceId: string;
  server: string;
}

export interface NormalizedReading {
  phase: string;
  energyWh: number;
}

export interface DeviceStatusResult {
  deviceId: string;
  online: boolean;
  readings: NormalizedReading[];
  fetchedAt: Date;
}

interface ShellyStatusResponse {
  isok: boolean;
  data?: {
    online: boolean;
    device_status?: Record<string, unknown>;
  };
  errors?: Record<string, unknown>;
}

export class ShellyApiError extends Error {
  readonly deviceId: string;
  readonly cause?: unknown;

  constructor(message: string, deviceId: string, cause?: unknown) {
    super(message);
    this.name = "ShellyApiError";
    this.deviceId = deviceId;
    this.cause = cause;
  }
}

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - now;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

/**
 * Extrahiert normalisierte {phase, energyWh}-Messwerte aus einem rohen
 * Shelly device_status-Objekt, unabhaengig davon ob das Geraet im Triphase-
 * oder Monophase-Profil betrieben wird.
 */
export function normalizeDeviceStatus(deviceStatus: Record<string, unknown>): NormalizedReading[] {
  const readings: NormalizedReading[] = [];

  for (const [key, value] of Object.entries(deviceStatus)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;

    if (key.startsWith("emdata:")) {
      for (const [phase, field] of [
        ["a", "a_total_act_energy"],
        ["b", "b_total_act_energy"],
        ["c", "c_total_act_energy"],
      ] as const) {
        const wh = v[field];
        if (typeof wh === "number") readings.push({ phase, energyWh: wh });
      }
    } else if (key.startsWith("em1data:")) {
      const channel = key.split(":")[1] ?? "0";
      const wh = v.total_act_energy ?? v.act_energy;
      if (typeof wh === "number") readings.push({ phase: channel, energyWh: wh });
    }
  }

  return readings;
}

export async function fetchDeviceStatus(
  device: ShellyDeviceRef,
  config: ShellyClientConfig,
): Promise<DeviceStatusResult> {
  await throttle();

  const url = `https://${device.server}/device/status?id=${encodeURIComponent(device.deviceId)}&auth_key=${encodeURIComponent(config.authKey)}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (err) {
    throw new ShellyApiError(`Netzwerkfehler beim Abruf von Gerät ${device.deviceId}`, device.deviceId, err);
  }

  if (!res.ok) {
    throw new ShellyApiError(
      `Shelly Cloud API antwortete mit Status ${res.status} für Gerät ${device.deviceId}`,
      device.deviceId,
    );
  }

  const body = (await res.json()) as ShellyStatusResponse;
  if (!body.isok || !body.data) {
    throw new ShellyApiError(`Ungültige Antwort der Shelly Cloud API für Gerät ${device.deviceId}`, device.deviceId);
  }

  const online = Boolean(body.data.online);
  const readings = online && body.data.device_status ? normalizeDeviceStatus(body.data.device_status) : [];

  return { deviceId: device.deviceId, online, readings, fetchedAt: new Date() };
}

/**
 * Ruft den Status mehrerer physischer Geraete nacheinander ab (Rate-Limit-
 * konform) und isoliert Fehler pro Geraet, damit ein einzelnes offline/
 * fehlerhaftes Geraet den restlichen Poll-Zyklus nicht abbricht.
 */
export async function fetchDeviceStatuses(
  devices: ShellyDeviceRef[],
  config: ShellyClientConfig,
): Promise<PromiseSettledResult<DeviceStatusResult>[]> {
  const results: PromiseSettledResult<DeviceStatusResult>[] = [];
  for (const device of devices) {
    try {
      const value = await fetchDeviceStatus(device, config);
      results.push({ status: "fulfilled", value });
    } catch (reason) {
      results.push({ status: "rejected", reason });
    }
  }
  return results;
}
