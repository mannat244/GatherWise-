import { describe, it, expect } from "vitest";
import { calculateBudgetSummary, formatCurrency } from "@/lib/planning/budget";
import { EventPlan } from "@/lib/types/plan";

describe("Budget Engine", () => {
  const basePlan: EventPlan = {
    id: "plan-1",
    version: 1,
    title: "10th Birthday Party",
    timezone: "Asia/Kolkata",
    guestCount: 12,
    constraints: {
      budgetAmount: 5000,
      currency: "INR",
      contingencyPercent: 10,
      dietaryNeeds: [],
      accessibilityNeeds: [],
      preferences: [],
      exclusions: [],
    },
    tasks: [],
    createdAt: "2026-10-22T10:00:00Z",
    updatedAt: "2026-10-22T10:00:00Z",
  };

  it("calculates contingency reserve and spendable budget correctly", () => {
    const summary = calculateBudgetSummary(basePlan);
    expect(summary.totalBudget).toBe(5000);
    expect(summary.contingencyPercent).toBe(10);
    expect(summary.contingencyAmount).toBe(500); // 10% of 5000
    expect(summary.spendableBudget).toBe(4500);
    expect(summary.isOverBudget).toBe(false);
  });

  it("calculates per-person costs dynamically according to guest count", () => {
    const planWithFood: EventPlan = {
      ...basePlan,
      guestCount: 12,
      tasks: [
        {
          id: "task-food",
          title: "Birthday Snacks & Cake",
          type: "food",
          status: "todo",
          priority: "high",
          estimatedCost: 250,
          costBasis: "per_person",
          currency: "INR",
          dependsOn: [],
          options: [],
          userEdited: false,
          provenance: [],
          lastUpdatedAt: "2026-10-22T10:00:00Z",
        },
      ],
    };

    const summary = calculateBudgetSummary(planWithFood);
    // 250 * 12 = 3000
    expect(summary.estimatedSpend).toBe(3000);
    expect(summary.committedSpend).toBe(0);
    expect(summary.totalPlannedSpend).toBe(3000);
    expect(summary.remainingSpend).toBe(2000);
    expect(summary.lineItems[0].amount).toBe(3000);
    expect(summary.lineItems[0].formula).toContain("12 guests");
  });

  it("reconciles committed spend when an option is selected", () => {
    const planWithSelectedVenue: EventPlan = {
      ...basePlan,
      tasks: [
        {
          id: "task-venue",
          title: "Book Community Hall",
          type: "venue",
          status: "option_selected",
          selectedOptionId: "opt-venue-1",
          dependsOn: [],
          options: [
            {
              id: "opt-venue-1",
              name: "Maple Community Hall",
              status: "selected",
              price: {
                amount: 3500,
                currency: "INR",
                basis: "per_event",
                isEstimate: false,
              },
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
    };

    const summary = calculateBudgetSummary(planWithSelectedVenue);
    expect(summary.committedSpend).toBe(3500);
    expect(summary.estimatedSpend).toBe(0);
    expect(summary.totalPlannedSpend).toBe(3500);
    expect(summary.remainingSpend).toBe(1500);
    expect(summary.isOverBudget).toBe(false);
  });

  it("flags budget overage correctly when total spend exceeds budget", () => {
    const overBudgetPlan: EventPlan = {
      ...basePlan,
      constraints: {
        ...basePlan.constraints,
        budgetAmount: 3000,
      },
      tasks: [
        {
          id: "task-1",
          title: "Venue",
          type: "venue",
          status: "todo",
          estimatedCost: 3500,
          costBasis: "per_event",
          currency: "INR",
          dependsOn: [],
          options: [],
          userEdited: false,
          provenance: [],
          lastUpdatedAt: "2026-10-22T10:00:00Z",
        },
      ],
    };

    const summary = calculateBudgetSummary(overBudgetPlan);
    expect(summary.isOverBudget).toBe(true);
    expect(summary.overageAmount).toBe(500);
    expect(summary.remainingSpend).toBe(-500);
  });

  it("formats currency correctly", () => {
    const formatted = formatCurrency(5000, "INR");
    expect(formatted).toContain("5,000");
  });
});
