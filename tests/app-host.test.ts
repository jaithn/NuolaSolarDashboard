import { describe, expect, it } from "vitest";
import { checkAppHost, normalizeHost } from "@/lib/appHost";

const DOMAIN = "https://mieterportal.nuola.de";

describe("normalizeHost", () => {
  it("entfernt den Port und normalisiert Kleinschreibung", () => {
    expect(normalizeHost("Mieterportal.Nuola.de:443")).toBe("mieterportal.nuola.de");
    expect(normalizeHost("192.168.178.83:80")).toBe("192.168.178.83");
  });
  it("lässt lokale Hosts und IPv6 unangetastet", () => {
    expect(normalizeHost("localhost")).toBe("localhost");
    expect(normalizeHost("[::1]:3000")).toBe("[::1]");
  });
});

describe("checkAppHost", () => {
  it("akzeptiert den Aufruf über den konfigurierten Host", () => {
    const r = checkAppHost({ appBaseUrl: DOMAIN, actualHost: "mieterportal.nuola.de", cookieInsecure: false });
    expect(r.ok).toBe(true);
  });

  it("ignoriert den Port beim Vergleich", () => {
    const r = checkAppHost({ appBaseUrl: DOMAIN, actualHost: "mieterportal.nuola.de:443", cookieInsecure: false });
    expect(r.ok).toBe(true);
  });

  it("meldet einen Fehler bei Aufruf über eine fremde Domain/IP", () => {
    const r = checkAppHost({ appBaseUrl: DOMAIN, actualHost: "192.168.178.83", cookieInsecure: false });
    expect(r.ok).toBe(false);
    expect(r.expectedHost).toBe("mieterportal.nuola.de");
    expect(r.actualHost).toBe("192.168.178.83");
  });

  it("erzwingt nichts im Testmodus (COOKIE_INSECURE)", () => {
    const r = checkAppHost({ appBaseUrl: DOMAIN, actualHost: "192.168.178.83", cookieInsecure: true });
    expect(r.ok).toBe(true);
  });

  it("erzwingt nichts, solange APP_BASE_URL der Platzhalter ist", () => {
    const r = checkAppHost({
      appBaseUrl: "https://mieterportal.example.com",
      actualHost: "192.168.178.83",
      cookieInsecure: false,
    });
    expect(r.ok).toBe(true);
  });

  it("erzwingt nichts ohne gesetzte APP_BASE_URL", () => {
    expect(checkAppHost({ appBaseUrl: undefined, actualHost: "192.168.178.83", cookieInsecure: false }).ok).toBe(true);
    expect(checkAppHost({ appBaseUrl: "", actualHost: "192.168.178.83", cookieInsecure: false }).ok).toBe(true);
  });

  it("blockiert keine lokalen/Health-Zugriffe", () => {
    expect(checkAppHost({ appBaseUrl: DOMAIN, actualHost: "localhost", cookieInsecure: false }).ok).toBe(true);
    expect(checkAppHost({ appBaseUrl: DOMAIN, actualHost: "127.0.0.1:3000", cookieInsecure: false }).ok).toBe(true);
  });

  it("erzwingt nichts bei ungültiger APP_BASE_URL", () => {
    const r = checkAppHost({ appBaseUrl: "kein-gueltiger-url-wert", actualHost: "192.168.178.83", cookieInsecure: false });
    expect(r.ok).toBe(true);
  });
});
