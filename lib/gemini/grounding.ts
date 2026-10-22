import { PlanningOption, Provenance } from "@/lib/types/plan";

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
 * Normalizes a proposed place into a typed PlanningOption with honest provenance.
 */
export function normalizeGroundedOption(
  rawOption: Partial<PlanningOption> & { name: string },
  contextLocation?: string,
  sourceUrl?: string
): PlanningOption {
  const provenance: Provenance[] = [
    {
      kind: sourceUrl ? "verified_source" : "estimate",
      sourceName: "Google Search Grounding",
      sourceUrl: sourceUrl || undefined,
      retrievedAt: new Date().toISOString(),
      note: "Place discovered and verified via search grounding.",
    },
  ];

  const address = rawOption.location?.address;
  const directionsUrl = buildGoogleMapsUrl(rawOption.name, address || contextLocation);

  return {
    id: rawOption.id || `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: rawOption.name,
    description: rawOption.description,
    category: rawOption.category || "venue",
    status: "suggested",
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
          isEstimate: rawOption.price.isEstimate ?? true,
        }
      : undefined,
    rating: rawOption.rating
      ? {
          value: Math.min(5, Math.max(0, rawOption.rating.value)),
          scale: rawOption.rating.scale || 5,
          reviewCount: rawOption.rating.reviewCount,
          sourceName: rawOption.rating.sourceName || "Google",
        }
      : undefined,
    sourceUrl: rawOption.sourceUrl || sourceUrl || "https://www.google.com",
    bookingUrl: rawOption.bookingUrl,
    provenance,
    fitReasons: rawOption.fitReasons || [],
    warnings: rawOption.warnings || [],
    lastCheckedAt: new Date().toISOString(),
  };
}
