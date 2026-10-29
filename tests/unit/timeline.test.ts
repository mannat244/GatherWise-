import { describe, it, expect } from "vitest";
import { assessTimeline } from "@/lib/planning/timeline";
import { EventPlan } from "@/lib/types/plan";

describe("Timeline Engine", () => {
  const plan: EventPlan = {
    id: "plan-1",
    version: 1,
    title: "Dinner Party",
    timezone: "Asia/Kolkata",
    date: "2026-10-25",
    constraints: {
      currency: "INR",
      contingencyPercent: 10,
      dietaryNeeds: [],
      accessibilityNeeds: [],
      preferences: [],
      exclusions: [],
    },
    tasks: [
      {
        id: "task-1",
        title: "Send Invites",
        type: "logistics",
        status: "todo",
        priority: "urgent",
        costBasis: "per_event",
        currency: "INR",
        dueDate: "2026-10-20", // overdue relative to 2026-10-22
        dependsOn: [],
        options: [],
        userEdited: false,
        provenance: [],
        lastUpdatedAt: "2026-10-22T10:00:00Z",
      },
      {
        id: "task-2",
        title: "Buy Wine",
        type: "product",
        status: "todo",
        priority: "medium",
        costBasis: "per_event",
        currency: "INR",
        dueDate: "2026-10-24",
        dependsOn: [],
        options: [],
        userEdited: false,
        provenance: [],
        lastUpdatedAt: "2026-10-22T10:00:00Z",
      },
    ],
    createdAt: "2026-10-22T10:00:00Z",
    updatedAt: "2026-10-22T10:00:00Z",
  };

  it("identifies overdue tasks and days until event", () => {
    const assessment = assessTimeline(plan, "2026-10-22T12:00:00Z");

    expect(assessment.daysUntilEvent).toBe(3);
    expect(assessment.isPastEvent).toBe(false);
    expect(assessment.overdueTasks.length).toBe(1);
    expect(assessment.overdueTasks[0].id).toBe("task-1");
    expect(assessment.timelineWarnings.some((w) => w.includes("overdue"))).toBe(true);
  });

  it("flags past events", () => {
    const pastPlan: EventPlan = {
      ...plan,
      date: "2026-10-15",
    };

    const assessment = assessTimeline(pastPlan, "2026-10-22T12:00:00Z");
    expect(assessment.isPastEvent).toBe(true);
    expect(assessment.timelineWarnings.some((w) => w.includes("in the past"))).toBe(true);
  });
});
