"use client";

import React, { useState, useEffect } from "react";
import { EventPlan, ChatTelemetry } from "@/lib/types/plan";
import { DailyUsageState } from "@/lib/storage/usage-limiter";
import { formatCurrency } from "@/lib/planning/budget";
import {
  Calendar,
  MapPin,
  Users,
  Wallet,
  SlidersHorizontal,
  LayoutList,
  Sparkles,
  Accessibility,
  HeartHandshake,
  Utensils,
  X,
  Zap,
  Activity,
  Cpu,
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
    dietaryNeeds?: string[];
    accessibilityNeeds?: string[];
    preferences?: string[];
  }) => void;
  telemetry?: ChatTelemetry | null;
  cumulativeTokens?: number;
  dailyUsage?: DailyUsageState;
}

export function PlanHeader({
  plan,
  activeTab,
  onTabChange,
  onUpdateConstraints,
  telemetry,
  cumulativeTokens = 0,
  dailyUsage,
}: PlanHeaderProps) {
  const [isEditingConstraints, setIsEditingConstraints] = useState(false);
  const [showTelemetryModal, setShowTelemetryModal] = useState(false);
  const [guests, setGuests] = useState(plan.guestCount?.toString() || "");
  const [budget, setBudget] = useState(plan.constraints.budgetAmount?.toString() || "");
  const [loc, setLoc] = useState(plan.location || "");
  const [eventDate, setEventDate] = useState(plan.date || "");
  const [accessibility, setAccessibility] = useState(plan.constraints.accessibilityNeeds.join(", "));
  const [dietary, setDietary] = useState(plan.constraints.dietaryNeeds.join(", "));
  const [preferences, setPreferences] = useState(plan.constraints.preferences.join(", "));

  // Live synchronization: Keep input fields in sync when AI or chat updates the plan
  useEffect(() => {
    setGuests(plan.guestCount?.toString() || "");
    setBudget(plan.constraints.budgetAmount?.toString() || "");
    setLoc(plan.location || "");
    setEventDate(plan.date || "");
    setAccessibility(plan.constraints.accessibilityNeeds.join(", "));
    setDietary(plan.constraints.dietaryNeeds.join(", "));
    setPreferences(plan.constraints.preferences.join(", "));
  }, [
    plan.guestCount,
    plan.constraints.budgetAmount,
    plan.location,
    plan.date,
    plan.constraints.accessibilityNeeds,
    plan.constraints.dietaryNeeds,
    plan.constraints.preferences,
  ]);

  const handleSaveConstraints = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConstraints({
      guestCount: guests ? parseInt(guests, 10) : undefined,
      budgetAmount: budget ? parseFloat(budget) : undefined,
      location: loc.trim() || undefined,
      date: eventDate || undefined,
      accessibilityNeeds: accessibility
        ? accessibility.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      dietaryNeeds: dietary
        ? dietary.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      preferences: preferences
        ? preferences.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    });
    setIsEditingConstraints(false);
  };

  const handleClearAccessibility = () => {
    setAccessibility("");
    onUpdateConstraints({ accessibilityNeeds: [] });
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
            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/90 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 shadow-2xs">
              <Sparkles className="h-3 w-3 text-indigo-600" />
              <span>Free Plan (15 RPM • 500 RPD)</span>
            </div>
            {telemetry && (
              <button
                type="button"
                onClick={() => setShowTelemetryModal(!showTelemetryModal)}
                className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/90 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                title="View AI Token Usage & Latency Observability"
              >
                <Zap className="h-3 w-3 text-indigo-600" />
                <span>{telemetry.totalTokens.toLocaleString()} tokens</span>
                <span className="text-indigo-400">•</span>
                <span>{(telemetry.latencyMs / 1000).toFixed(1)}s</span>
                {telemetry.searchGroundingFired ? (
                  <span className="rounded bg-indigo-200 px-1 text-[9px] font-bold text-indigo-900">
                    Grounded
                  </span>
                ) : (
                  <span className="rounded bg-emerald-100 px-1 text-[9px] font-medium text-emerald-800">
                    Zero Tool Waste
                  </span>
                )}
              </button>
            )}
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

          {plan.constraints.preferences.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-stone-700 shadow-xs">
              <HeartHandshake className="h-3.5 w-3.5 text-stone-400" />
              <span className="line-clamp-1">{plan.constraints.preferences.join(", ")}</span>
            </div>
          )}

          {plan.constraints.accessibilityNeeds.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800 shadow-xs">
              <Accessibility className="h-3.5 w-3.5 text-amber-600" />
              <span>{plan.constraints.accessibilityNeeds.join(", ")}</span>
              <button
                type="button"
                onClick={handleClearAccessibility}
                className="ml-1 text-amber-700 hover:text-amber-900"
                title="Remove accessibility requirement"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Change Constraints Trigger */}
        <button
          type="button"
          onClick={() => setIsEditingConstraints(!isEditingConstraints)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            isEditingConstraints
              ? "border-brand-600 bg-brand-50 text-brand-700"
              : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
          }`}
          aria-expanded={isEditingConstraints}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-stone-500" />
          <span>Adjust Constraints</span>
        </button>
      </div>

      {/* Inline Constraint Adjustment Panel */}
      {isEditingConstraints && (
        <form
          onSubmit={handleSaveConstraints}
          className="rounded-xl border border-brand-200 bg-gradient-to-b from-stone-50 to-white p-4 space-y-3 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                Constraint-Aware Replanning
              </h4>
              <p className="text-[11px] text-stone-500">
                Live constraints dynamically sync with copilot suggestions while strictly preserving confirmed decisions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingConstraints(false)}
              className="rounded-lg p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Guest Count
              </label>
              <input
                type="number"
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                min="1"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Total Budget ({plan.constraints.currency})
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Event Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
                placeholder="e.g. Koramangala, Bengaluru"
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Preferences (comma-separated)
              </label>
              <input
                type="text"
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="Good ambiance, Fast food, Bowling"
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Accessibility Needs
              </label>
              <input
                type="text"
                value={accessibility}
                onChange={(e) => setAccessibility(e.target.value)}
                placeholder="Leave blank if none needed"
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                Dietary Needs
              </label>
              <input
                type="text"
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
                placeholder="e.g. Vegetarian, Halal, Nut-free"
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={handleClearAccessibility}
              className="text-xs text-amber-700 hover:text-amber-900 font-medium underline"
            >
              Clear Accessibility Needs
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingConstraints(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-xs"
              >
                Apply & Replan
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Live AI Observability & Token Inspector */}
      {showTelemetryModal && telemetry && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-white to-stone-50 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                AI Observability & Token Telemetry
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowTelemetryModal(false)}
              className="rounded-lg p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="rounded-lg border border-stone-200 bg-white p-2.5">
              <span className="text-[10px] text-stone-500 uppercase font-semibold">Active Model</span>
              <p className="mt-1 font-mono font-bold text-stone-900">{telemetry.model}</p>
              <span className="text-[10px] text-indigo-600 font-semibold">Free Tier (15 RPM)</span>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-2.5">
              <span className="text-[10px] text-stone-500 uppercase font-semibold">Turn Tokens</span>
              <p className="mt-1 font-mono font-bold text-indigo-600">{telemetry.totalTokens.toLocaleString()}</p>
              <span className="text-[10px] text-stone-400">
                {telemetry.promptTokens} in • {telemetry.candidateTokens} out
              </span>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-2.5">
              <span className="text-[10px] text-stone-500 uppercase font-semibold">Execution Latency</span>
              <p className="mt-1 font-mono font-bold text-stone-900">{telemetry.latencyMs} ms</p>
              <span className="text-[10px] text-stone-400">{(telemetry.latencyMs / 1000).toFixed(2)}s round-trip</span>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-2.5">
              <span className="text-[10px] text-stone-500 uppercase font-semibold">Daily Quota</span>
              <p className="mt-1 font-mono font-bold text-stone-900">
                {dailyUsage ? `${dailyUsage.count} / ${dailyUsage.limit}` : "Tracked"}
              </p>
              <span className="text-[10px] text-stone-400">
                {dailyUsage ? `${dailyUsage.remaining} left today` : "500 RPD cap"}
              </span>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-2.5">
              <span className="text-[10px] text-stone-500 uppercase font-semibold">Session Total</span>
              <p className="mt-1 font-mono font-bold text-stone-900">{cumulativeTokens.toLocaleString()}</p>
              <span className="text-[10px] text-stone-400">est. ${(telemetry.estimatedCostUsd).toFixed(5)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5 text-xs text-indigo-900 flex items-start gap-2">
            <Activity className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Grounding Strategy Decision:</p>
              <p className="text-[11px] text-indigo-700">{telemetry.searchGroundingReason}</p>
              {telemetry.toolTokens > 0 && (
                <p className="mt-1 text-[10px] text-indigo-600 font-mono">
                  Grounding injected {telemetry.toolTokens} search tokens into context.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
