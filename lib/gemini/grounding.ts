import { PlanningOption, Provenance, ProposedOption, EventPlan } from "@/lib/types/plan";

export interface GroundingSource {
  title: string;
  url: string;
  domain?: string;
}

export interface GroundingExtraction {
  isGrounded: boolean;
  searchQueries: string[];
  sources: GroundingSource[];
}

/**
 * Extracts grounding metadata and verifiable web citations from a Gemini response.
 */
export function extractGroundingMetadata(response: any): GroundingExtraction {
  const candidate = response?.candidates?.[0];
  const metadata = candidate?.groundingMetadata;

  const searchQueries: string[] = metadata?.webSearchQueries || [];
  const sources: GroundingSource[] = [];

  if (metadata?.groundingChunks && Array.isArray(metadata.groundingChunks)) {
    for (const chunk of metadata.groundingChunks) {
      if (chunk?.web?.uri) {
        sources.push({
          title: chunk.web.title || "Web Source",
          url: chunk.web.uri,
          domain: chunk.web.domain,
        });
      }
    }
  }

  return {
    isGrounded: sources.length > 0 || searchQueries.length > 0,
    searchQueries,
    sources,
  };
}

/**
 * Generates an authoritative, verifiable Google Maps directions URL for a place name and location.
 */
export function buildGoogleMapsUrl(placeName: string, location?: string): string {
  const query = `${placeName.trim()} ${location ? location.trim() : ""}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Matches an individual option against candidate grounding sources.
 * Looks for URL matches, or presence of option name keywords in source title / URL.
 */
export function findMatchingGroundingSource(
  optionName: string,
  optionSourceUrl: string | undefined,
  sources: GroundingSource[]
): GroundingSource | undefined {
  if (!sources || sources.length === 0) return undefined;

  // 1. Direct URL or domain match
  if (optionSourceUrl) {
    const directMatch = sources.find(
      (s) => s.url === optionSourceUrl || (s.domain && optionSourceUrl.includes(s.domain))
    );
    if (directMatch) return directMatch;
  }

  // 2. Name token match in source title or URL (excluding generic stop words)
  const STOP_WORDS = new Set([
    "the", "and", "for", "with", "cafe", "coffee", "restaurant", "arena", "bowling",
    "gaming", "games", "bangalore", "bengaluru", "india", "place", "food", "bar",
    "hotel", "center", "centre", "mall", "shuttle", "bus", "metro", "cab"
  ]);

  const cleanName = optionName.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const nameTokens = cleanName.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  if (nameTokens.length === 0) return undefined;

  return sources.find((s) => {
    const titleLower = s.title.toLowerCase();
    const urlLower = s.url.toLowerCase();
    return nameTokens.some((token) => titleLower.includes(token) || urlLower.includes(token));
  });
}

/**
 * Normalizes a proposed place into a typed PlanningOption with honest provenance.
 */
export function normalizeGroundedOption(
  rawOption: (Partial<PlanningOption> | ProposedOption) & { name: string },
  contextLocation?: string,
  sourceOrUrl?: string | GroundingSource
): PlanningOption {
  // 1. If rawOption is already a normalized PlanningOption with provenance, preserve it completely!
  if ("provenance" in rawOption && Array.isArray((rawOption as any).provenance) && (rawOption as any).provenance.length > 0) {
    const existing = rawOption as PlanningOption;
    return {
      ...existing,
      location: {
        ...existing.location,
        directionsUrl: existing.location?.directionsUrl || buildGoogleMapsUrl(existing.name, existing.location?.address || contextLocation),
      },
      price: existing.price ? { ...existing.price, isEstimate: true } : undefined,
    };
  }

  const matchedSource = typeof sourceOrUrl === "object" ? sourceOrUrl : undefined;

  // An option is strictly verified ONLY if backed by an authoritative matched GroundingSource
  // Never mark an option as verified just because it has an arbitrary URL string!
  const isVerified = Boolean(matchedSource && matchedSource.url);
  const finalSourceUrl = matchedSource?.url || (typeof sourceOrUrl === "string" ? sourceOrUrl : rawOption.sourceUrl) || "https://www.google.com";
  const sourceName = matchedSource?.title || (isVerified ? "Google Search Grounding" : "AI Estimate");

  const provenance: Provenance[] = [
    {
      kind: isVerified ? "verified_source" : "estimate",
      sourceName,
      sourceUrl: isVerified ? finalSourceUrl : undefined,
      retrievedAt: new Date().toISOString(),
      note: isVerified
        ? `Option discovered and verified via search source: ${sourceName}`
        : "Estimated option proposed by assistant; live verification pending.",
    },
  ];

  const address = rawOption.location?.address;
  const directionsUrl = buildGoogleMapsUrl(rawOption.name, address || contextLocation);

  return {
    id: rawOption.id || `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: rawOption.name,
    description: rawOption.description,
    category: rawOption.category || "venue",
    status: ("status" in rawOption && rawOption.status) ? rawOption.status : "suggested",
    imageUrl: rawOption.imageUrl,
    location: {
      address,
      latitude: rawOption.location?.latitude,
      longitude: rawOption.location?.longitude,
      directionsUrl,
    },
    price: rawOption.price
      ? {
          amount: rawOption.price.amount,
          currency: rawOption.price.currency || "INR",
          unit: rawOption.price.unit,
          basis: rawOption.price.basis || "per_event",
          isEstimate: true, // Unsupported prices must remain explicitly unverified estimates
        }
      : undefined,
    rating:
      rawOption.rating && rawOption.rating.value !== undefined
        ? {
            value: Math.min(5, Math.max(0, rawOption.rating.value)),
            scale: rawOption.rating.scale || 5,
            reviewCount: rawOption.rating.reviewCount,
            sourceName: isVerified ? (matchedSource?.title || "Google Maps") : (rawOption.rating.sourceName || "AI Estimate (Unverified)"),
          }
        : undefined,
    sourceUrl: finalSourceUrl,
    bookingUrl: rawOption.bookingUrl,
    provenance,
    fitReasons: rawOption.fitReasons || [],
    warnings: rawOption.warnings || [],
    lastCheckedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic Server-Side Tool Gating:
 * Only enables Google Search Grounding when real-world external discovery is requested.
 * Prevents wasting search tokens & quota on local constraint edits or budget inquiries.
 */
export function shouldTriggerSearchGrounding(userMessage: string, currentPlan: EventPlan): boolean {
  const lower = userMessage.toLowerCase().trim();

  // Pure conversational greetings or meta-questions without event context should NOT trigger search
  if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|who\s*are\s*you|what\s*can\s*you\s*do)[\s!.,?]*$/i.test(lower)) {
    return false;
  }

  // Internal inquiries: NEVER call Google Search
  if (
    (lower.includes("wheelchair") && (lower.includes("dont") || lower.includes("don't") || lower.includes("no") || lower.includes("remove") || lower.includes("who said"))) ||
    (lower.includes("dietary") && (lower.includes("remove") || lower.includes("no"))) ||
    (lower.includes("cost") && !lower.includes("options")) ||
    (lower.includes("what was our") || lower.includes("what is our")) ||
    (lower.includes("budget") && (lower.includes("remaining") || lower.includes("total") || lower.includes("spent"))) ||
    lower.includes("did you forget") ||
    lower.includes("did u forget") ||
    lower.includes("update the plan") ||
    lower.includes("view hub")
  ) {
    return false;
  }

  // Discovery keywords where search grounding is genuinely needed
  const discoveryKeywords = [
    "venue", "cafe", "restaurant", "place", "spot", "dinner", "lunch", "food",
    "burger", "pizza", "fast food", "bowling", "arcade", "mall", "travel", "cab",
    "uber", "ola", "bus", "metro", "auto", "cake", "bakery", "options", "suggest",
    "find", "recommend", "where can", "look for"
  ];

  const hasDiscovery = discoveryKeywords.some((kw) => lower.includes(kw));
  const hasNoOptionsYet = currentPlan.tasks.length === 0 || !currentPlan.tasks.some((t) => t.options.length > 0);

  return hasDiscovery || hasNoOptionsYet;
}

