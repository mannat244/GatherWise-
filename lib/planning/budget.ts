import { EventPlan, BudgetSummary, BudgetLineItem, PriceBasis } from "@/lib/types/plan";

/**
 * Deterministically computes the full budget summary from an event plan.
 * Pure function: zero side effects, 100% deterministic arithmetic.
 */
export function calculateBudgetSummary(plan: EventPlan): BudgetSummary {
  const totalBudget = Math.max(0, plan.constraints.budgetAmount ?? 0);
  const currency = plan.constraints.currency || "INR";
  const guestCount = plan.guestCount && plan.guestCount > 0 ? plan.guestCount : 1;
  const contingencyPercent = Math.max(0, Math.min(100, plan.constraints.contingencyPercent ?? 10));

  const contingencyAmount = Math.round((totalBudget * contingencyPercent) / 100);
  const spendableBudget = Math.max(0, totalBudget - contingencyAmount);

  const lineItems: BudgetLineItem[] = [];
  let committedSpend = 0;
  let estimatedSpend = 0;

  for (const task of plan.tasks) {
    // If an option is selected, use the selected option's price
    const selectedOption = task.selectedOptionId
      ? task.options.find((opt) => opt.id === task.selectedOptionId)
      : undefined;

    let itemAmount = 0;
    let basis: PriceBasis = "per_event";
    let isEstimate = true;
    let formula: string | undefined = undefined;
    const isCommitted = task.status === "option_selected" || task.status === "completed";

    if (selectedOption?.price?.amount !== undefined) {
      const rawAmount = selectedOption.price.amount;
      basis = selectedOption.price.basis ?? "per_event";
      isEstimate = selectedOption.price.isEstimate;

      if (basis === "per_person") {
        itemAmount = rawAmount * guestCount;
        formula = `${formatCurrency(rawAmount, currency)}/person × ${guestCount} guests`;
      } else {
        itemAmount = rawAmount;
        formula = formatCurrency(rawAmount, currency);
      }
    } else if (task.estimatedCost !== undefined && task.estimatedCost > 0) {
      const rawCost = task.estimatedCost;
      basis = task.costBasis ?? "per_event";
      isEstimate = true;

      if (basis === "per_person") {
        itemAmount = rawCost * guestCount;
        formula = `${formatCurrency(rawCost, currency)}/person × ${guestCount} guests`;
      } else {
        itemAmount = rawCost;
        formula = formatCurrency(rawCost, currency);
      }
    }

    if (itemAmount > 0) {
      if (isCommitted) {
        committedSpend += itemAmount;
      } else {
        estimatedSpend += itemAmount;
      }

      lineItems.push({
        taskId: task.id,
        taskTitle: task.title,
        type: task.type,
        amount: itemAmount,
        currency,
        isCommitted,
        basis,
        formula,
        isEstimate,
      });
    }
  }

  const totalPlannedSpend = committedSpend + estimatedSpend;
  const remainingSpend = totalBudget - totalPlannedSpend;
  const isOverBudget = totalBudget > 0 && totalPlannedSpend > totalBudget;
  const overageAmount = isOverBudget ? totalPlannedSpend - totalBudget : 0;

  return {
    totalBudget,
    contingencyPercent,
    contingencyAmount,
    spendableBudget,
    committedSpend,
    estimatedSpend,
    totalPlannedSpend,
    remainingSpend,
    isOverBudget,
    overageAmount,
    currency,
    lineItems,
  };
}

/**
 * Formats a monetary value cleanly with proper locale conventions.
 */
export function formatCurrency(amount: number, currency: string = "INR"): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  try {
    if (currency.toUpperCase() === "INR") {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(safeAmount);
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toLocaleString()}`;
  }
}
