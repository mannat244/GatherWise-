import { describe, it, expect } from "vitest";
import { calculateTokenCost } from "@/lib/observability/cost-calculator";

describe("Token & Tool Cost Calculator", () => {
  it("calculates exact costs for gemini-3.5-flash-lite on paid tier with known tokens", () => {
    // 100,000 prompt tokens @ $0.075/1M = $0.0075
    // 20,000 candidate tokens @ $0.30/1M = $0.0060
    // Total = $0.0135
    const result = calculateTokenCost({
      model: "gemini-3.5-flash-lite",
      promptTokens: 100_000,
      candidateTokens: 20_000,
      tier: "paid",
    });

    expect(result.status).toBe("calculated");
    expect(result.usageAvailable).toBe(true);
    expect(result.estimatedCostUsd).toBe(0.0135);
    expect(result.breakdown?.promptCostUsd).toBe(0.0075);
    expect(result.breakdown?.candidateCostUsd).toBe(0.006);
    expect(result.breakdown?.searchCostUsd).toBe(0);
  });

  it("calculates exact costs for gemini-2.0-flash with different pricing matrix", () => {
    // 1,000,000 prompt tokens @ $0.10/1M = $0.10
    // 500,000 candidate tokens @ $0.40/1M = $0.20
    // Total = $0.30
    const result = calculateTokenCost({
      model: "gemini-2.0-flash",
      promptTokens: 1_000_000,
      candidateTokens: 500_000,
      tier: "paid",
    });

    expect(result.status).toBe("calculated");
    expect(result.estimatedCostUsd).toBe(0.3);
  });

  it("includes separate search grounding tool charge when grounding fires on paid tier", () => {
    const result = calculateTokenCost({
      model: "gemini-3.5-flash-lite",
      promptTokens: 10_000, // $0.00075
      candidateTokens: 1_000, // $0.0003
      searchGroundingFired: true, // $0.035
      tier: "paid",
    });

    expect(result.breakdown?.searchCostUsd).toBe(0.035);
    expect(result.estimatedCostUsd).toBe(0.03605);
  });

  it("reports $0.00 billable on Free Tier while retaining commercial baseline breakdown", () => {
    const result = calculateTokenCost({
      model: "gemini-3.5-flash-lite",
      promptTokens: 50_000,
      candidateTokens: 10_000,
      tier: "free",
    });

    expect(result.status).toBe("free_tier");
    expect(result.estimatedCostUsd).toBe(0.0);
    expect(result.commercialEquivalentUsd).toBeGreaterThan(0);
    expect(result.pricingBasis).toContain("Free Tier");
  });

  it("distinguishes missing usage metadata by reporting unavailable estimate", () => {
    const result = calculateTokenCost({
      model: "gemini-3.5-flash-lite",
      promptTokens: null,
      candidateTokens: null,
      tier: "paid",
    });

    expect(result.status).toBe("missing_usage");
    expect(result.usageAvailable).toBe(false);
    expect(result.estimatedCostUsd).toBeNull();
    expect(result.pricingBasis).toContain("not observed");
  });

  it("reports estimate as unavailable when model is not recognized in pricing matrix", () => {
    const result = calculateTokenCost({
      model: "unsupported-custom-llm-v99",
      promptTokens: 50_000,
      candidateTokens: 10_000,
      tier: "paid",
    });

    expect(result.status).toBe("unsupported_model");
    expect(result.usageAvailable).toBe(true);
    expect(result.estimatedCostUsd).toBeNull();
    expect(result.pricingBasis).toContain("No pricing schedule configured");
  });
});
