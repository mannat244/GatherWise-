import { describe, it, expect } from "vitest";
import { applyConstraintChanges } from "@/lib/planning/change-impact";
import { EventPlan } from "@/lib/types/plan";

describe("Constraint Change & Impact Engine", () => {
  const initialPlan: EventPlan = {
    id: "plan-1",
    version: 1,
    title: "Weekend Get-together",
    timezone: "Asia/Kolkata",
    guestCount: 10,
    location: "Koramangala, Bengaluru",
    date: "2026-10-25",
    constraints: {
      budgetAmount: 10000,
      currency: "INR",
      contingencyPercent: 10,
      dietaryNeeds: [],
      accessibilityNeeds: [],
      preferences: [],
      exclusions: [],
    },
    tasks: [
      {
        id: "task-food",
        title: "Buffet Lunch",
        type: "food",
        status: "in_progress",
        estimatedCost: 500,
        costBasis: "per_person",
        currency: "INR",
        dependsOn: [],
        options: [],
        userEdited: false,
        provenance: [],
        lastUpdatedAt: "2026-10-22T10:00:00Z",
      },
      {
        id: "task-decor",
        title: "Custom Photo Booth",
        type: "decoration",
        status: "completed",
        estimatedCost: 2000,
        costBasis: "per_event",
        currency: "INR",
        dependsOn: [],
        options: [],
        userEdited: true, // explicit user edit
        provenance: [],
        lastUpdatedAt: "2026-10-22T10:00:00Z",
      },
      {
        id: "task-venue",
        title: "Rooftop Terrace",
        type: "venue",
        status: "option_selected",
        selectedOptionId: "opt-1",
        options: [
          {
            id: "opt-1",
            name: "Skydeck Lounge",
            status: "selected",
            provenance: [],
            fitReasons: [],
            warnings: [],
          },
        ],
        userEdited: false,
        provenance: [],
        lastUpdatedAt: "2026-10-22T10:00:00Z",
      },
    ],
    createdAt: "2026-10-22T10:00:00Z",
    updatedAt: "2026-10-22T10:00:00Z",
  };

  it("recalculates per-person costs when guest count changes and preserves user edits & completed tasks", () => {
    // Guest count changes from 10 to 20
    const { updatedPlan, impact } = applyConstraintChanges(
      initialPlan,
      { guestCount: 20 },
      "2026-10-22T12:00:00Z"
    );

    expect(updatedPlan.guestCount).toBe(20);
    expect(updatedPlan.version).toBe(2);
    expect(impact.changedFields).toContain("guestCount");

    // Food task is affected
    expect(impact.affectedTaskIds).toContain("task-food");

    // Completed task and user-edited task are preserved
    expect(impact.preservedTaskIds).toContain("task-decor");
    const preservedDecor = updatedPlan.tasks.find((t) => t.id === "task-decor");
    expect(preservedDecor?.status).toBe("completed");
    expect(preservedDecor?.userEdited).toBe(true);

    // Initial planned: (500*10) + 2000 = 7000
    // New planned: (500*20) + 2000 = 12000
    expect(impact.budgetImpact?.previousPlanned).toBe(7000);
    expect(impact.budgetImpact?.newPlanned).toBe(12000);
    expect(impact.budgetImpact?.isNowOverBudget).toBe(true); // 12000 > 10000
  });

  it("flags venue tasks when location changes", () => {
    const { updatedPlan, impact } = applyConstraintChanges(
      initialPlan,
      { location: "Indiranagar, Bengaluru" },
      "2026-10-22T12:00:00Z"
    );

    expect(updatedPlan.location).toBe("Indiranagar, Bengaluru");
    expect(impact.changedFields).toContain("location");
    expect(impact.affectedTaskIds).toContain("task-venue");
    expect(impact.warnings.some((w) => w.includes("previous location"))).toBe(true);
  });

  it("detects budget reduction and generates appropriate over-budget warnings", () => {
    const { updatedPlan, impact } = applyConstraintChanges(
      initialPlan,
      { budgetAmount: 6000 }, // planned was 7000
      "2026-10-22T12:00:00Z"
    );

    expect(updatedPlan.constraints.budgetAmount).toBe(6000);
    expect(impact.budgetImpact?.isNowOverBudget).toBe(true);
    expect(impact.warnings.some((w) => w.includes("over budget"))).toBe(true);
  });
});
