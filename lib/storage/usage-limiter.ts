/**
 * GatherWise Free Plan Usage & Rate Limiting Module
 *
 * Tracks daily usage against Google Gemini 3.5 Flash Lite Free Tier quotas:
 * - 15 RPM (Requests Per Minute) -> 4s cooldown between messages
 * - 500 RPD (Requests Per Day) -> Daily request cap with UTC midnight reset
 * - 250,000 TPM (Tokens Per Minute)
 */

export interface DailyUsageState {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
  limit: number;
  remaining: number;
  isLimitReached: boolean;
}

export const FREE_TIER_CONFIG = {
  model: "gemini-3.5-flash-lite",
  tierName: "Free Tier",
  rpmLimit: 15,
  rpdLimit: 500,
  tpmLimit: 250_000,
  cooldownSeconds: 4,
} as const;

export const STORAGE_KEY_DAILY_USAGE = "gatherwise_daily_usage";

export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Retrieves the current daily usage state from LocalStorage.
 * Automatically handles date roll-over at midnight UTC.
 */
export function getDailyUsage(): DailyUsageState {
  const today = getTodayDateString();

  if (typeof window === "undefined" || !window.localStorage) {
    return {
      date: today,
      count: 0,
      limit: FREE_TIER_CONFIG.rpdLimit,
      remaining: FREE_TIER_CONFIG.rpdLimit,
      isLimitReached: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_DAILY_USAGE);
    if (!raw) {
      return {
        date: today,
        count: 0,
        limit: FREE_TIER_CONFIG.rpdLimit,
        remaining: FREE_TIER_CONFIG.rpdLimit,
        isLimitReached: false,
      };
    }

    const parsed = JSON.parse(raw);
    if (parsed.date !== today) {
      // New day: reset usage counter
      const fresh: DailyUsageState = {
        date: today,
        count: 0,
        limit: FREE_TIER_CONFIG.rpdLimit,
        remaining: FREE_TIER_CONFIG.rpdLimit,
        isLimitReached: false,
      };
      window.localStorage.setItem(STORAGE_KEY_DAILY_USAGE, JSON.stringify(fresh));
      return fresh;
    }

    const count = typeof parsed.count === "number" ? parsed.count : 0;
    const remaining = Math.max(0, FREE_TIER_CONFIG.rpdLimit - count);
    return {
      date: today,
      count,
      limit: FREE_TIER_CONFIG.rpdLimit,
      remaining,
      isLimitReached: count >= FREE_TIER_CONFIG.rpdLimit,
    };
  } catch (e) {
    console.error("Failed to read daily usage from localStorage:", e);
    return {
      date: today,
      count: 0,
      limit: FREE_TIER_CONFIG.rpdLimit,
      remaining: FREE_TIER_CONFIG.rpdLimit,
      isLimitReached: false,
    };
  }
}

/**
 * Increments the daily request count by 1 and persists to LocalStorage.
 */
export function incrementDailyUsage(): DailyUsageState {
  const today = getTodayDateString();

  if (typeof window === "undefined" || !window.localStorage) {
    return {
      date: today,
      count: 1,
      limit: FREE_TIER_CONFIG.rpdLimit,
      remaining: FREE_TIER_CONFIG.rpdLimit - 1,
      isLimitReached: false,
    };
  }

  const current = getDailyUsage();
  const nextCount = current.count + 1;
  const remaining = Math.max(0, FREE_TIER_CONFIG.rpdLimit - nextCount);
  const updated: DailyUsageState = {
    date: today,
    count: nextCount,
    limit: FREE_TIER_CONFIG.rpdLimit,
    remaining,
    isLimitReached: nextCount >= FREE_TIER_CONFIG.rpdLimit,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY_DAILY_USAGE, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to persist daily usage:", e);
  }

  return updated;
}

/**
 * Resets daily usage to zero (useful for testing and debugging).
 */
export function resetDailyUsage(): void {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(STORAGE_KEY_DAILY_USAGE);
  }
}
