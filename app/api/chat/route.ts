import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  EventPlanSchema,
  EventPlan,
  PlanningTask,
  AgentProposalSchema,
  AgentProposal,
} from "@/lib/types/plan";
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from "@/lib/gemini/client";
import { buildSystemInstruction } from "@/lib/gemini/prompts";
import { calculateBudgetSummary } from "@/lib/planning/budget";
import { applyConstraintChanges } from "@/lib/planning/change-impact";
import { selectTaskOption } from "@/lib/planning/task-state";

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
          },
        });

        const rawText = response.text || "";
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
        const jsonString = (jsonMatch[1] || rawText).trim();

        const parsedJson = JSON.parse(jsonString);
        const proposalResult = AgentProposalSchema.safeParse(parsedJson);

        if (proposalResult.success) {
          proposal = proposalResult.data;
        } else {
          // Fallback if model output deviated from schema
          proposal = {
            assistantMessage: parsedJson.assistantMessage || rawText || "Plan updated.",
            intent: "plan",
            actions: [],
            sourceNotes: ["Model response schema validation had warnings; state protected."],
          };
        }
      } catch (geminiError: any) {
        console.error("Gemini API call failed:", geminiError);
        proposal = {
          assistantMessage:
            "I experienced a temporary connection issue reaching the Gemini API. Your current plan and tasks are preserved.",
          intent: "explain",
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
      const taskIndex = current.tasks.findIndex((t) => t.id === action.taskId);
      if (taskIndex >= 0) {
        current.tasks[taskIndex] = {
          ...current.tasks[taskIndex],
          options: action.options,
          status: current.tasks[taskIndex].status === "todo" ? "options_available" : current.tasks[taskIndex].status,
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

  // 1. Detect Guest Count Change
  const guestMatch = lower.match(/(?:guests?|people)\s*(?:to|is|are|be)?\s*(\d+)/) || lower.match(/(\d+)\s*(?:guests?|people)/);
  if (guestMatch) {
    const newCount = parseInt(guestMatch[1], 10);
    return {
      assistantMessage: `I've updated the guest count to ${newCount}. Per-person estimates have been recalculated, and all of your completed tasks were preserved.`,
      intent: "edit",
      actions: [
        {
          type: "propose_constraint_change",
          patch: { guestCount: newCount },
        },
      ],
      sourceNotes: ["Calculated in deterministic offline copilot mode."],
    };
  }

  // 2. Detect Budget Change
  const budgetMatch = lower.match(/budget\s*(?:to|is|of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
  if (budgetMatch) {
    const newBudget = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
    return {
      assistantMessage: `I've adjusted your total budget to ₹${newBudget.toLocaleString()}. The budget allocation and remaining balance have been updated.`,
      intent: "edit",
      actions: [
        {
          type: "propose_constraint_change",
          patch: { budgetAmount: newBudget },
        },
      ],
      sourceNotes: ["Calculated in deterministic offline copilot mode."],
    };
  }

  // 3. Default contextual planning response
  return {
    assistantMessage: `Noted: "${userText}". I have analyzed your request and aligned your event checklist. You can explore place options in the checklist or proceed to the Final Event Hub.`,
    intent: "plan",
    actions: [],
    sourceNotes: ["Operating in deterministic copilot mode (GEMINI_API_KEY not set)."],
  };
}
