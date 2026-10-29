import { describe, it, expect, beforeEach } from "vitest";
import {
  checkCooldownRateLimit,
  resetCooldownsForTesting,
  setClientDailyUsageForTesting,
  DAILY_RPD_LIMIT,
} from "@/lib/rate-limit/cooldown";

describe("Server-Side Cooldown and Daily RPD Limiter", () => {
  beforeEach(() => {
    resetCooldownsForTesting();
  });

  it("permits initial request for a new client", () => {
    const result = checkCooldownRateLimit("client-123");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
    expect(result.dailyCount).toBe(1);
  });

  it("rejects second request within 4 seconds cooldown interval", () => {
    checkCooldownRateLimit("client-123");
    const rapidSecond = checkCooldownRateLimit("client-123");
    expect(rapidSecond.allowed).toBe(false);
    expect(rapidSecond.reason).toBe("cooldown");
    expect(rapidSecond.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("enforces daily request cap (500 RPD) even when cooldown has elapsed", () => {
    const clientId = "heavy-user-456";
    // Set daily count to limit (500) with cooldown in the past
    setClientDailyUsageForTesting(clientId, DAILY_RPD_LIMIT);

    const result = checkCooldownRateLimit(clientId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("daily_limit");
    expect(result.retryAfterSeconds).toBe(3600);
  });

  it("resets daily count when date changes", () => {
    const clientId = "yesterday-user-789";
    // Set usage to 500 for yesterday
    setClientDailyUsageForTesting(clientId, 500, "2025-01-01");

    const result = checkCooldownRateLimit(clientId);
    expect(result.allowed).toBe(true);
    expect(result.dailyCount).toBe(1);
  });

  it("tracks distinct client IPs independently", () => {
    const resA = checkCooldownRateLimit("ip-1");
    const resB = checkCooldownRateLimit("ip-2");
    expect(resA.allowed).toBe(true);
    expect(resB.allowed).toBe(true);
    expect(resA.dailyCount).toBe(1);
    expect(resB.dailyCount).toBe(1);
  });
});
