import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  EventPlanSchema,
  AgentProposal,
} from "@/lib/types/plan";
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from "@/lib/gemini/client";
import { buildSystemInstruction } from "@/lib/gemini/prompts";
import { calculateBudgetSummary } from "@/lib/planning/budget";
import {
  extractGroundingMetadata,
  normalizeGroundedOption,
  shouldTriggerSearchGrounding,
  findMatchingGroundingSource,
  GroundingExtraction,
} from "@/lib/gemini/grounding";
import { parseModelResponseIntelligently } from "@/lib/gemini/parser";
import { checkCooldownRateLimit } from "@/lib/rate-limit/cooldown";
import { generateOfflineProposal } from "@/lib/planning/offline-copilot";
import { applyProposalActions } from "@/lib/planning/proposal-actions";
import { calculateTokenCost } from "@/lib/observability/cost-calculator";

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1, "Message cannot be empty").max(4000, "Message exceeds 4000 character limit"),
      })
    )
    .min(1, "At least one message is required")
    .max(50, "Conversation history cannot exceed 50 turns"),
  currentPlan: EventPlanSchema,
  clientContext: z
    .object({
      timezone: z.string().max(100).optional(),
      dateIso: z.string().max(50).optional(),
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

    // Cooldown & Rate Limiting Enforcement (15 RPM -> 4s cooldown)
    // Only permit bypass during automated Vitest runs (NODE_ENV === "test") or with configured admin secret
    const adminBypassSecret = process.env.COOLDOWN_BYPASS_SECRET;
    const isTestEnvironment = process.env.NODE_ENV === "test";
    const bypassRequested = req.headers.get("x-bypass-cooldown");
    const bypassCooldown =
      (isTestEnvironment && bypassRequested === "true") ||
      Boolean(adminBypassSecret && bypassRequested === adminBypassSecret);

    // Derive client identity securely from trusted forwarding or socket, avoiding client-spoofed IDs
    const forwardedHeader = req.headers.get("x-forwarded-for");
    const rawClientIp = forwardedHeader ? forwardedHeader.split(",")[0]?.trim() : undefined;
    const clientId = rawClientIp || req.headers.get("x-real-ip") || "client-local";

    if (!bypassCooldown) {
      const cooldownCheck = checkCooldownRateLimit(clientId);
      if (!cooldownCheck.allowed) {
        const isDaily = cooldownCheck.reason === "daily_limit";
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            reason: isDaily ? "daily_limit_exceeded" : "cooldown_active",
            message: isDaily
              ? `Daily Free Tier Limit Reached: 500 requests per day limit reached for ${DEFAULT_GEMINI_MODEL}. Resets at 00:00 UTC.`
              : `Free Tier Cooldown: Please wait ${cooldownCheck.retryAfterSeconds}s between requests to respect the 15 RPM limit on ${DEFAULT_GEMINI_MODEL}.`,
            retryAfter: cooldownCheck.retryAfterSeconds,
            rateLimit: {
              model: DEFAULT_GEMINI_MODEL,
              rpm: 15,
              rpd: 500,
              tier: "free",
            },
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(cooldownCheck.retryAfterSeconds),
            },
          }
        );
      }
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

    const startTime = Date.now();
    let telemetry: {
      model: string;
      promptTokens: number | null;
      candidateTokens: number | null;
      toolTokens: number | null;
      totalTokens: number | null;
      latencyMs: number;
      searchGroundingFired: boolean;
      searchGroundingReason: string;
      estimatedCostUsd: number | null;
      usageAvailable: boolean;
      executionMode: "gemini_api" | "offline_demo";
      costEstimationBasis?: string;
    } = {
      model: DEFAULT_GEMINI_MODEL,
      promptTokens: null,
      candidateTokens: null,
      toolTokens: null,
      totalTokens: null,
      latencyMs: 0,
      searchGroundingFired: false,
      searchGroundingReason: "Local intent",
      estimatedCostUsd: null,
      usageAvailable: false,
      executionMode: gemini ? "gemini_api" : "offline_demo",
      costEstimationBasis: "gemini-flash-lite: $0.075/1M input, $0.30/1M output",
    };

    if (!gemini) {
      // Graceful Offline Fallback: Operates when GEMINI_API_KEY is not configured
      proposal = generateOfflineProposal(lastUserMessage, currentPlan);
      telemetry.latencyMs = Date.now() - startTime;
      telemetry.searchGroundingReason = "Offline mock mode";
    } else {
      try {
        // Deterministic Tool Gating: Only invoke Search Grounding when external places/routes are needed
        const shouldSearch = shouldTriggerSearchGrounding(lastUserMessage, currentPlan);
        const systemInstruction = buildSystemInstruction(currentPlan, clientContext, shouldSearch);

        telemetry.searchGroundingReason = shouldSearch
          ? "External discovery query (Grounding enabled)"
          : "Local planning / budget intent (Grounding skipped to save tokens)";

        // History Compaction: Sliding window of recent turns, stripping redundant option dumps
        const recentMessages = messages.slice(-4);
        const promptText = recentMessages
          .map((m) => {
            if (m.role === "assistant") {
              const lines = m.content.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("-"));
              return `GatherWise: ${lines.slice(0, 2).join(" ")}`;
            }
            return `User: ${m.content}`;
          })
          .join("\n\n");

        type GenerateResponse = {
          text?: string;
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
            [key: string]: unknown;
          };
          candidates?: unknown[];
        };

        let response: GenerateResponse;
        try {
          response = (await gemini.models.generateContent({
            model: DEFAULT_GEMINI_MODEL,
            contents: promptText,
            config: {
              systemInstruction,
              temperature: 0.2,
              ...(shouldSearch ? { tools: [{ googleSearch: {} }] } : {}),
            },
          })) as unknown as GenerateResponse;
        } catch (callErr: unknown) {
          const callErrObj = callErr as { status?: number; message?: string } | null;
          // If Search Grounding threw 429 quota exhaustion, gracefully retry WITHOUT tools
          if (
            shouldSearch &&
            (callErrObj?.status === 429 ||
              String(callErr).includes("429") ||
              String(callErr).includes("RESOURCE_EXHAUSTED"))
          ) {
            console.warn(
              "[GatherWise Observability] Search Grounding quota hit 429; falling back to direct model generation."
            );
            telemetry.searchGroundingReason =
              "Search Grounding quota exhausted (429); gracefully degraded to direct generation";
            const fallbackInstruction = buildSystemInstruction(currentPlan, clientContext, false);
            response = (await gemini.models.generateContent({
              model: DEFAULT_GEMINI_MODEL,
              contents: promptText,
              config: {
                systemInstruction: fallbackInstruction,
                temperature: 0.2,
              },
            })) as unknown as GenerateResponse;
          } else {
            throw callErr;
          }
        }

        groundingData = extractGroundingMetadata(response);

        // Observability Metrics Extraction
        const latency = Date.now() - startTime;
        const usage = response.usageMetadata;
        const promptTokens = typeof usage?.promptTokenCount === "number" ? usage.promptTokenCount : null;
        const candidateTokens = typeof usage?.candidatesTokenCount === "number" ? usage.candidatesTokenCount : null;
        const toolTokens = typeof usage?.toolUsePromptTokenCount === "number" ? usage.toolUsePromptTokenCount : null;
        const totalTokens = typeof usage?.totalTokenCount === "number" ? usage.totalTokenCount : null;

        if (promptTokens !== null && candidateTokens !== null) {
          telemetry.usageAvailable = true;
          telemetry.promptTokens = promptTokens;
          telemetry.candidateTokens = candidateTokens;
          telemetry.toolTokens = toolTokens ?? 0;
          telemetry.totalTokens = totalTokens ?? (promptTokens + candidateTokens + (toolTokens ?? 0));

          const configuredTier = (process.env.GEMINI_BILLING_TIER === "paid" ? "paid" : "free") as "free" | "paid";
          const costResult = calculateTokenCost({
            model: DEFAULT_GEMINI_MODEL,
            promptTokens: telemetry.promptTokens,
            candidateTokens: telemetry.candidateTokens,
            searchGroundingFired: groundingData.isGrounded,
            tier: configuredTier,
          });

          telemetry.estimatedCostUsd = costResult.estimatedCostUsd;
          telemetry.costEstimationBasis = costResult.pricingBasis;
        } else {
          telemetry.usageAvailable = false;
          telemetry.promptTokens = null;
          telemetry.candidateTokens = null;
          telemetry.toolTokens = null;
          telemetry.totalTokens = null;
          telemetry.estimatedCostUsd = null;
          telemetry.costEstimationBasis = "Usage metadata not observed from model response";
        }
        telemetry.latencyMs = latency;
        telemetry.searchGroundingFired = groundingData.isGrounded;

        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[GatherWise Observability] Model: ${telemetry.model} | Mode: ${telemetry.executionMode} | Measured: ${telemetry.usageAvailable} | Prompt: ${telemetry.promptTokens ?? "N/A"} | Tool/Search: ${telemetry.toolTokens ?? "N/A"} | Output: ${telemetry.candidateTokens ?? "N/A"} | Total: ${telemetry.totalTokens ?? "N/A"} | Latency: ${telemetry.latencyMs}ms | Grounded: ${telemetry.searchGroundingFired}`
          );
        }

        const rawText = response.text || "";
        proposal = parseModelResponseIntelligently(rawText, currentPlan, groundingData);

        // Normalize proposed options with honest source attribution
        proposal.actions = proposal.actions.map((act) => {
          if (act.type === "propose_options") {
            const normalizedOptions = act.options.map((opt) => {
              const matchedSource = findMatchingGroundingSource(
                opt.name,
                opt.sourceUrl,
                groundingData.sources
              );
              return normalizeGroundedOption(opt, currentPlan.location, matchedSource);
            });
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
      } catch (geminiError: unknown) {
        console.error("Gemini API call failed:", geminiError);
        const errObj = geminiError as { status?: number; message?: string } | null;
        const isRateLimit =
          errObj?.status === 429 ||
          String(geminiError).includes("429") ||
          String(geminiError).includes("RESOURCE_EXHAUSTED");

        proposal = {
          assistantMessage: isRateLimit
            ? `Google Gemini Free Tier rate limit reached (15 RPM / 500 RPD). Please wait 4 seconds before sending your next request. Your current plan and tasks are fully preserved.`
            : "I experienced a temporary connection issue reaching the Gemini API. Your current plan and tasks are preserved.",
          intent: "explain",
          suggestedAnswers: isRateLimit ? ["Wait and retry", "View Final Event Hub"] : [],
          actions: [],
          sourceNotes: [
            isRateLimit
              ? "Gemini Free Tier 429 rate limit hit; waiting for cooldown window."
              : "AI service unreachable; local state preserved.",
          ],
        };
        telemetry.latencyMs = Date.now() - startTime;
      }
    }

    // Apply structured proposal actions deterministically
    const { updatedPlan } = applyProposalActions(currentPlan, proposal);
    const budgetSummary = calculateBudgetSummary(updatedPlan);

    return NextResponse.json({
      assistantMessage: proposal.assistantMessage,
      intent: proposal.intent,
      followUpQuestion: proposal.followUpQuestion,
      suggestedAnswers: proposal.suggestedAnswers || [],
      updatedPlan,
      budgetSummary,
      sourceNotes: proposal.sourceNotes,
      isGrounded: groundingData.isGrounded,
      groundingSources: groundingData.sources,
      webSearchQueries: groundingData.searchQueries,
      telemetry,
    });
  } catch (error: unknown) {
    console.error("Unhandled error in /api/chat:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      {
        error: "Internal server error",
        message,
      },
      { status: 500 }
    );
  }
}
