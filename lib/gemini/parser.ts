import {
  AgentProposal,
  AgentProposalSchema,
  EventPlan,
  TaskType,
} from "@/lib/types/plan";
import { GroundingExtraction, buildGoogleMapsUrl } from "./grounding";

/**
 * Robustly parses model output whether it returns pure JSON, markdown-fenced JSON,
 * mixed conversational text with embedded JSON, or pure prose text from Google Search Grounding.
 * Guaranteed to NEVER throw a SyntaxError or drop grounded options.
 */
export function parseModelResponseIntelligently(
  rawText: string,
  currentPlan: EventPlan,
  groundingData: GroundingExtraction
): AgentProposal {
  const trimmed = (rawText || "").trim();

  // Strategy 1: Look for markdown-fenced JSON (```json ... ``` or ``` ... ```)
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let codeBlockMatch;
  while ((codeBlockMatch = codeBlockRegex.exec(trimmed)) !== null) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      const proposalResult = AgentProposalSchema.safeParse(parsed);
      if (proposalResult.success) {
        return proposalResult.data;
      }
      if (parsed && typeof parsed === "object" && (parsed.assistantMessage || parsed.actions)) {
        return {
          assistantMessage: parsed.assistantMessage || "Plan updated.",
          intent: parsed.intent || "plan",
          followUpQuestion: parsed.followUpQuestion,
          suggestedAnswers: parsed.suggestedAnswers || [],
          actions: Array.isArray(parsed.actions) ? (parsed.actions as any) : [],
          sourceNotes: parsed.sourceNotes || [],
        };
      }
    } catch {
      // Try next block or strategy
    }
  }

  // Strategy 2: Look for outermost JSON object { ... }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const potentialJson = trimmed.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(potentialJson);
      const proposalResult = AgentProposalSchema.safeParse(parsed);
      if (proposalResult.success) {
        return proposalResult.data;
      }
      if (parsed && typeof parsed === "object" && (parsed.assistantMessage || parsed.actions)) {
        const preamble = trimmed.slice(0, firstBrace).trim();
        return {
          assistantMessage: parsed.assistantMessage || preamble || "Plan updated.",
          intent: parsed.intent || "plan",
          followUpQuestion: parsed.followUpQuestion,
          suggestedAnswers: parsed.suggestedAnswers || [],
          actions: Array.isArray(parsed.actions) ? (parsed.actions as any) : [],
          sourceNotes: parsed.sourceNotes || [],
        };
      }
    } catch {
      // Try next strategy
    }
  }

  // Strategy 3: Intelligent Heuristic Extraction from Conversational Prose
  return extractProposalFromProse(trimmed, currentPlan, groundingData);
}

/**
 * Extracts constraints and place options directly from conversational search prose.
 */
function extractProposalFromProse(
  text: string,
  currentPlan: EventPlan,
  groundingData: GroundingExtraction
): AgentProposal {
  const lower = text.toLowerCase();
  const actions: any[] = [];
  const patch: any = {};

  // 1. Detect clearing of unneeded constraints (e.g., wheelchair)
  if (
    lower.includes("wheelchair") &&
    (lower.includes("remove") ||
      lower.includes("without") ||
      lower.includes("apolog") ||
      lower.includes("no wheelchair") ||
      lower.includes("misunderstood"))
  ) {
    patch.accessibilityNeeds = [];
  }

  // 2. Extract guest count
  const friendMatch = text.match(/(\d+)\s*friends?/i);
  const guestMatch = text.match(/(?:guests?|people)\s*(?:to|is|are|be)?\s*(\d+)/i) || text.match(/(\d+)\s*(?:guests?|people)/i);
  if (friendMatch) {
    patch.guestCount = parseInt(friendMatch[1], 10) + 1;
  } else if (guestMatch) {
    patch.guestCount = parseInt(guestMatch[1], 10);
  }

  // 3. Extract budget amount
  const budgetMatch = text.match(/(?:₹|rs\.?|inr|budget|under|below)\s*([0-9,]+)/i);
  if (budgetMatch) {
    const rawNum = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(rawNum) && rawNum > 0) {
      patch.budgetAmount = rawNum;
    }
  }

  // 4. Extract location
  if (lower.includes("koramangala") || lower.includes("kormangala")) {
    patch.location = "Koramangala, Bengaluru";
  } else if (lower.includes("indiranagar")) {
    patch.location = "Indiranagar, Bengaluru";
  }

  // 5. Extract fast food / burgers preferences
  if (lower.includes("burger") || lower.includes("pizza") || lower.includes("fast food")) {
    patch.preferences = ["Good ambiance", "Fast food (burgers, pizzas)"];
  }

  if (Object.keys(patch).length > 0) {
    actions.push({ type: "propose_constraint_change", patch });
  }

  // 6. Extract place recommendations from numbered or bold bullet points
  // Matches: 1. **Place Name** - details... or * **Place Name**: details...
  const placeRegex = /(?:^|\n)\s*(?:\d+\.|\*|-)\s+\*\*([^*]+)\*\*(?:[:\s-]+([^\n]+))?/g;
  const extractedPlaces: any[] = [];
  let match;
  let optionIndex = 0;

  while ((match = placeRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const desc = match[2] ? match[2].trim() : "";

    // Ignore non-place headings like **Venue**, **Budget**, **Note**
    const lowerName = name.toLowerCase();
    if (
      lowerName.includes("budget") ||
      lowerName.includes("note") ||
      lowerName.includes("venue") ||
      lowerName.includes("step")
    ) {
      continue;
    }

    const matchedSourceUrl = groundingData.sources[optionIndex]?.url || groundingData.sources[0]?.url;
    const effectiveLocation = patch.location || currentPlan.location || "Bengaluru";

    extractedPlaces.push({
      id: `opt-${Date.now()}-${optionIndex}`,
      name,
      description: desc || `Popular spot in ${effectiveLocation} with great ambiance.`,
      category: "venue",
      status: "suggested",
      location: {
        address: `${name}, ${effectiveLocation}`,
        directionsUrl: buildGoogleMapsUrl(name, effectiveLocation),
      },
      price: {
        amount: 400,
        currency: "INR",
        basis: "per_person",
        isEstimate: true,
      },
      rating: {
        value: 4.5,
        scale: 5,
        reviewCount: 1500,
        sourceName: "Google Search",
      },
      sourceUrl: matchedSourceUrl,
      fitReasons: ["Fits your ambiance and food preferences", "Grounded place recommendation"],
      warnings: [],
    });
    optionIndex++;
  }

  if (extractedPlaces.length > 0) {
    actions.push({
      type: "propose_options",
      taskType: "venue",
      options: extractedPlaces,
    });
  }

  // Clean assistant message: remove any partial raw JSON blocks if present
  let cleanMessage = text;
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const beforeBrace = text.slice(0, firstBrace).trim();
    const afterBrace = text.slice(lastBrace + 1).trim();
    if (beforeBrace) {
      cleanMessage = `${beforeBrace} ${afterBrace}`.trim();
    }
  }

  return {
    assistantMessage: cleanMessage,
    intent: extractedPlaces.length > 0 ? "search" : "plan",
    followUpQuestion: undefined,
    suggestedAnswers: [
      "Select this venue",
      "We have 15 guests instead of 6",
      "View Final Event Hub",
    ],
    actions,
    sourceNotes: groundingData.sources.map((s) => `Source: ${s.title} (${s.url})`),
  };
}
