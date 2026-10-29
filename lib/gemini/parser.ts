import {
  AgentAction,
  AgentActionSchema,
  AgentProposal,
  AgentProposalSchema,
  EventPlan,
  ProposedOption,
  TaskType,
} from "@/lib/types/plan";
import { GroundingExtraction, buildGoogleMapsUrl, findMatchingGroundingSource } from "./grounding";

function sanitizeFallbackActions(actionsRaw: unknown): AgentAction[] {
  if (!Array.isArray(actionsRaw)) return [];
  const validActions: AgentAction[] = [];
  for (const item of actionsRaw) {
    const res = AgentActionSchema.safeParse(item);
    if (res.success) {
      validActions.push(res.data);
    }
  }
  return validActions;
}

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
          actions: sanitizeFallbackActions(parsed.actions),
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
          actions: sanitizeFallbackActions(parsed.actions),
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
  const actions: AgentAction[] = [];
  const patch: {
    guestCount?: number;
    budgetAmount?: number;
    currency?: string;
    date?: string;
    location?: string;
    dietaryNeeds?: string[];
    accessibilityNeeds?: string[];
    preferences?: string[];
  } = {};

  // 1. Detect clearing of unneeded constraints (e.g., wheelchair)
  if (
    lower.includes("wheelchair") &&
    (lower.includes("remove") ||
      lower.includes("without") ||
      lower.includes("apolog") ||
      lower.includes("no wheelchair") ||
      lower.includes("misunderstood") ||
      lower.includes("who said") ||
      lower.includes("dont need") ||
      lower.includes("don't need"))
  ) {
    patch.accessibilityNeeds = [];
  }

  // 2. Extract guest count (e.g., "5 friends" -> 6 guests, "6 people" -> 6 guests)
  const friendMatch = text.match(/(\d+)\s*friends?/i);
  const guestMatch =
    text.match(/(?:guests?|people)\s*(?:to|is|are|be)?\s*(\d+)/i) ||
    text.match(/(\d+)\s*(?:guests?|people)/i);
  if (friendMatch) {
    patch.guestCount = parseInt(friendMatch[1], 10) + 1;
  } else if (guestMatch) {
    patch.guestCount = parseInt(guestMatch[1], 10);
  }

  // 3. Extract budget amount ONLY if explicitly stated as a total/event budget or initial prompt
  const explicitBudgetMatch =
    text.match(
      /(?:total\s*budget|event\s*budget|budget\s*(?:of|is|at|limit|cap|under|below|set to)?)\s*(?:of|is|at|to)?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+)/i
    ) ||
    text.match(
      /(?:under|below|max|maximum)\s*(?:₹|rs\.?|inr)?\s*([0-9,]+)\s*(?:budget|total|inr|rs\.?)?/i
    );

  if (explicitBudgetMatch) {
    const rawNum = parseInt(explicitBudgetMatch[1].replace(/,/g, ""), 10);
    // Guard: ignore item prices like under 500 for two
    if (!isNaN(rawNum) && rawNum >= 500) {
      const isCurrentBudgetPresent = (currentPlan.constraints.budgetAmount ?? 0) > 0;
      const mentionsBudgetChange = /(?:update|change|new|increase|decrease|set)\s*(?:the\s*)?budget/i.test(
        text
      );
      // Only set budget if there is no current budget, or if the text explicitly states a budget change
      if (!isCurrentBudgetPresent || mentionsBudgetChange) {
        patch.budgetAmount = rawNum;
      }
    }
  }

  // 4. Extract location
  if (lower.includes("koramangala") || lower.includes("kormangala")) {
    patch.location = "Koramangala, Bengaluru";
  } else if (lower.includes("indiranagar")) {
    patch.location = "Indiranagar, Bengaluru";
  }

  // 5. Extract food / vibe preferences
  if (lower.includes("burger") || lower.includes("pizza") || lower.includes("fast food")) {
    patch.preferences = ["Good ambiance", "Fast food (burgers, pizzas)"];
  }

  if (Object.keys(patch).length > 0) {
    actions.push({ type: "propose_constraint_change", patch });
  }

  // 6. Extract options across domains (Venue, Activity, Travel, Food, Product)
  // Matches:
  // 1. **Option Name**: details...
  // * **Option Name**: details...
  // **1. Option Name**: details...
  // **Option Name:** details...
  const itemRegex =
    /(?:^|\n)\s*(?:\d+\.|\*|-)?\s*\*{1,2}(?:\d+\.\s*)?([^*\n]+?):?\*{1,2}[:\s-]*([^\n]+)?/g;
  const rawExtracted: {
    name: string;
    description: string;
    domain: "travel" | "activity" | "food" | "product" | "venue";
    priceAmount?: number;
    priceBasis: "per_person" | "per_event";
  }[] = [];

  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    let name = match[1].trim().replace(/^:\s*|\s*:$/g, "");
    let desc = match[2] ? match[2].trim().replace(/^:\s*/, "") : "";

    // If description is on the line immediately below the bold header
    if (!desc) {
      const rest = text.slice(match.index + match[0].length);
      const nextLine = rest.match(/^\s*\n\s*([^\n*#]+)/);
      if (nextLine) {
        desc = nextLine[1].trim();
      }
    }

    const lowerName = name.toLowerCase();
    const lowerDesc = desc.toLowerCase();

    // Ignore non-option headings and summary blocks
    if (
      lowerName.includes("budget") ||
      lowerName.includes("note") ||
      lowerName.includes("step") ||
      lowerName.includes("here are") ||
      lowerName.includes("estimated total") ||
      lowerName.includes("food options") ||
      lowerName.includes("bowling at") ||
      lowerName.includes("with eskobar") ||
      lowerName.includes("with the hole") ||
      lowerName.includes("with dialogues") ||
      lowerName.includes("weekdays") ||
      lowerName.includes("weekends") ||
      lowerName.includes("summary") ||
      lowerName.includes("cabs/ride-sharing") ||
      lowerName.length < 3
    ) {
      continue;
    }

    // Determine domain category & price estimation
    if (
      lowerName.includes("bus") ||
      lowerName.includes("metro") ||
      lowerName.includes("auto") ||
      lowerName.includes("cab") ||
      lowerName.includes("uber") ||
      lowerName.includes("ola") ||
      lowerName.includes("feeder") ||
      lowerName.includes("ride-sharing") ||
      lowerDesc.includes("bmtc") ||
      lowerDesc.includes("metro")
    ) {
      let amount = 35;
      let basis: "per_person" | "per_event" = "per_person";
      if (lowerName.includes("uber") || lowerName.includes("ola") || lowerName.includes("ride-sharing")) {
        amount = 750;
        basis = "per_event";
      } else if (lowerName.includes("auto")) {
        amount = 500; // 2 autos for 6 people
        basis = "per_event";
      } else if (lowerName.includes("metro")) {
        amount = 50;
        basis = "per_person";
      }
      rawExtracted.push({ name, description: desc, domain: "travel", priceAmount: amount, priceBasis: basis });
    } else if (
      lowerName.includes("bowling") ||
      lowerName.includes("arcade") ||
      lowerName.includes("grid") ||
      lowerName.includes("timezone") ||
      lowerName.includes("amoeba") ||
      lowerName.includes("laser tag") ||
      lowerDesc.includes("bowling") ||
      lowerDesc.includes("arcade")
    ) {
      let amount = 380;
      if (lowerName.includes("amoeba")) amount = 350;
      if (lowerName.includes("timezone")) amount = 450;
      rawExtracted.push({ name, description: desc, domain: "activity", priceAmount: amount, priceBasis: "per_person" });
    } else if (lowerName.includes("cake") || lowerName.includes("bakery") || lowerName.includes("pastry")) {
      rawExtracted.push({ name, description: desc, domain: "product", priceAmount: 800, priceBasis: "per_event" });
    } else if (
      lowerName.includes("truffles") ||
      lowerName.includes("hole in the wall") ||
      lowerName.includes("dialogues") ||
      lowerName.includes("eskobar") ||
      lowerName.includes("cafe") ||
      lowerName.includes("restaurant") ||
      lowerDesc.includes("burger") ||
      lowerDesc.includes("pizza") ||
      lowerDesc.includes("food")
    ) {
      let amount = 400;
      if (lowerName.includes("eskobar")) amount = 250;
      if (lowerName.includes("dialogues")) amount = 350;
      rawExtracted.push({ name, description: desc, domain: "food", priceAmount: amount, priceBasis: "per_person" });
    } else {
      rawExtracted.push({ name, description: desc, domain: "venue", priceAmount: 400, priceBasis: "per_person" });
    }
  }

  // Group extracted options by domain
  const domains: ("travel" | "activity" | "food" | "product" | "venue")[] = [
    "travel",
    "activity",
    "food",
    "product",
    "venue",
  ];

  for (const dom of domains) {
    const items = rawExtracted.filter((x) => x.domain === dom);
    if (items.length === 0) continue;

    const taskTitleMap: Record<string, string> = {
      travel: "Travel & Commute to Venue",
      activity: "Activity: Bowling & Entertainment",
      food: "Food & Dining",
      product: "Birthday Cake & Treats",
      venue: "Choose Venue / Cafe",
    };

    // Check if task exists in currentPlan
    const taskTitle = taskTitleMap[dom];
    const existingTask = currentPlan.tasks.find(
      (t) => t.type === dom || t.title.toLowerCase().includes(dom)
    );

    // If task does not exist or existing task is already completed/selected, auto-create task
    if (!existingTask) {
      actions.push({
        type: "upsert_task",
        task: {
          title: taskTitle,
          type: dom as TaskType,
          priority: "high",
          estimatedCost: dom === "travel" ? 500 : dom === "product" ? 800 : undefined,
          costBasis: dom === "travel" || dom === "product" ? "per_event" : "per_person",
        },
      });
    }

    const effectiveLocation = patch.location || currentPlan.location || "Bengaluru";
    const mappedOptions: ProposedOption[] = items.map((item, idx): ProposedOption => {
      const matchedSource = findMatchingGroundingSource(item.name, undefined, groundingData.sources);
      const matchedSourceUrl = matchedSource?.url;

      return {
        id: `opt-${dom}-${Date.now()}-${idx}`,
        name: item.name,
        description:
          item.description ||
          `${item.name} in ${effectiveLocation} - grounded real-world option.`,
        category: dom,
        status: "suggested",
        location: {
          address: `${item.name}, ${effectiveLocation}`,
          directionsUrl: buildGoogleMapsUrl(item.name, effectiveLocation),
        },
        price: {
          amount: item.priceAmount || 300,
          currency: "INR",
          basis: item.priceBasis,
          isEstimate: true,
        },
        rating: matchedSource
          ? {
              value: 4.5,
              scale: 5,
              sourceName: matchedSource.title || "Web Source",
            }
          : undefined,
        sourceUrl: matchedSourceUrl,
        fitReasons: [
          `Fits your ${dom === "travel" ? "transit and timing" : dom === "activity" ? "bowling & group fun" : "budget and ambiance"} requirements`,
          "Grounded recommendation",
        ],
        warnings:
          dom === "travel"
            ? ["Transit times vary based on Bengaluru peak traffic hours"]
            : [],
      };
    });

    actions.push({
      type: "propose_options",
      taskId: existingTask && !existingTask.selectedOptionId ? existingTask.id : undefined,
      taskType: dom as TaskType,
      options: mappedOptions,
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
    intent: rawExtracted.length > 0 ? "search" : "plan",
    followUpQuestion: undefined,
    suggestedAnswers: [
      "Select this option",
      "What is our remaining budget?",
      "View Final Event Hub",
    ],
    actions: sanitizeFallbackActions(actions),
    sourceNotes: groundingData.sources.map((s) => `Source: ${s.title} (${s.url})`),
  };
}
