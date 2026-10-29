"use client";

import React, { useState } from "react";
import { PlanningTask, TaskStatus, TaskType } from "@/lib/types/plan";
import { TaskCard } from "./TaskCard";
import { Plus } from "lucide-react";

interface TaskChecklistProps {
  tasks: PlanningTask[];
  guestCount?: number;
  currency?: string;
  onToggleComplete: (taskId: string, currentStatus: TaskStatus) => void;
  onSelectOption: (taskId: string, optionId: string) => void;
  onAddTask: (newTask: { title: string; type: TaskType; estimatedCost?: number }) => void;
}

export function TaskChecklist({
  tasks,
  guestCount = 1,
  currency = "INR",
  onToggleComplete,
  onSelectOption,
  onAddTask,
}: TaskChecklistProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "options" | "completed">("all");
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<TaskType>("general");
  const [newCost, setNewCost] = useState("");

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredTasks = tasks.filter((task) => {
    if (filter === "pending") return task.status !== "completed";
    if (filter === "options") return task.options.length > 0;
    if (filter === "completed") return task.status === "completed";
    return true;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddTask({
      title: newTitle.trim(),
      type: newType,
      estimatedCost: newCost ? Number(newCost) : undefined,
    });

    setNewTitle("");
    setNewCost("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Checklist Header & Progress */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Execution Checklist</h2>
          <p className="text-xs text-stone-500">
            {completedCount} of {totalCount} tasks completed ({progressPercent}%)
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              filter === "all"
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            All ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              filter === "pending"
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Pending ({tasks.filter((t) => t.status !== "completed").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("options")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              filter === "options"
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            With Options ({tasks.filter((t) => t.options.length > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("completed")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              filter === "completed"
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Done ({completedCount})
          </button>
        </div>
      </div>

      {/* Task Cards List */}
      <div className="space-y-3">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            guestCount={guestCount}
            currency={currency}
            onToggleComplete={onToggleComplete}
            onSelectOption={onSelectOption}
          />
        ))}

        {filteredTasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
            No tasks found in this view.
          </div>
        )}
      </div>

      {/* Add Custom Task Form */}
      {isAdding ? (
        <form
          onSubmit={handleCreateTask}
          className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 space-y-3"
        >
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-700">
            Add Custom Task
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="e.g. Hire acoustic guitarist"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="sm:col-span-2 rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
              required
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TaskType)}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="venue">Venue</option>
              <option value="food">Food & Drinks</option>
              <option value="travel">Travel & Transit</option>
              <option value="activity">Activity & Games</option>
              <option value="product">Product / Cake</option>
              <option value="decoration">Decoration</option>
              <option value="vendor">Vendor</option>
              <option value="logistics">Logistics</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <input
              type="number"
              placeholder="Estimated cost (optional)"
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              className="w-48 rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="rounded-lg px-3 py-1 text-xs text-stone-600 hover:bg-stone-200/60"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-800"
              >
                Save Task
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          {/* Quick-add task suggestion chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-stone-500">Quick additions:</span>
            <button
              type="button"
              onClick={() => onAddTask({ title: "Order Birthday Cake", type: "product", estimatedCost: 600 })}
              className="rounded-lg border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-colors"
            >
              + Birthday Cake
            </button>
            <button
              type="button"
              onClick={() => onAddTask({ title: "Travel: Commute to Venue", type: "travel", estimatedCost: 500 })}
              className="rounded-lg border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-colors"
            >
              + Travel & Ride
            </button>
            <button
              type="button"
              onClick={() => onAddTask({ title: "Activity: Bowling & Entertainment", type: "activity", estimatedCost: 2000 })}
              className="rounded-lg border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-colors"
            >
              + Bowling & Games
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 py-2.5 text-xs font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900 hover:bg-stone-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Custom Task</span>
          </button>
        </div>
      )}
    </div>
  );
}
