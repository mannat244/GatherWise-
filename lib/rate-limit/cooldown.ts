/**
 * Server-Side Cooldown & Rate Limiter for Gemini 3.5 Flash Lite Free Tier
 *
 * Enforces:
 * - 4-second minimum spacing between requests to ensure compliance with 15 RPM
 * - Clean HTTP 429 response with Retry-After header
 */

interface ClientCooldownEntry {
  lastRequestTime: number;
  dailyCount: number;
  dateStr: string;
}

const clientRequestMap = new Map<string, ClientCooldownEntry>();

// 15 requests per minute = 60,000ms / 15 = 4,000ms per request
export const COOLDOWN_INTERVAL_MS = 4000;
export const DAILY_RPD_LIMIT = 500;

function getUtcTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function checkCooldownRateLimit(clientId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingMs: number;
  reason?: "cooldown" | "daily_limit";
  dailyCount: number;
} {
  const now = Date.now();
  const today = getUtcTodayStr();
  const entry = clientRequestMap.get(clientId);

  if (!entry) {
    clientRequestMap.set(clientId, {
      lastRequestTime: now,
      dailyCount: 1,
      dateStr: today,
    });
    // Garbage collect stale entries if map grows
    if (clientRequestMap.size > 2000) {
      for (const [key, val] of clientRequestMap.entries()) {
        if (now - val.lastRequestTime > 86_400_000) {
          clientRequestMap.delete(key);
        }
      }
    }
    return { allowed: true, retryAfterSeconds: 0, remainingMs: 0, dailyCount: 1 };
  }

  // Handle daily rollover
  if (entry.dateStr !== today) {
    entry.dateStr = today;
    entry.dailyCount = 0;
  }

  // Enforce Daily Cap (500 RPD)
  if (entry.dailyCount >= DAILY_RPD_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: 3600,
      remainingMs: 3600000,
      reason: "daily_limit",
      dailyCount: entry.dailyCount,
    };
  }

  // Enforce 4s Cooldown (15 RPM)
  const elapsed = now - entry.lastRequestTime;
  if (elapsed < COOLDOWN_INTERVAL_MS) {
    const remainingMs = COOLDOWN_INTERVAL_MS - elapsed;
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
      remainingMs,
      reason: "cooldown",
      dailyCount: entry.dailyCount,
    };
  }

  // Permitted: Update to current time and increment daily counter
  entry.lastRequestTime = now;
  entry.dailyCount += 1;
  return { allowed: true, retryAfterSeconds: 0, remainingMs: 0, dailyCount: entry.dailyCount };
}

export function resetCooldownsForTesting(): void {
  clientRequestMap.clear();
}

export function setClientDailyUsageForTesting(
  clientId: string,
  count: number,
  dateStr?: string
): void {
  clientRequestMap.set(clientId, {
    lastRequestTime: Date.now() - 5000,
    dailyCount: count,
    dateStr: dateStr || getUtcTodayStr(),
  });
}
