import {
  EventPlan,
  AgentProposal,
  PlanningTask,
  PlanningOption,
  TaskType,
} from "@/lib/types/plan";
import { selectTaskOption } from "@/lib/planning/task-state";
import { applyConstraintChanges } from "@/lib/planning/change-impact";
import { normalizeGroundedOption } from "@/lib/gemini/grounding";

/**
 * Deterministically applies proposal actions to the event plan.
 */
export function applyProposalActions(
  plan: EventPlan,
  proposal: AgentProposal
): { updatedPlan: EventPlan } {
  let current: EventPlan = { ...plan };
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

      // 2. If not matched, try matching by taskType (e.g. "travel", "activity", "venue", "food")
      const targetType = action.taskType || (action.taskId ? (action.taskId.toLowerCase() as TaskType) : undefined);
      if (taskIndex < 0 && targetType) {
        // Prefer an open task without an already selected/finalized option
        taskIndex = current.tasks.findIndex(
          (t) => t.type === targetType && t.status !== "completed" && !t.selectedOptionId
        );
        // If not found, check if any task of this type exists
        if (taskIndex < 0) {
          taskIndex = current.tasks.findIndex((t) => t.type === targetType);
        }
      }

      // 3. If still not matched, check if an option has a category match
      if (taskIndex < 0) {
        const optionCategory = action.options[0]?.category?.toLowerCase();
        if (optionCategory) {
          taskIndex = current.tasks.findIndex(
            (t) => t.type === optionCategory && t.status !== "completed" && !t.selectedOptionId
          );
          if (taskIndex < 0) {
            taskIndex = current.tasks.findIndex((t) => t.type === optionCategory);
          }
        }
      }

      // 4. If still not matched, check by keywords in title ("venue", "cafe", "food", "travel", "bowling")
      if (taskIndex < 0 && targetType) {
        taskIndex = current.tasks.findIndex((t) =>
          new RegExp(targetType, "i").test(t.title)
        );
      }

      // Preserve already-normalized options and their verified provenance intact
      const normalizedOptions: PlanningOption[] = action.options.map((opt) => {
        if (
          "provenance" in opt &&
          Array.isArray((opt as { provenance?: unknown }).provenance) &&
          ((opt as { provenance: unknown[] }).provenance.length > 0)
        ) {
          return opt as PlanningOption;
        }
        return normalizeGroundedOption(opt, current.location);
      });

      // 5. If NO matching task exists in the plan, AUTO-CREATE it so options are never dropped!
      if (taskIndex < 0) {
        const createdType: TaskType = (targetType as TaskType) || "venue";
        const titleMap: Record<string, string> = {
          travel: "Travel & Commute to Venue",
          activity: "Activity: Bowling & Entertainment",
          food: "Order Food & Snacks",
          product: "Birthday Cake & Treats",
          venue: "Choose Venue / Cafe",
        };
        const hasVerifiedOption = normalizedOptions.some((o) =>
          o.provenance.some((p) => p.kind === "verified_source")
        );
        const autoTask: PlanningTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: titleMap[createdType] || "Explore Options",
          description: "Explore grounded recommendations and select an option.",
          type: createdType,
          status: "options_available",
          priority: "high",
          currency: current.constraints.currency || "INR",
          costBasis: createdType === "travel" ? "per_event" : "per_person",
          options: normalizedOptions,
          dependsOn: [],
          userEdited: false,
          provenance: [
            {
              kind: hasVerifiedOption ? "verified_source" : "estimate",
              note: hasVerifiedOption
                ? "Auto-created to host verified grounded recommendations"
                : "Auto-created to host estimated recommendations",
            },
          ],
          lastUpdatedAt: new Date().toISOString(),
        };
        current.tasks = [autoTask, ...current.tasks];
      } else {
        const existingTask = current.tasks[taskIndex];
        // CRITICAL: If existingTask already has a selectedOptionId, NEVER discard that option!
        const existingSelectedOption = existingTask.selectedOptionId
          ? existingTask.options.find((o) => o.id === existingTask.selectedOptionId)
          : undefined;

        let finalOptions = normalizedOptions;
        if (existingSelectedOption && !finalOptions.some((o) => o.id === existingSelectedOption.id)) {
          finalOptions = [existingSelectedOption, ...finalOptions];
        }

        current.tasks[taskIndex] = {
          ...existingTask,
          options: finalOptions,
          status: existingTask.selectedOptionId
            ? existingTask.status
            : existingTask.status === "todo" || existingTask.status === "in_progress"
            ? "options_available"
            : existingTask.status,
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
