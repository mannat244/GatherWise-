/**
 * Server-Side Cooldown & Rate Limiter for Gemini 3.5 Flash Lite Free Tier
 *
 * Enforces:
 * - 4-second minimum spacing between requests to ensure compliance with 15 RPM
 * - Clean HTTP 429 response with Retry-After header
 */

interface ClientCooldownEntry {
  lastRequestTime: number;
}

const clientRequestMap = new Map<string, ClientCooldownEntry>();

// 15 requests per minute = 60,000ms / 15 = 4,000ms per request
export const COOLDOWN_INTERVAL_MS = 4000;

export function checkCooldownRateLimit(clientId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingMs: number;
} {
  const now = Date.now();
  const entry = clientRequestMap.get(clientId);

  if (!entry) {
    clientRequestMap.set(clientId, { lastRequestTime: now });
    // Garbage collect stale entries if map grows
    if (clientRequestMap.size > 2000) {
      for (const [key, val] of clientRequestMap.entries()) {
        if (now - val.lastRequestTime > 60_000) {
          clientRequestMap.delete(key);
        }
      }
    }
    return { allowed: true, retryAfterSeconds: 0, remainingMs: 0 };
  }

  const elapsed = now - entry.lastRequestTime;
  if (elapsed < COOLDOWN_INTERVAL_MS) {
    const remainingMs = COOLDOWN_INTERVAL_MS - elapsed;
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return { allowed: false, retryAfterSeconds, remainingMs };
  }

  // Permitted: Update to current time
  entry.lastRequestTime = now;
  return { allowed: true, retryAfterSeconds: 0, remainingMs: 0 };
}

export function resetCooldownsForTesting(): void {
  clientRequestMap.clear();
}
