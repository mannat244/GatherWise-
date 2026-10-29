/**
 * Official Google Gemini Pricing Schedules (per 1,000,000 tokens)
 * Reference: Google AI Studio & Vertex AI Gemini Documentation
 */
export interface ModelPricingConfig {
  promptCostPerMillion: number;
  candidateCostPerMillion: number;
  groundingSearchCostPerThousand?: number;
}

export const SUPPORTED_MODEL_PRICING: Record<string, ModelPricingConfig> = {
  // Gemini 3.5 / 2.5 Flash Lite
  "gemini-3.5-flash-lite": {
    promptCostPerMillion: 0.075,
    candidateCostPerMillion: 0.30,
    groundingSearchCostPerThousand: 35.0,
  },
  "gemini-2.5-flash-lite": {
    promptCostPerMillion: 0.075,
    candidateCostPerMillion: 0.30,
    groundingSearchCostPerThousand: 35.0,
  },
  "gemini-flash-lite-latest": {
    promptCostPerMillion: 0.075,
    candidateCostPerMillion: 0.30,
    groundingSearchCostPerThousand: 35.0,
  },
  // Gemini 2.5 / 2.0 / 1.5 Flash
  "gemini-2.5-flash": {
    promptCostPerMillion: 0.10,
    candidateCostPerMillion: 0.40,
    groundingSearchCostPerThousand: 35.0,
  },
  "gemini-2.0-flash": {
    promptCostPerMillion: 0.10,
    candidateCostPerMillion: 0.40,
    groundingSearchCostPerThousand: 35.0,
  },
  "gemini-1.5-flash": {
    promptCostPerMillion: 0.075,
    candidateCostPerMillion: 0.30,
    groundingSearchCostPerThousand: 35.0,
  },
  // Gemini Pro (1.5 / 2.5 Pro)
  "gemini-1.5-pro": {
    promptCostPerMillion: 1.25,
    candidateCostPerMillion: 5.00,
    groundingSearchCostPerThousand: 35.0,
  },
};

export interface TokenCostParams {
  model: string;
  promptTokens: number | null | undefined;
  candidateTokens: number | null | undefined;
  searchGroundingFired?: boolean;
  tier?: "free" | "paid";
}

export interface CostBreakdown {
  promptCostUsd: number;
  candidateCostUsd: number;
  searchCostUsd: number;
  totalCostUsd: number;
}

export interface TokenCostResult {
  estimatedCostUsd: number | null;
  commercialEquivalentUsd: number | null;
  usageAvailable: boolean;
  status: "calculated" | "free_tier" | "missing_usage" | "unsupported_model";
  pricingBasis: string;
  breakdown?: CostBreakdown;
}

/**
 * Calculates estimated token and tool costs based on configured model, billing tier,
 * and actual usage metadata.
 */
export function calculateTokenCost(params: TokenCostParams): TokenCostResult {
  const { model, promptTokens, candidateTokens, searchGroundingFired = false, tier = "free" } = params;

  // 1. Distinguish measured token usage from missing usage metadata
  if (
    promptTokens === null ||
    promptTokens === undefined ||
    candidateTokens === null ||
    candidateTokens === undefined
  ) {
    return {
      estimatedCostUsd: null,
      commercialEquivalentUsd: null,
      usageAvailable: false,
      status: "missing_usage",
      pricingBasis: "Usage metadata not observed from model response",
    };
  }

  // 2. Report estimate as unavailable when model pricing schedule isn't recognized
  const pricing = SUPPORTED_MODEL_PRICING[model];
  if (!pricing) {
    return {
      estimatedCostUsd: null,
      commercialEquivalentUsd: null,
      usageAvailable: true,
      status: "unsupported_model",
      pricingBasis: `No pricing schedule configured for model "${model}"`,
    };
  }

  // 3. Compute commercial baseline charges
  const promptCostUsd = (promptTokens * pricing.promptCostPerMillion) / 1_000_000;
  const candidateCostUsd = (candidateTokens * pricing.candidateCostPerMillion) / 1_000_000;
  // Search grounding charges: $35 / 1000 queries when grounding tool fires on paid tier
  const searchCostUsd = searchGroundingFired && pricing.groundingSearchCostPerThousand
    ? pricing.groundingSearchCostPerThousand / 1000
    : 0;

  const commercialTotal = Number((promptCostUsd + candidateCostUsd + searchCostUsd).toFixed(6));

  const breakdown: CostBreakdown = {
    promptCostUsd: Number(promptCostUsd.toFixed(6)),
    candidateCostUsd: Number(candidateCostUsd.toFixed(6)),
    searchCostUsd: Number(searchCostUsd.toFixed(6)),
    totalCostUsd: commercialTotal,
  };

  // 4. Associate pricing with applicable billing tier
  if (tier === "free") {
    return {
      estimatedCostUsd: 0.0,
      commercialEquivalentUsd: commercialTotal,
      usageAvailable: true,
      status: "free_tier",
      pricingBasis: `Google AI Studio Free Tier ($0.00 billable) | Commercial baseline: $${pricing.promptCostPerMillion}/1M in, $${pricing.candidateCostPerMillion}/1M out`,
      breakdown,
    };
  }

  return {
    estimatedCostUsd: commercialTotal,
    commercialEquivalentUsd: commercialTotal,
    usageAvailable: true,
    status: "calculated",
    pricingBasis: `${model} Paid Tier: $${pricing.promptCostPerMillion}/1M in, $${pricing.candidateCostPerMillion}/1M out${searchCostUsd > 0 ? " + search tool" : ""}`,
    breakdown,
  };
}
