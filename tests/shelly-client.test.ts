import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchDeviceStatus, fetchDeviceStatuses, normalizeDeviceStatus, ShellyApiError } from "@/lib/shelly/client";

const config = { authKey: "test-key" };
const server = "shelly-test.shelly.cloud";
const deviceRef = (deviceId: string) => ({ deviceId, server });

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("normalizeDeviceStatus", () => {
  it("liest Triphase-Profil (emdata:0) korrekt aus", () => {
    const readings = normalizeDeviceStatus({
      "em:0": { a_act_power: 120, b_act_power: 80, c_act_power: 60 },
      "emdata:0": {
        a_total_act_energy: 1000,
        b_total_act_energy: 2000,
        c_total_act_energy: 500,
      },
    });
    expect(readings).toEqual([
      { phase: "a", energyWh: 1000 },
      { phase: "b", energyWh: 2000 },
      { phase: "c", energyWh: 500 },
    ]);
  });

  it("liest Monophase-Profil (em1data:0..2) korrekt aus", () => {
    const readings = normalizeDeviceStatus({
      "em1data:0": { total_act_energy: 300 },
      "em1data:1": { total_act_energy: 450 },
      "em1data:2": { total_act_energy: 100 },
    });
    expect(readings).toEqual([
      { phase: "0", energyWh: 300 },
      { phase: "1", energyWh: 450 },
      { phase: "2", energyWh: 100 },
    ]);
  });

  it("ignoriert unbekannte Komponenten-Keys", () => {
    const readings = normalizeDeviceStatus({ sys: { uptime: 123 }, wifi: { connected: true } });
    expect(readings).toEqual([]);
  });
});

describe("fetchDeviceStatus", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gibt normalisierte Messwerte für ein Online-Gerät zurück", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        isok: true,
        data: {
          online: true,
          device_status: {
            "emdata:0": { a_total_act_energy: 10, b_total_act_energy: 20, c_total_act_energy: 30 },
          },
        },
      }),
    );

    const result = await fetchDeviceStatus(deviceRef("device-1"), config);
    expect(result.online).toBe(true);
    expect(result.readings).toEqual([
      { phase: "a", energyWh: 10 },
      { phase: "b", energyWh: 20 },
      { phase: "c", energyWh: 30 },
    ]);
  });

  it("liefert online=false mit leeren Messwerten für offline Geräte, statt zu werfen", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ isok: true, data: { online: false } }),
    );

    const result = await fetchDeviceStatus(deviceRef("device-2"), config);
    expect(result.online).toBe(false);
    expect(result.readings).toEqual([]);
  });

  it("wirft ShellyApiError bei HTTP-Fehlerstatus", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, false, 500));
    await expect(fetchDeviceStatus(deviceRef("device-3"), config)).rejects.toBeInstanceOf(ShellyApiError);
  });

  it("wirft ShellyApiError bei Netzwerkfehler (fetch rejects)", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    await expect(fetchDeviceStatus(deviceRef("device-4"), config)).rejects.toBeInstanceOf(ShellyApiError);
  });

  it("wirft ShellyApiError bei isok=false", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ isok: false, errors: { auth: "invalid" } }));
    await expect(fetchDeviceStatus(deviceRef("device-5"), config)).rejects.toBeInstanceOf(ShellyApiError);
  });
});

describe("fetchDeviceStatuses", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isoliert Fehler einzelner Geräte, ohne den gesamten Batch abzubrechen", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          isok: true,
          data: { online: true, device_status: { "emdata:0": { a_total_act_energy: 5 } } },
        }),
      )
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(jsonResponse({ isok: true, data: { online: false } }));

    const results = await fetchDeviceStatuses([deviceRef("d1"), deviceRef("d2"), deviceRef("d3")], config);

    expect(results[0]!.status).toBe("fulfilled");
    expect(results[1]!.status).toBe("rejected");
    expect(results[2]!.status).toBe("fulfilled");
    if (results[2]!.status === "fulfilled") {
      expect(results[2]!.value.online).toBe(false);
    }
  });
});
