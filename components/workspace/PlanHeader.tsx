"use client";

import React, { useState } from "react";
import { EventPlan } from "@/lib/types/plan";
import { formatCurrency } from "@/lib/planning/budget";
import {
  Calendar,
  MapPin,
  Users,
  Wallet,
  SlidersHorizontal,
  Share2,
  LayoutList,
  Sparkles,
} from "lucide-react";

interface PlanHeaderProps {
  plan: EventPlan;
  activeTab: "workspace" | "hub";
  onTabChange: (tab: "workspace" | "hub") => void;
  onUpdateConstraints: (updates: {
    guestCount?: number;
    budgetAmount?: number;
    location?: string;
    date?: string;
  }) => void;
}

export function PlanHeader({
  plan,
  activeTab,
  onTabChange,
  onUpdateConstraints,
}: PlanHeaderProps) {
  const [isEditingConstraints, setIsEditingConstraints] = useState(false);
  const [guests, setGuests] = useState(plan.guestCount?.toString() || "");
  const [budget, setBudget] = useState(plan.constraints.budgetAmount?.toString() || "");
  const [loc, setLoc] = useState(plan.location || "");
  const [eventDate, setEventDate] = useState(plan.date || "");

  const handleSaveConstraints = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConstraints({
      guestCount: guests ? parseInt(guests, 10) : undefined,
      budgetAmount: budget ? parseFloat(budget) : undefined,
      location: loc.trim() || undefined,
      date: eventDate || undefined,
    });
    setIsEditingConstraints(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Title & Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {plan.eventType || "Event Plan"}
            </span>
            <span className="text-xs text-stone-600 font-medium">v{plan.version}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            {plan.title}
          </h1>
        </div>

        {/* View Switcher: Planning Workspace vs Final Hub */}
        <div className="flex items-center rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => onTabChange("workspace")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "workspace"
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span>Checklist & Options</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("hub")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "hub"
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Final Event Hub</span>
          </button>
        </div>
      </div>

      {/* Constraints Summary Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {plan.date && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-stone-700 shadow-xs">
              <Calendar className="h-3.5 w-3.5 text-stone-400" />
              <span>{plan.date} {plan.time ? `@ ${plan.time}` : ""}</span>
            </div>
          )}

          {plan.location && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-stone-700 shadow-xs">
              <MapPin className="h-3.5 w-3.5 text-stone-400" />
              <span>{plan.location}</span>
            </div>
          )}

          {plan.guestCount && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-stone-700 shadow-xs">
              <Users className="h-3.5 w-3.5 text-stone-400" />
              <span>{plan.guestCount} guests</span>
            </div>
          )}

          {plan.constraints.budgetAmount !== undefined && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-stone-700 shadow-xs">
              <Wallet className="h-3.5 w-3.5 text-stone-400" />
              <span>{formatCurrency(plan.constraints.budgetAmount, plan.constraints.currency)}</span>
            </div>
          )}
        </div>

        {/* Change Constraints Trigger */}
        <button
          type="button"
          onClick={() => setIsEditingConstraints(!isEditingConstraints)}
          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-stone-500" />
          <span>Adjust Constraints</span>
        </button>
      </div>

      {/* Inline Constraint Adjustment Panel */}
      {isEditingConstraints && (
        <form
          onSubmit={handleSaveConstraints}
          className="rounded-xl border border-stone-300 bg-stone-50 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Constraint-Aware Replanning
            </h4>
            <span className="text-[11px] text-stone-500">
              Updates budget & impacted tasks while preserving completed work
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-stone-600 mb-1">
                Guest Count
              </label>
              <input
                type="number"
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                min="1"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-600 mb-1">
                Total Budget ({plan.constraints.currency})
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-600 mb-1">
                Event Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-stone-600 mb-1">
                Location
              </label>
              <input
                type="text"
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
                placeholder="City or area"
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditingConstraints(false)}
              className="rounded-lg px-3 py-1 text-xs text-stone-600 hover:bg-stone-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 shadow-xs"
            >
              Apply & Replan
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
