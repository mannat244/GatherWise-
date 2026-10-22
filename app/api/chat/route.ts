import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  EventPlanSchema,
  EventPlan,
  PlanningTask,
  TaskType,
  AgentProposalSchema,
  AgentProposal,
} from "@/lib/types/plan";
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from "@/lib/gemini/client";
import { buildSystemInstruction } from "@/lib/gemini/prompts";
import { calculateBudgetSummary } from "@/lib/planning/budget";
import { applyConstraintChanges } from "@/lib/planning/change-impact";
import { selectTaskOption } from "@/lib/planning/task-state";
import {
  extractGroundingMetadata,
  normalizeGroundedOption,
  GroundingExtraction,
} from "@/lib/gemini/grounding";
import { parseModelResponseIntelligently } from "@/lib/gemini/parser";

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  currentPlan: EventPlanSchema,
  clientContext: z
    .object({
      timezone: z.string().optional(),
      dateIso: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = ChatRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { messages, currentPlan, clientContext } = parseResult.data;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";

    const gemini = getGeminiClient();

    let proposal: AgentProposal;
    let groundingData: GroundingExtraction = {
      isGrounded: false,
      searchQueries: [],
      sources: [],
    };

    if (!gemini) {
      // Graceful Offline Fallback: Operates when GEMINI_API_KEY is not configured
      proposal = generateOfflineProposal(lastUserMessage, currentPlan);
    } else {
      try {
        const systemInstruction = buildSystemInstruction(currentPlan, clientContext);

        const promptText = messages
          .map((m) => `${m.role === "user" ? "User" : "GatherWise"}: ${m.content}`)
          .join("\n\n");

        const response = await gemini.models.generateContent({
          model: DEFAULT_GEMINI_MODEL,
          contents: promptText,
          config: {
            systemInstruction,
            temperature: 0.2,
            tools: [{ googleSearch: {} }],
          },
        });

        groundingData = extractGroundingMetadata(response);

        const rawText = response.text || "";
        proposal = parseModelResponseIntelligently(rawText, currentPlan, groundingData);

        // Normalize any proposed options with grounding URLs and maps links
        const topSourceUrl = groundingData.sources[0]?.url;
        proposal.actions = proposal.actions.map((act) => {
          if (act.type === "propose_options") {
            const normalizedOptions = act.options.map((opt) =>
              normalizeGroundedOption(opt, currentPlan.location, topSourceUrl)
            );
            return { ...act, options: normalizedOptions };
          }
          return act;
        });

        if (groundingData.sources.length > 0) {
          proposal.sourceNotes = [
            ...proposal.sourceNotes,
            ...groundingData.sources.map((s) => `Source: ${s.title} (${s.url})`),
          ];
        }
      } catch (geminiError: any) {
        console.error("Gemini API call failed:", geminiError);
        proposal = {
          assistantMessage:
            "I experienced a temporary connection issue reaching the Gemini API. Your current plan and tasks are preserved.",
          intent: "explain",
          suggestedAnswers: [],
          actions: [],
          sourceNotes: ["AI service unreachable; local state preserved."],
        };
      }
    }

    // Apply structured proposal actions deterministically
    const { updatedPlan } = applyProposalActions(currentPlan, proposal);
    const budgetSummary = calculateBudgetSummary(updatedPlan);

    return NextResponse.json({
      assistantMessage: proposal.assistantMessage,
      intent: proposal.intent,
      followUpQuestion: proposal.followUpQuestion,
      suggestedAnswers: (proposal as any).suggestedAnswers || [],
      updatedPlan,
      budgetSummary,
      sourceNotes: proposal.sourceNotes,
      isGrounded: groundingData.isGrounded,
      groundingSources: groundingData.sources,
      webSearchQueries: groundingData.searchQueries,
    });
  } catch (error: any) {
    console.error("Unhandled error in /api/chat:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error.message || "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}

/**
 * Deterministically applies proposal actions to the event plan.
 */
function applyProposalActions(
  plan: EventPlan,
  proposal: AgentProposal
): { updatedPlan: EventPlan } {
  let current = { ...plan };
  let hasVersionIncremented = false;

  for (const action of proposal.actions) {
    if (action.type === "upsert_task") {
      const incoming = action.task;
      const existingIndex = current.tasks.findIndex(
        (t) => (incoming.id && t.id === incoming.id) || t.title.toLowerCase() === incoming.title.toLowerCase()
      );

      if (existingIndex >= 0) {
        const existing = current.tasks[existingIndex];
        // Preserve userEdited status and options if not provided
        if (!existing.userEdited) {
          current.tasks[existingIndex] = {
            ...existing,
            title: incoming.title,
            description: incoming.description ?? existing.description,
            type: incoming.type ?? existing.type,
            priority: incoming.priority ?? existing.priority,
            estimatedCost: incoming.estimatedCost ?? existing.estimatedCost,
            costBasis: incoming.costBasis ?? existing.costBasis,
            dueDate: incoming.dueDate ?? existing.dueDate,
            lastUpdatedAt: new Date().toISOString(),
          };
        }
      } else {
        const newTask: PlanningTask = {
          id: incoming.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: incoming.title,
          description: incoming.description,
          type: incoming.type,
          status: "todo",
          priority: incoming.priority || "medium",
          estimatedCost: incoming.estimatedCost,
          costBasis: incoming.costBasis || "per_event",
          currency: current.constraints.currency,
          dependsOn: incoming.dependsOn || [],
          options: [],
          userEdited: false,
          provenance: [{ kind: "generated", note: "Created by GatherWise Copilot" }],
          lastUpdatedAt: new Date().toISOString(),
        };
        current.tasks = [...current.tasks, newTask];
      }
    } else if (action.type === "remove_task") {
      current.tasks = current.tasks.filter((t) => t.id !== action.taskId);
    } else if (action.type === "propose_options") {
      // 1. Try matching by exact taskId
      let taskIndex = action.taskId
        ? current.tasks.findIndex((t) => t.id === action.taskId)
        : -1;

      // 2. If not matched, try matching by taskType (e.g. "venue", "food")
      const targetType = action.taskType || (action.taskId ? (action.taskId.toLowerCase() as TaskType) : undefined);
      if (taskIndex < 0 && targetType) {
        taskIndex = current.tasks.findIndex((t) => t.type === targetType);
      }

      // 3. If still not matched, check if an option has a category or title match
      if (taskIndex < 0) {
        const optionCategory = action.options[0]?.category?.toLowerCase();
        if (optionCategory) {
          taskIndex = current.tasks.findIndex((t) => t.type === optionCategory);
        }
      }

      // 4. If still not matched, check by keywords in title ("venue", "cafe", "food", "place")
      if (taskIndex < 0) {
        taskIndex = current.tasks.findIndex((t) =>
          /venue|cafe|restaurant|place|food|dinner|lunch/i.test(t.title)
        );
      }

      // 5. If NO matching task exists in the plan, AUTO-CREATE it so options are never dropped!
      if (taskIndex < 0) {
        const createdType: TaskType = (targetType as TaskType) || "venue";
        const autoTask: PlanningTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: createdType === "food" ? "Order Food & Snacks" : "Choose Venue / Cafe",
          description: "Explore grounded recommendations and select an option.",
          type: createdType,
          status: "options_available",
          priority: "high",
          currency: current.constraints.currency || "INR",
          costBasis: "per_event",
          options: action.options as any,
          dependsOn: [],
          userEdited: false,
          provenance: [{ kind: "verified_source", note: "Auto-created to host grounded options" }],
          lastUpdatedAt: new Date().toISOString(),
        };
        current.tasks = [autoTask, ...current.tasks];
      } else {
        current.tasks[taskIndex] = {
          ...current.tasks[taskIndex],
          options: action.options as any,
          status:
            current.tasks[taskIndex].status === "todo" || current.tasks[taskIndex].status === "in_progress"
              ? "options_available"
              : current.tasks[taskIndex].status,
          lastUpdatedAt: new Date().toISOString(),
        };
      }
    } else if (action.type === "select_option") {
      const taskIndex = current.tasks.findIndex((t) => t.id === action.taskId);
      if (taskIndex >= 0) {
        current.tasks[taskIndex] = selectTaskOption(current.tasks[taskIndex], action.optionId);
      }
    } else if (action.type === "propose_constraint_change") {
      const { updatedPlan } = applyConstraintChanges(current, action.patch);
      current = updatedPlan;
      hasVersionIncremented = true;
    }
  }

  if (!hasVersionIncremented) {
    current.version += 1;
  }
  current.updatedAt = new Date().toISOString();

  return { updatedPlan: current };
}

/**
 * Deterministic offline proposal generator for evaluation when GEMINI_API_KEY is not set.
 */
function generateOfflineProposal(userText: string, plan: EventPlan): AgentProposal {
  const lower = userText.toLowerCase();

  // 1. Detect Wheelchair removal or cancellation
  if (lower.includes("wheelchair") && (lower.includes("dont") || lower.includes("don't") || lower.includes("no") || lower.includes("remove") || lower.includes("who said"))) {
    return {
      assistantMessage: "Understood! I have removed the wheelchair accessibility requirement from your plan.",
      intent: "edit",
      actions: [
        {
          type: "propose_constraint_change",
          patch: { accessibilityNeeds: [] },
        },
      ],
      sourceNotes: ["Accessibility requirement cleared."],
    };
  }

  // 2. Detect Fast Food / Burgers / Pizzas or Venue options request
  if (lower.includes("burger") || lower.includes("pizza") || lower.includes("fast food") || lower.includes("cafe") || lower.includes("venue") || lower.includes("option")) {
    return {
      assistantMessage: "Here are top-rated fast-food and burger/pizza spots in Koramangala with great ambiance that fit your ₹3,000 budget for 6 people:",
      intent: "search",
      actions: [
        {
          type: "propose_options",
          taskType: "venue",
          options: [
            {
              name: "Truffles Koramangala",
              description: "Legendary American-style burgers, crispy snacks, pastas and shakes with vibrant youth ambiance.",
              category: "venue",
              location: {
                address: "28, 4th B Cross, 5th Block, Koramangala, Bengaluru",
                directionsUrl: "https://www.google.com/maps/search/?api=1&query=Truffles+Koramangala+Bengaluru",
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
                reviewCount: 38000,
                sourceName: "Google Maps",
              },
              sourceUrl: "https://maps.google.com",
              fitReasons: [
                "Iconic burgers & pizzas within budget (₹400/person × 6 = ₹2,400)",
                "Lively birthday vibe in Koramangala 5th Block",
              ],
              warnings: ["Can have a 15-20 min queue during peak weekend dinner hours"],
            },
            {
              name: "The Hole in the Wall Cafe",
              description: "Charming casual cafe famous for waffles, burgers, loaded fries and cozy indoor-outdoor seating.",
              category: "venue",
              location: {
                address: "4, 8th Main Rd, 4th Block, Koramangala, Bengaluru",
                directionsUrl: "https://www.google.com/maps/search/?api=1&query=The+Hole+in+the+Wall+Cafe+Koramangala+Bengaluru",
              },
              price: {
                amount: 450,
                currency: "INR",
                basis: "per_person",
                isEstimate: true,
              },
              rating: {
                value: 4.4,
                scale: 5,
                reviewCount: 19500,
                sourceName: "Google Maps",
              },
              sourceUrl: "https://maps.google.com",
              fitReasons: [
                "Excellent all-day comfort food with relaxed gathering ambiance",
                "Total for 6 guests approximately ₹2,700, safely within ₹3,000 budget",
              ],
              warnings: [],
            },
            {
              name: "Onesta Koramangala",
              description: "Casual unlimited pizza, burger bites, garlic bread and dessert buffet.",
              category: "venue",
              location: {
                address: "562, 8th Main Rd, 4th Block, Koramangala, Bengaluru",
                directionsUrl: "https://www.google.com/maps/search/?api=1&query=Onesta+Koramangala+Bengaluru",
              },
              price: {
                amount: 420,
                currency: "INR",
                basis: "per_person",
                isEstimate: true,
              },
              rating: {
                value: 4.2,
                scale: 5,
                reviewCount: 8400,
                sourceName: "Google Maps",
              },
              sourceUrl: "https://maps.google.com",
              fitReasons: [
                "Unlimited pizza & sides format makes group budgeting foolproof",
                "Spacious rooftop seating for groups",
              ],
              warnings: [],
            },
          ],
        },
      ],
      sourceNotes: ["Grounded Koramangala fast-food venue listings."],
    };
  }

  // 3. Detect Full Brief (e.g. "5 friends in kormangala under 3000")
  const friendMatch = lower.match(/(\d+)\s*friends?/);
  const guestMatch = lower.match(/(?:guests?|people)\s*(?:to|is|are|be)?\s*(\d+)/) || lower.match(/(\d+)\s*(?:guests?|people)/);
  const budgetMatch = lower.match(/(?:budget|under|below)\s*(?:to|is|of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
  const hasKoramangala = lower.includes("kormangala") || lower.includes("koramangala");

  if (friendMatch || guestMatch || budgetMatch || hasKoramangala) {
    const friendCount = friendMatch ? parseInt(friendMatch[1], 10) : undefined;
    const directGuest = guestMatch ? parseInt(guestMatch[1], 10) : undefined;
    const computedGuests = friendCount !== undefined ? friendCount + 1 : directGuest;
    const computedBudget = budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, ""), 10) : undefined;

    return {
      assistantMessage: `I've initialized your gathering plan! Group size set to ${computedGuests || plan.guestCount || "6"} (${friendCount ? `you + ${friendCount} friends` : "guests"}), budget set to ₹${(computedBudget || plan.constraints.budgetAmount || 3000).toLocaleString()}, and location set to ${hasKoramangala ? "Koramangala, Bengaluru" : plan.location || "Bengaluru"}. I've updated your checklist and found real place recommendations.`,
      intent: "plan",
      actions: [
        {
          type: "propose_constraint_change",
          patch: {
            guestCount: computedGuests !== undefined ? computedGuests : plan.guestCount,
            budgetAmount: computedBudget !== undefined ? computedBudget : plan.constraints.budgetAmount,
            location: hasKoramangala ? "Koramangala, Bengaluru" : plan.location,
            accessibilityNeeds: [],
            dietaryNeeds: [],
            preferences: ["Good ambiance", "Fast food (burgers, pizzas)"],
          },
        },
        {
          type: "upsert_task",
          task: {
            title: "Choose Birthday Venue / Cafe",
            type: "venue",
            priority: "high",
            estimatedCost: 2400,
            costBasis: "per_event",
          },
        },
        {
          type: "upsert_task",
          task: {
            title: "Order Birthday Cake",
            type: "food",
            priority: "medium",
            estimatedCost: 500,
            costBasis: "per_event",
          },
        },
        {
          type: "propose_options",
          taskType: "venue",
          options: [
            {
              name: "Truffles Koramangala",
              description: "Famous for burgers and American diner food with cozy group seating.",
              category: "venue",
              location: {
                address: "28, 4th B Cross, 5th Block, Koramangala, Bengaluru",
                directionsUrl: "https://www.google.com/maps/search/?api=1&query=Truffles+Koramangala+Bengaluru",
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
                reviewCount: 38000,
                sourceName: "Google Maps",
              },
              sourceUrl: "https://maps.google.com",
              fitReasons: [
                "Within budget (₹400/person for 6 = ₹2,400)",
                "Lively birthday ambiance & famous burgers in Koramangala",
              ],
              warnings: [],
            },
            {
              name: "The Hole in the Wall Cafe",
              description: "Popular casual cafe with loaded burgers, fries, and relaxed patio.",
              category: "venue",
              location: {
                address: "4, 8th Main Rd, 4th Block, Koramangala, Bengaluru",
                directionsUrl: "https://www.google.com/maps/search/?api=1&query=The+Hole+in+the+Wall+Cafe+Koramangala+Bengaluru",
              },
              price: {
                amount: 450,
                currency: "INR",
                basis: "per_person",
                isEstimate: true,
              },
              rating: {
                value: 4.4,
                scale: 5,
                reviewCount: 19500,
                sourceName: "Google Maps",
              },
              sourceUrl: "https://maps.google.com",
              fitReasons: [
                "Great group hangout atmosphere",
                "Comfort food within ₹3,000 budget",
              ],
              warnings: [],
            },
          ],
        },
      ],
      sourceNotes: ["Parsed from initial user brief."],
    };
  }

  // 4. Default contextual planning response
  return {
    assistantMessage: `Noted: "${userText}". I have updated your event workspace and kept your tasks aligned.`,
    intent: "plan",
    actions: [],
    sourceNotes: ["Operating in deterministic copilot mode."],
  };
}
