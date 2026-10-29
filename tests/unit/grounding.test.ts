import { describe, it, expect } from "vitest";
import {
  extractGroundingMetadata,
  buildGoogleMapsUrl,
  normalizeGroundedOption,
  findMatchingGroundingSource,
  shouldTriggerSearchGrounding,
} from "@/lib/gemini/grounding";
import { EventPlan } from "@/lib/types/plan";

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
      { title: "Dyu Art Cafe Official", url: "https://example.com/dyu-cafe" }
    );

    expect(normalized.name).toBe("Dyu Art Cafe");
    expect(normalized.status).toBe("suggested");
    expect(normalized.location?.directionsUrl).toBeDefined();
    expect(normalized.provenance[0].kind).toBe("verified_source");
    expect(normalized.provenance[0].sourceUrl).toBe("https://example.com/dyu-cafe");
  });

  it("does NOT mark an option as verified just because it has an arbitrary URL string", () => {
    const ungroundedWithUrl = normalizeGroundedOption(
      {
        name: "Unverified Cafe",
        description: "Random cafe with unverified link",
        sourceUrl: "https://random-blog.com/cafe-mention",
      },
      "Bengaluru"
    );

    expect(ungroundedWithUrl.name).toBe("Unverified Cafe");
    expect(ungroundedWithUrl.provenance[0].kind).toBe("estimate");
    expect(ungroundedWithUrl.provenance[0].note).toContain("live verification pending");
  });

  it("labels option provenance as estimate when no verified search source matches", () => {
    const unverified = normalizeGroundedOption(
      {
        name: "Generic Mystery Cafe",
        description: "Cozy cafe with warm lights",
      },
      "Bengaluru"
    );

    expect(unverified.name).toBe("Generic Mystery Cafe");
    expect(unverified.provenance[0].kind).toBe("estimate");
    expect(unverified.provenance[0].note).toContain("live verification pending");
  });

  it("accurately matches individual options to specific grounding sources", () => {
    const sources = [
      { title: "Truffles Burger Joint Bangalore", url: "https://truffles.co.in", domain: "truffles.co.in" },
      { title: "The Grid Gaming and Bowling Arena", url: "https://thegrid.in", domain: "thegrid.in" },
    ];

    const matchTruffles = findMatchingGroundingSource("Truffles Koramangala", undefined, sources);
    expect(matchTruffles?.url).toBe("https://truffles.co.in");

    const matchGrid = findMatchingGroundingSource("The Grid - Gaming Arena", undefined, sources);
    expect(matchGrid?.url).toBe("https://thegrid.in");

    const noMatch = findMatchingGroundingSource("Amoeba Bowling", undefined, sources);
    expect(noMatch).toBeUndefined();
  });

  it("shouldTriggerSearchGrounding suppresses search on pure greetings and budget inquiries", () => {
    const mockPlan: EventPlan = {
      id: "plan-1",
      version: 1,
      title: "Birthday",
      timezone: "Asia/Kolkata",
      constraints: {
        currency: "INR",
        contingencyPercent: 10,
        dietaryNeeds: [],
        accessibilityNeeds: [],
        preferences: [],
        exclusions: [],
      },
      tasks: [],
      createdAt: "2026-10-22T10:00:00Z",
      updatedAt: "2026-10-22T10:00:00Z",
    };

    // Greetings: should NOT trigger search
    expect(shouldTriggerSearchGrounding("Hello", mockPlan)).toBe(false);
    expect(shouldTriggerSearchGrounding("Hi!", mockPlan)).toBe(false);
    expect(shouldTriggerSearchGrounding("good morning", mockPlan)).toBe(false);

    // Budget inquiries: should NOT trigger search
    expect(shouldTriggerSearchGrounding("what is our remaining budget?", mockPlan)).toBe(false);
    expect(shouldTriggerSearchGrounding("how much total cost?", mockPlan)).toBe(false);

    // Discovery / Event Briefs: MUST trigger search
    expect(shouldTriggerSearchGrounding("find top fast-food burger places in Koramangala", mockPlan)).toBe(true);
    expect(shouldTriggerSearchGrounding("suggest bowling and entertainment spots", mockPlan)).toBe(true);
    expect(shouldTriggerSearchGrounding("what are travel options from Electronic City?", mockPlan)).toBe(true);
  });
});
