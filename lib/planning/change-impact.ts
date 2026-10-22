import { EventPlan, PlanConstraints, PlanningTask } from "@/lib/types/plan";
import { calculateBudgetSummary, formatCurrency } from "./budget";

export interface ConstraintUpdate {
  budgetAmount?: number;
  currency?: string;
  guestCount?: number;
  date?: string;
  location?: string;
  dietaryNeeds?: string[];
  accessibilityNeeds?: string[];
  preferences?: string[];
}

export interface ChangeImpactSummary {
  changedFields: string[];
  budgetImpact?: {
    previousBudget: number;
    newBudget: number;
    previousPlanned: number;
    newPlanned: number;
    isNowOverBudget: boolean;
  };
  guestCountImpact?: {
    previousCount?: number;
    newCount?: number;
  };
  affectedTaskIds: string[];
  preservedTaskIds: string[];
  explanations: string[];
  warnings: string[];
}

/**
 * Applies constraint updates while deterministically preserving completed tasks,
 * user edits, and unrelated decisions.
 */
export function applyConstraintChanges(
  currentPlan: EventPlan,
  updates: ConstraintUpdate,
  nowIso: string = new Date().toISOString()
): { updatedPlan: EventPlan; impact: ChangeImpactSummary } {
  const changedFields: string[] = [];
  const explanations: string[] = [];
  const warnings: string[] = [];
  const affectedTaskIds = new Set<string>();
  const preservedTaskIds = new Set<string>();

  const previousBudgetSummary = calculateBudgetSummary(currentPlan);

  // 1. Build updated constraints
  const updatedConstraints: PlanConstraints = {
    ...currentPlan.constraints,
  };

  if (updates.budgetAmount !== undefined && updates.budgetAmount !== currentPlan.constraints.budgetAmount) {
    changedFields.push("budgetAmount");
    explanations.push(
      `Budget updated from ${formatCurrency(currentPlan.constraints.budgetAmount ?? 0, currentPlan.constraints.currency)} to ${formatCurrency(updates.budgetAmount, currentPlan.constraints.currency)}`
    );
    updatedConstraints.budgetAmount = updates.budgetAmount;
  }

  if (updates.currency && updates.currency !== currentPlan.constraints.currency) {
    changedFields.push("currency");
    updatedConstraints.currency = updates.currency;
  }

  if (updates.dietaryNeeds !== undefined) {
    changedFields.push("dietaryNeeds");
    updatedConstraints.dietaryNeeds = [...updates.dietaryNeeds];
    explanations.push(
      updates.dietaryNeeds.length > 0
        ? `Dietary requirements updated: ${updatedConstraints.dietaryNeeds.join(", ")}`
        : "Dietary requirements cleared."
    );
  }

  if (updates.accessibilityNeeds !== undefined) {
    changedFields.push("accessibilityNeeds");
    updatedConstraints.accessibilityNeeds = [...updates.accessibilityNeeds];
    explanations.push(
      updates.accessibilityNeeds.length > 0
        ? `Accessibility requirements updated: ${updatedConstraints.accessibilityNeeds.join(", ")}`
        : "Accessibility requirements cleared."
    );
  }

  if (updates.preferences !== undefined) {
    changedFields.push("preferences");
    updatedConstraints.preferences = [...updates.preferences];
  }

  // 2. Identify top-level event changes
  let nextGuestCount = currentPlan.guestCount;
  if (updates.guestCount !== undefined && updates.guestCount !== currentPlan.guestCount) {
    changedFields.push("guestCount");
    explanations.push(`Guest count adjusted from ${currentPlan.guestCount ?? "unspecified"} to ${updates.guestCount}`);
    nextGuestCount = updates.guestCount;
  }

  let nextLocation = currentPlan.location;
  if (updates.location !== undefined && updates.location !== currentPlan.location) {
    changedFields.push("location");
    explanations.push(`Event location changed to '${updates.location}'`);
    nextLocation = updates.location;
  }

  let nextDate = currentPlan.date;
  if (updates.date !== undefined && updates.date !== currentPlan.date) {
    changedFields.push("date");
    explanations.push(`Event date shifted to ${updates.date}`);
    nextDate = updates.date;
  }

  // 3. Scan tasks and classify affected vs preserved
  const updatedTasks: PlanningTask[] = currentPlan.tasks.map((task) => {
    let isTaskAffected = false;

    // Check if task is sensitive to guest count
    const hasPerPersonRate =
      task.costBasis === "per_person" ||
      task.options.some((opt) => opt.price?.basis === "per_person");

    if (updates.guestCount !== undefined && (hasPerPersonRate || task.type === "food" || task.type === "venue")) {
      isTaskAffected = true;
      affectedTaskIds.add(task.id);
    }

    // Check if task is sensitive to location
    if (updates.location !== undefined && (task.type === "venue" || task.type === "activity" || task.type === "travel")) {
      isTaskAffected = true;
      affectedTaskIds.add(task.id);
      // Mark options with warning if user has selected a venue in the old location
      if (task.selectedOptionId) {
        warnings.push(`Selected option for '${task.title}' was chosen under previous location and may need review.`);
      }
    }

    // Check if dietary needs affect food tasks
    if (updates.dietaryNeeds && task.type === "food") {
      isTaskAffected = true;
      affectedTaskIds.add(task.id);
    }

    // Protect completed or user-edited tasks
    if (task.status === "completed" || task.userEdited) {
      preservedTaskIds.add(task.id);
      // Even if affected by math, user's explicit status is preserved
      return task;
    }

    if (!isTaskAffected) {
      preservedTaskIds.add(task.id);
    }

    return task;
  });

  const candidatePlan: EventPlan = {
    ...currentPlan,
    version: currentPlan.version + 1,
    date: nextDate,
    location: nextLocation,
    guestCount: nextGuestCount,
    constraints: updatedConstraints,
    tasks: updatedTasks,
    updatedAt: nowIso,
  };

  const newBudgetSummary = calculateBudgetSummary(candidatePlan);

  if (newBudgetSummary.isOverBudget) {
    warnings.push(
      `Plan is over budget by ${formatCurrency(newBudgetSummary.overageAmount, newBudgetSummary.currency)} (Total planned: ${formatCurrency(newBudgetSummary.totalPlannedSpend, newBudgetSummary.currency)}, Budget: ${formatCurrency(newBudgetSummary.totalBudget, newBudgetSummary.currency)})`
    );
  }

  const impact: ChangeImpactSummary = {
    changedFields,
    budgetImpact: {
      previousBudget: previousBudgetSummary.totalBudget,
      newBudget: newBudgetSummary.totalBudget,
      previousPlanned: previousBudgetSummary.totalPlannedSpend,
      newPlanned: newBudgetSummary.totalPlannedSpend,
      isNowOverBudget: newBudgetSummary.isOverBudget,
    },
    guestCountImpact: {
      previousCount: currentPlan.guestCount,
      newCount: nextGuestCount,
    },
    affectedTaskIds: Array.from(affectedTaskIds),
    preservedTaskIds: Array.from(preservedTaskIds),
    explanations,
    warnings,
  };

  return { updatedPlan: candidatePlan, impact };
}
