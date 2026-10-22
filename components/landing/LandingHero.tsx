"use client";

import React, { useState } from "react";
import { STARTER_SUGGESTIONS } from "@/lib/storage/mock-data";
import { Sparkles, ArrowRight, ShieldCheck, MapPin, Calculator, RefreshCw } from "lucide-react";

interface LandingHeroProps {
  onSubmitPrompt: (promptText: string) => void;
  onLoadDemo: () => void;
}

export function LandingHero({ onSubmitPrompt, onLoadDemo }: LandingHeroProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSubmitPrompt(prompt.trim());
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-20 text-center">
      {/* GenAI Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-semibold text-brand-700 shadow-xs mb-6">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Conversational, Constraint-Aware Event Planning Copilot</span>
      </div>

      {/* Main Title */}
      <h1 className="text-4xl font-extrabold tracking-tight text-stone-900 sm:text-6xl max-w-3xl mx-auto">
        Turn a single sentence into a{" "}
        <span className="text-brand-600 underline decoration-brand-200 decoration-wavy">
          real-world event plan
        </span>
        .
      </h1>

      <p className="mt-4 text-base text-stone-600 sm:text-lg max-w-2xl mx-auto leading-relaxed">
        Describe your gathering naturally. GatherWise generates an actionable task checklist,
        discovers grounded venues and vendors, manages deterministic budgets, and adapts as constraints change.
      </p>

      {/* Main Prompt Input Box */}
      <form onSubmit={handleSubmit} className="mt-8 max-w-2xl mx-auto">
        <div className="relative flex items-center rounded-2xl border-2 border-stone-200 bg-white p-2 shadow-lg transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="e.g. Help me plan a birthday party for 12 people this Saturday in Koramangala under ₹5,000..."
            className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm sm:text-base text-stone-900 placeholder:text-stone-400 focus:outline-none"
            aria-label="Event description prompt"
          />
          <button
            type="submit"
            disabled={!prompt.trim()}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <span>Start Planning</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Suggestion Chips */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
        <span className="text-xs font-semibold text-stone-600 mr-1">Try an example:</span>
        {STARTER_SUGGESTIONS.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSubmitPrompt(s.prompt)}
            className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition-all shadow-2xs"
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Quick Demo Button for Hackathon Judges */}
      <div className="mt-8 pt-4 border-t border-stone-200 max-w-md mx-auto">
        <button
          type="button"
          onClick={onLoadDemo}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 hover:border-stone-400 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5 text-brand-600" />
          <span>Instant Inspection: Load Sample Birthday Plan (Offline Demo)</span>
        </button>
      </div>

      {/* Key Guarantees Feature Grid */}
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left max-w-3xl mx-auto">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs space-y-1.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
            <Calculator className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-stone-900">Deterministic Arithmetic</h4>
          <p className="text-xs text-stone-600">
            Budgets, per-person multiplications, and contingency reserves are computed by pure application code—never LLM math.
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs space-y-1.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
            <MapPin className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-stone-900">Grounded Places</h4>
          <p className="text-xs text-stone-600">
            Real venues with source links, ratings, directions, and transparent provenance badges. No fabricated places.
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs space-y-1.5">
          <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-bold text-stone-900">Constraint-Aware Replanning</h4>
          <p className="text-xs text-stone-600">
            Change your guest count, budget, or date anytime. GatherWise recalculates only affected items and protects completed work.
          </p>
        </div>
      </div>
    </div>
  );
}
