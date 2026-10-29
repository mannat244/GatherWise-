import { EventPlan, EventPlanSchema, ChatMessage, ChatMessageSchema } from "@/lib/types/plan";
import { z } from "zod";

export const STORAGE_KEY_V1 = "gatherwise_plan_v1";

export const StoredEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  plan: EventPlanSchema,
  messages: z.array(ChatMessageSchema).optional(),
  savedAt: z.string(),
});
export type StoredEnvelope = z.infer<typeof StoredEnvelopeSchema>;

/**
 * Persists an event plan and associated conversation history into browser localStorage.
 */
export function savePlanLocally(plan: EventPlan, messages?: ChatMessage[]): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    const envelope: StoredEnvelope = {
      schemaVersion: 1,
      plan,
      messages,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(STORAGE_KEY_V1, JSON.stringify(envelope));
    return true;
  } catch (error) {
    console.error("Failed to save plan to localStorage:", error);
    return false;
  }
}

/**
 * Loads and validates a saved plan envelope from browser localStorage.
 * Returns null if no plan is found or if stored data is corrupted.
 */
export function loadPlanLocally(): { plan: EventPlan; messages?: ChatMessage[] } | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const result = StoredEnvelopeSchema.safeParse(parsed);

    if (!result.success) {
      console.warn("Stored plan failed validation, ignoring corrupted data:", result.error);
      return null;
    }

    return {
      plan: result.data.plan,
      messages: result.data.messages,
    };
  } catch (error) {
    console.warn("Failed to load plan from localStorage:", error);
    return null;
  }
}

/**
 * Removes the saved plan from browser localStorage.
 */
export function clearPlanLocally(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY_V1);
  } catch (error) {
    console.error("Failed to clear localStorage plan:", error);
  }
}

/**
 * Checks if a valid saved plan exists in localStorage.
 */
export function hasSavedPlanLocally(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEY_V1) !== null;
}
