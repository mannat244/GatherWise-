import { describe, it, expect, beforeEach } from "vitest";
import {
  getDailyUsage,
  incrementDailyUsage,
  resetDailyUsage,
  FREE_TIER_CONFIG,
  STORAGE_KEY_DAILY_USAGE,
  getTodayDateString,
} from "@/lib/storage/usage-limiter";

describe("Usage Limiter & Free Tier Tracking", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const localStorageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    (global as any).window = {
      localStorage: localStorageMock,
    };
    resetDailyUsage();
  });

  it("initializes with zero count and full quota for today", () => {
    const usage = getDailyUsage();
    expect(usage.count).toBe(0);
    expect(usage.limit).toBe(500);
    expect(usage.remaining).toBe(500);
    expect(usage.isLimitReached).toBe(false);
    expect(usage.date).toBe(getTodayDateString());
  });

  it("increments usage count correctly and tracks remaining quota", () => {
    const first = incrementDailyUsage();
    expect(first.count).toBe(1);
    expect(first.remaining).toBe(499);
    expect(first.isLimitReached).toBe(false);

    const second = incrementDailyUsage();
    expect(second.count).toBe(2);
    expect(second.remaining).toBe(498);
  });

  it("flags limit reached when count hits 500 RPD", () => {
    // Simulate reaching limit
    const today = getTodayDateString();
    window.localStorage.setItem(
      STORAGE_KEY_DAILY_USAGE,
      JSON.stringify({ date: today, count: 500 })
    );

    const usage = getDailyUsage();
    expect(usage.count).toBe(500);
    expect(usage.remaining).toBe(0);
    expect(usage.isLimitReached).toBe(true);

    const next = incrementDailyUsage();
    expect(next.count).toBe(501);
    expect(next.remaining).toBe(0);
    expect(next.isLimitReached).toBe(true);
  });

  it("automatically resets usage when date rolls over to a new day", () => {
    // Simulate stored data from yesterday
    window.localStorage.setItem(
      STORAGE_KEY_DAILY_USAGE,
      JSON.stringify({ date: "2026-10-21", count: 450 })
    );

    const usage = getDailyUsage();
    expect(usage.date).toBe(getTodayDateString());
    expect(usage.count).toBe(0);
    expect(usage.remaining).toBe(500);
    expect(usage.isLimitReached).toBe(false);
  });

  it("exposes the correct Free Tier configuration for Gemini 3.5 Flash Lite", () => {
    expect(FREE_TIER_CONFIG.model).toBe("gemini-3.5-flash-lite");
    expect(FREE_TIER_CONFIG.rpmLimit).toBe(15);
    expect(FREE_TIER_CONFIG.rpdLimit).toBe(500);
    expect(FREE_TIER_CONFIG.cooldownSeconds).toBe(4);
  });
});
