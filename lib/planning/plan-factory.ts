import { EventPlan } from "@/lib/types/plan";

/**
 * Creates an empty, valid EventPlan entity with default constraints and timezone.
 * Used for starting fresh events or resetting the workspace.
 */
export function createCleanEventPlan(title: string = "New Event"): EventPlan {
  return {
    id: `plan-${Date.now()}`,
    version: 1,
    title,
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Asia/Kolkata",
    constraints: {
      currency: "INR",
      contingencyPercent: 10,
      dietaryNeeds: [],
      accessibilityNeeds: [],
      preferences: [],
      exclusions: [],
    },
    tasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
