"use client";

import React, { useState } from "react";
import { PlanningTask, TaskStatus } from "@/lib/types/plan";
import { formatCurrency } from "@/lib/planning/budget";
import { OptionCard } from "@/components/options/OptionCard";
import {
  CheckCircle,
  Circle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Tag,
  AlertCircle,
  Building,
  Utensils,
  Sparkles,
  ShoppingBag,
  Briefcase,
  Activity,
  Plane,
  Home,
  Clock,
} from "lucide-react";

interface TaskCardProps {
  task: PlanningTask;
  guestCount?: number;
  currency?: string;
  onToggleComplete: (taskId: string, currentStatus: TaskStatus) => void;
  onSelectOption: (taskId: string, optionId: string) => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  venue: Building,
  food: Utensils,
  decoration: Sparkles,
  product: ShoppingBag,
  vendor: Briefcase,
  activity: Activity,
  travel: Plane,
  accommodation: Home,
  logistics: Clock,
  general: Tag,
};

export function TaskCard({
  task,
  guestCount = 1,
  currency = "INR",
  onToggleComplete,
  onSelectOption,
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(task.options.length > 0 && task.status !== "completed");
  const isCompleted = task.status === "completed";
  const hasOptions = task.options.length > 0;
  const TypeIcon = TYPE_ICONS[task.type] || Tag;

  // Selected option details
  const selectedOption = task.selectedOptionId
    ? task.options.find((opt) => opt.id === task.selectedOptionId)
    : undefined;

  // Cost calculation
  let costLabel: string | null = null;
  if (selectedOption?.price?.amount !== undefined) {
    const raw = selectedOption.price.amount;
    if (selectedOption.price.basis === "per_person") {
      costLabel = `${formatCurrency(raw * guestCount, currency)} (${formatCurrency(raw, currency)}/person × ${guestCount})`;
    } else {
      costLabel = formatCurrency(raw, currency);
    }
  } else if (task.estimatedCost !== undefined && task.estimatedCost > 0) {
    if (task.costBasis === "per_person") {
      costLabel = `${formatCurrency(task.estimatedCost * guestCount, currency)} (est. ${formatCurrency(task.estimatedCost, currency)}/person × ${guestCount})`;
    } else {
      costLabel = `${formatCurrency(task.estimatedCost, currency)} (est)`;
    }
  }

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isCompleted
          ? "border-stone-200 bg-stone-50/70 opacity-80"
          : "border-stone-200 bg-white shadow-sm hover:border-stone-300"
      }`}
    >
      {/* Main Task Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Completion Checkbox */}
        <button
          type="button"
          onClick={() => onToggleComplete(task.id, task.status)}
          className="mt-0.5 shrink-0 rounded-full text-stone-400 hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
          aria-label={isCompleted ? `Mark ${task.title} as incomplete` : `Mark ${task.title} as complete`}
        >
          {isCompleted ? (
            <CheckCircle className="h-5 w-5 text-emerald-600 fill-emerald-100" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>

        {/* Task Details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              <TypeIcon className="h-3 w-3 text-stone-500" />
              <span className="capitalize">{task.type}</span>
            </span>

            {task.priority === "urgent" && (
              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                Urgent
              </span>
            )}
            {task.priority === "high" && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                High Priority
              </span>
            )}

            {task.userEdited && (
              <span className="text-[10px] text-stone-600 font-medium bg-stone-100 px-1.5 py-0.5 rounded">
                Custom edit
              </span>
            )}
          </div>

          <h3
            className={`mt-1 text-base font-semibold leading-snug ${
              isCompleted ? "text-stone-500 line-through" : "text-stone-900"
            }`}
          >
            {task.title}
          </h3>

          {task.description && (
            <p className="mt-1 text-xs text-stone-600 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Meta Information: Due date, Cost, Options Count */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-600">
            {task.dueDate && (
              <div className="inline-flex items-center gap-1 font-medium text-stone-700">
                <Calendar className="h-3.5 w-3.5 text-stone-400" />
                <span>Due: {task.dueDate}</span>
              </div>
            )}

            {costLabel && (
              <div className="font-semibold text-stone-900">
                {costLabel}
              </div>
            )}

            {task.status === "option_selected" && selectedOption && (
              <div className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <span>Selected: <strong>{selectedOption.name}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Expand / Collapse Options Button */}
        {hasOptions && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} options for ${task.title}`}
          >
            <span>{task.options.length} options</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Expandable Options Drawer */}
      {isExpanded && hasOptions && (
        <div className="border-t border-stone-100 bg-stone-50/50 p-4 rounded-b-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
              Real-World Recommendations ({task.options.length})
            </span>
            <span className="text-[11px] text-stone-500">
              Grounded places and vendor alternatives
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {task.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                isSelected={task.selectedOptionId === option.id}
                onSelect={(optId) => onSelectOption(task.id, optId)}
                currency={currency}
                guestCount={guestCount}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
