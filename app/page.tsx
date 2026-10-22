"use client";

import React, { useState } from "react";
import { EventPlan, TaskStatus, TaskType, PlanningTask } from "@/lib/types/plan";
import { SAMPLE_BIRTHDAY_PLAN } from "@/lib/storage/mock-data";
import { calculateBudgetSummary } from "@/lib/planning/budget";
import { selectTaskOption, transitionTaskStatus } from "@/lib/planning/task-state";
import { applyConstraintChanges } from "@/lib/planning/change-impact";

import { LandingHero } from "@/components/landing/LandingHero";
import { PlanHeader } from "@/components/workspace/PlanHeader";
import { BudgetBar } from "@/components/workspace/BudgetBar";
import { TaskChecklist } from "@/components/tasks/TaskChecklist";
import { ChatPanel, ChatMessage } from "@/components/chat/ChatPanel";
import { FinalHubView } from "@/components/hub/FinalHubView";
import { Sparkles, RotateCcw, PartyPopper } from "lucide-react";

export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<"workspace" | "hub">("workspace");
  const [plan, setPlan] = useState<EventPlan>(SAMPLE_BIRTHDAY_PLAN);
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      role: "assistant",
      content:
        "Welcome to GatherWise! I've organized your birthday party brief into an actionable checklist and budget. Next, let's explore venue options or finalize your catering.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestedAnswers: [
        "Show me cafe options in Koramangala",
        "We have 15 guests instead of 12",
        "Reduce budget to ₹4,000",
      ],
      isGrounded: true,
    },
  ]);

  const budgetSummary = calculateBudgetSummary(plan);

  // Transition from landing prompt to workspace
  const handleStartWithPrompt = (promptText: string) => {
    // Generate initial plan from prompt text (mock extraction for M2)
    const newPlan: EventPlan = {
      ...SAMPLE_BIRTHDAY_PLAN,
      id: `plan-${Date.now()}`,
      title: promptText.length > 40 ? `${promptText.slice(0, 37)}...` : promptText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPlan(newPlan);
    setMessages([
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: promptText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content:
          "I've initialized your event workspace! I extracted your initial constraints and drafted a checklist with grounded venue options and a deterministic budget.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedAnswers: [
          "Check venue options",
          "Change guest count",
          "What is my contingency buffer?",
        ],
        isGrounded: true,
      },
    ]);
    setHasStarted(true);
  };

  // Instant Demo Load for Evaluators
  const handleLoadDemo = () => {
    setPlan(SAMPLE_BIRTHDAY_PLAN);
    setHasStarted(true);
  };

  // Chat message send handler (interactive mock for M2; wires to Gemini in M3)
  const handleSendMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Check if user is asking to change constraints (interactive demonstration)
    setTimeout(() => {
      setIsLoading(false);
      const lower = text.toLowerCase();

      if (lower.includes("guest") || lower.includes("people") || lower.includes("15")) {
        const { updatedPlan, impact } = applyConstraintChanges(plan, { guestCount: 15 });
        setPlan(updatedPlan);
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: `Understood! I've updated the guest count to 15. ${impact.explanations.join(". ")}. Your per-person estimates have been recalculated, and all completed tasks were preserved.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            suggestedAnswers: ["Select The Living Room Cafe", "View Final Event Hub"],
          },
        ]);
      } else if (lower.includes("budget") || lower.includes("4,000") || lower.includes("4000")) {
        const { updatedPlan, impact } = applyConstraintChanges(plan, { budgetAmount: 4000 });
        setPlan(updatedPlan);
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: `I've adjusted your total budget to ₹4,000. ${impact.warnings.join(" ") || "Your plan remains within budget."}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            suggestedAnswers: ["How much is remaining?", "View Final Event Hub"],
          },
        ]);
      } else if (lower.includes("cafe") || lower.includes("venue")) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content:
              "I found grounded venue listings for Koramangala! Take a look at 'The Living Room Cafe' (Garden patio, board games) or 'Dialogues Board Game Cafe' in your task checklist.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            suggestedAnswers: ["Select The Living Room Cafe", "View Final Event Hub"],
            isGrounded: true,
          },
        ]);
      } else if (lower.includes("final") || lower.includes("hub") || lower.includes("done")) {
        setActiveTab("hub");
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content:
              "I've switched you over to the Final Event Hub! Here you can preview your personalized invitation, share it with guests, or print your itinerary to PDF.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: `Noted: "${text}". I have logged your preferences. You can continue updating the checklist or switch to the Final Event Hub.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            suggestedAnswers: [
              "Show me cafe options in Koramangala",
              "Change guest count to 15",
              "View Final Event Hub",
            ],
          },
        ]);
      }
    }, 600);
  };

  // Toggle task completion
  const handleToggleComplete = (taskId: string, currentStatus: TaskStatus) => {
    const nextStatus: TaskStatus = currentStatus === "completed" ? "in_progress" : "completed";
    const updatedTasks = plan.tasks.map((task) => {
      if (task.id === taskId) {
        return transitionTaskStatus(task, nextStatus);
      }
      return task;
    });

    setPlan({
      ...plan,
      tasks: updatedTasks,
      updatedAt: new Date().toISOString(),
    });
  };

  // Select option on a task
  const handleSelectOption = (taskId: string, optionId: string) => {
    const updatedTasks = plan.tasks.map((task) => {
      if (task.id === taskId) {
        return selectTaskOption(task, optionId);
      }
      return task;
    });

    const updatedPlan = {
      ...plan,
      tasks: updatedTasks,
      updatedAt: new Date().toISOString(),
    };

    setPlan(updatedPlan);

    const task = plan.tasks.find((t) => t.id === taskId);
    const opt = task?.options.find((o) => o.id === optionId);

    setMessages((prev) => [
      ...prev,
      {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: `Selected '${opt?.name}' for ${task?.title}! The budget has been updated deterministically. Note: This records your decision in GatherWise; no real booking was made.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedAnswers: ["View Final Event Hub", "Add custom task"],
      },
    ]);
  };

  // Constraint Replanning Handler
  const handleUpdateConstraints = (updates: {
    guestCount?: number;
    budgetAmount?: number;
    location?: string;
    date?: string;
  }) => {
    const { updatedPlan, impact } = applyConstraintChanges(plan, updates);
    setPlan(updatedPlan);

    setMessages((prev) => [
      ...prev,
      {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: `Constraint update applied! ${impact.explanations.join(". ")}. Preserved ${impact.preservedTaskIds.length} existing tasks and user choices.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  // Add custom task
  const handleAddTask = (newTask: {
    title: string;
    type: TaskType;
    estimatedCost?: number;
  }) => {
    const created: PlanningTask = {
      id: `task-${Date.now()}`,
      title: newTask.title,
      type: newTask.type,
      status: "todo",
      priority: "medium",
      estimatedCost: newTask.estimatedCost,
      costBasis: "per_event",
      currency: plan.constraints.currency,
      dependsOn: [],
      options: [],
      userEdited: true,
      provenance: [{ kind: "user_provided" }],
      lastUpdatedAt: new Date().toISOString(),
    };

    setPlan({
      ...plan,
      tasks: [...plan.tasks, created],
      updatedAt: new Date().toISOString(),
    });
  };

  // Reset to landing
  const handleReset = () => {
    setHasStarted(false);
    setActiveTab("workspace");
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur-md px-4 py-3 no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 text-left focus:outline-none"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
              <PartyPopper className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-stone-900">
                GatherWise
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-stone-500 font-medium">
                Constraint-Aware Event Planning
              </span>
            </div>
          </button>

          {hasStarted && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>New Event</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {!hasStarted ? (
          <LandingHero
            onSubmitPrompt={handleStartWithPrompt}
            onLoadDemo={handleLoadDemo}
          />
        ) : (
          <div className="mx-auto max-w-7xl p-4 sm:p-6">
            {/* Header with Title, Tab switcher, and quick constraints */}
            <PlanHeader
              plan={plan}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onUpdateConstraints={handleUpdateConstraints}
            />

            {/* Split-Screen Workspace (Desktop) */}
            {activeTab === "workspace" ? (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Interactive Chat Panel */}
                <div className="lg:col-span-5 h-[calc(100vh-14rem)] sticky top-20">
                  <ChatPanel
                    messages={messages}
                    isLoading={isLoading}
                    onSendMessage={handleSendMessage}
                    onSelectSuggestion={handleSendMessage}
                  />
                </div>

                {/* Right Column: Dynamic Checklist & Budget Bar */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Deterministic Budget Bar */}
                  <BudgetBar summary={budgetSummary} />

                  {/* Categorized Checklist & Grounded Options */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
                    <TaskChecklist
                      tasks={plan.tasks}
                      guestCount={plan.guestCount}
                      currency={plan.constraints.currency}
                      onToggleComplete={handleToggleComplete}
                      onSelectOption={handleSelectOption}
                      onAddTask={handleAddTask}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Final Event Hub View */
              <div className="mt-6">
                <FinalHubView plan={plan} budgetSummary={budgetSummary} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
