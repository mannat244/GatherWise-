import { describe, it, expect } from "vitest";
import {
  canTransitionTask,
  transitionTaskStatus,
  selectTaskOption,
  areTaskDependenciesMet,
} from "@/lib/planning/task-state";
import { PlanningTask } from "@/lib/types/plan";

describe("Task State Lifecycle", () => {
  const baseTask: PlanningTask = {
    id: "task-1",
    title: "Reserve Birthday Venue",
    type: "venue",
    status: "todo",
    priority: "high",
    dependsOn: [],
    options: [
      {
        id: "opt-1",
        name: "Cozy Garden Cafe",
        status: "suggested",
        provenance: [{ kind: "verified_source" }],
        fitReasons: ["Fits 12 people comfortably"],
        warnings: [],
      },
      {
        id: "opt-2",
        name: "Downtown Lounge",
        status: "suggested",
        provenance: [{ kind: "verified_source" }],
        fitReasons: [],
        warnings: [],
      },
    ],
    userEdited: false,
    provenance: [],
    lastUpdatedAt: "2026-10-22T10:00:00Z",
  };

  it("permits valid linear task status transitions", () => {
    expect(canTransitionTask("todo", "in_progress")).toBe(true);
    expect(canTransitionTask("in_progress", "options_available")).toBe(true);
    expect(canTransitionTask("options_available", "option_selected")).toBe(true);
    expect(canTransitionTask("option_selected", "completed")).toBe(true);
  });

  it("rejects illegal transitions (e.g. jumping directly from todo to completed)", () => {
    expect(canTransitionTask("todo", "completed")).toBe(false);
    expect(() => transitionTaskStatus(baseTask, "completed")).toThrowError(/Invalid task status transition/);
  });

  it("selects an option, assigns selectedOptionId, and sets status to option_selected", () => {
    const updated = selectTaskOption(baseTask, "opt-1", "2026-10-22T12:00:00Z");

    expect(updated.status).toBe("option_selected");
    expect(updated.selectedOptionId).toBe("opt-1");
    expect(updated.lastUpdatedAt).toBe("2026-10-22T12:00:00Z");

    const selectedOpt = updated.options.find((o) => o.id === "opt-1");
    const otherOpt = updated.options.find((o) => o.id === "opt-2");
    expect(selectedOpt?.status).toBe("selected");
    expect(otherOpt?.status).toBe("suggested");
  });

  it("throws when selecting a non-existent option", () => {
    expect(() => selectTaskOption(baseTask, "non-existent-opt")).toThrowError(/not found/);
  });

  it("evaluates task dependencies correctly", () => {
    const taskA: PlanningTask = { ...baseTask, id: "task-A", status: "completed" };
    const taskB: PlanningTask = { ...baseTask, id: "task-B", status: "in_progress", dependsOn: ["task-A"] };
    const taskC: PlanningTask = { ...baseTask, id: "task-C", status: "todo", dependsOn: ["task-B"] };

    expect(areTaskDependenciesMet(taskB, [taskA, taskB]).isMet).toBe(true);
    const depCheckC = areTaskDependenciesMet(taskC, [taskA, taskB, taskC]);
    expect(depCheckC.isMet).toBe(false);
    expect(depCheckC.missingDependencyIds).toContain("task-B");
  });
});
