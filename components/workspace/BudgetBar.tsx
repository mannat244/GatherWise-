"use client";

import React from "react";
import { BudgetSummary } from "@/lib/types/plan";
import { formatCurrency } from "@/lib/planning/budget";
import { AlertCircle, ShieldCheck } from "lucide-react";

interface BudgetBarProps {
  summary: BudgetSummary;
}

export function BudgetBar({ summary }: BudgetBarProps) {
  const {
    totalBudget,
    committedSpend,
    estimatedSpend,
    contingencyAmount,
    totalPlannedSpend,
    remainingSpend,
    isOverBudget,
    overageAmount,
    currency,
  } = summary;

  const budgetSafe = totalBudget > 0 ? totalBudget : 1;
  const committedPercent = Math.min(100, Math.round((committedSpend / budgetSafe) * 100));
  const estimatedPercent = Math.min(
    100 - committedPercent,
    Math.round((estimatedSpend / budgetSafe) * 100)
  );
  const contingencyPercent = Math.min(
    100 - committedPercent - estimatedPercent,
    Math.round((contingencyAmount / budgetSafe) * 100)
  );

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
      {/* Header Numbers */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Total Budget
          </span>
          <div className="text-2xl font-bold tracking-tight text-stone-900">
            {formatCurrency(totalBudget, currency)}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs sm:text-sm">
          <div>
            <span className="text-stone-500">Planned Spend: </span>
            <span className="font-semibold text-stone-800">
              {formatCurrency(totalPlannedSpend, currency)}
            </span>
          </div>
          <div className="border-l border-stone-200 pl-4">
            <span className="text-stone-500">Remaining: </span>
            <span
              className={`font-semibold ${
                remainingSpend < 0 ? "text-rose-600 font-bold" : "text-emerald-700"
              }`}
            >
              {formatCurrency(remainingSpend, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Stacked Progress Bar */}
      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-valuenow={Math.min(100, Math.round((totalPlannedSpend / budgetSafe) * 100))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Budget allocation progress"
      >
        <div className="flex h-full w-full">
          {/* Committed spend */}
          <div
            style={{ width: `${committedPercent}%` }}
            className="bg-emerald-600 transition-all duration-300"
            title={`Committed: ${formatCurrency(committedSpend, currency)}`}
          />
          {/* Estimated spend */}
          <div
            style={{ width: `${estimatedPercent}%` }}
            className="bg-amber-500 transition-all duration-300"
            title={`Estimated: ${formatCurrency(estimatedSpend, currency)}`}
          />
          {/* Contingency buffer */}
          <div
            style={{ width: `${contingencyPercent}%` }}
            className="bg-indigo-400 transition-all duration-300 opacity-60"
            title={`Contingency reserve: ${formatCurrency(contingencyAmount, currency)}`}
          />
        </div>
      </div>

      {/* Legend & Buffers */}
      <div className="flex flex-wrap items-center justify-between text-xs text-stone-600 gap-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Committed ({formatCurrency(committedSpend, currency)})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Estimated ({formatCurrency(estimatedSpend, currency)})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-400 opacity-60" />
            Contingency ({summary.contingencyPercent}%)
          </span>
        </div>

        <div className="flex items-center gap-1 text-stone-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Deterministic math</span>
        </div>
      </div>

      {/* Over budget banner */}
      {isOverBudget && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>
            <strong>Budget Overrun:</strong> Estimated spend exceeds budget by{" "}
            <strong>{formatCurrency(overageAmount, currency)}</strong>. Consider adjusting
            per-person allocations or task priorities.
          </span>
        </div>
      )}
    </div>
  );
}
