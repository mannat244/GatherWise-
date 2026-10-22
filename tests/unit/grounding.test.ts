import { describe, it, expect } from "vitest";
import {
  extractGroundingMetadata,
  buildGoogleMapsUrl,
  normalizeGroundedOption,
} from "@/lib/gemini/grounding";

describe("Grounding Adapter", () => {
  it("extracts search queries and web citations from candidate groundingMetadata", () => {
    const mockResponse = {
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: ["best cafes in Koramangala"],
            groundingChunks: [
              {
                web: {
                  uri: "https://example.com/top-cafes",
                  title: "Top 10 Cafes in Bengaluru",
                  domain: "example.com",
                },
              },
            ],
          },
        },
      ],
    };

    const extraction = extractGroundingMetadata(mockResponse);
    expect(extraction.isGrounded).toBe(true);
    expect(extraction.searchQueries).toContain("best cafes in Koramangala");
    expect(extraction.sources.length).toBe(1);
    expect(extraction.sources[0].url).toBe("https://example.com/top-cafes");
  });

  it("handles ungrounded responses cleanly", () => {
    const ungroundedResponse = {
      candidates: [{}],
    };

    const extraction = extractGroundingMetadata(ungroundedResponse);
    expect(extraction.isGrounded).toBe(false);
    expect(extraction.sources.length).toBe(0);
  });

  it("builds clean Google Maps search and directions URLs", () => {
    const url = buildGoogleMapsUrl("The Hole in the Wall Cafe", "Koramangala 4th Block, Bengaluru");
    expect(url).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(url).toContain("The%20Hole%20in%20the%20Wall%20Cafe");
    expect(url).toContain("Koramangala");
  });

  it("normalizes a raw option into a typed PlanningOption with verified provenance", () => {
    const normalized = normalizeGroundedOption(
      {
        name: "Dyu Art Cafe",
        description: "Art cafe in quiet bungalow with courtyards",
        price: {
          amount: 1200,
          currency: "INR",
          basis: "per_event",
          isEstimate: true,
        },
        rating: {
          value: 4.6,
          scale: 5,
          reviewCount: 520,
        },
      },
      "Koramangala Bengaluru",
      "https://example.com/dyu-cafe"
    );

    expect(normalized.name).toBe("Dyu Art Cafe");
    expect(normalized.status).toBe("suggested");
    expect(normalized.location?.directionsUrl).toBeDefined();
    expect(normalized.provenance[0].kind).toBe("verified_source");
    expect(normalized.provenance[0].sourceUrl).toBe("https://example.com/dyu-cafe");
  });
});
