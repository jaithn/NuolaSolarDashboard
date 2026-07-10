import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllRateLimits, consumeRateLimit, resetRateLimit } from "@/lib/rateLimit";

describe("Rate-Limiter", () => {
  beforeEach(() => {
    clearAllRateLimits();
    vi.useRealTimers();
  });

  it("erlaubt Versuche bis zum Limit und blockiert danach", () => {
    for (let i = 0; i < 5; i++) {
      expect(consumeRateLimit("login:1.2.3.4:admin", 5, 60_000)).toBe(true);
    }
    expect(consumeRateLimit("login:1.2.3.4:admin", 5, 60_000)).toBe(false);
  });

  it("zaehlt Schluessel unabhaengig voneinander", () => {
    for (let i = 0; i < 5; i++) consumeRateLimit("login:1.2.3.4:a", 5, 60_000);
    expect(consumeRateLimit("login:1.2.3.4:a", 5, 60_000)).toBe(false);
    expect(consumeRateLimit("login:5.6.7.8:a", 5, 60_000)).toBe(true);
  });

  it("gibt Versuche nach Ablauf des Fensters wieder frei", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) consumeRateLimit("k", 3, 60_000);
    expect(consumeRateLimit("k", 3, 60_000)).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(consumeRateLimit("k", 3, 60_000)).toBe(true);
  });

  it("resetRateLimit setzt den Zaehler zurueck", () => {
    for (let i = 0; i < 3; i++) consumeRateLimit("k2", 3, 60_000);
    expect(consumeRateLimit("k2", 3, 60_000)).toBe(false);
    resetRateLimit("k2");
    expect(consumeRateLimit("k2", 3, 60_000)).toBe(true);
  });
});
