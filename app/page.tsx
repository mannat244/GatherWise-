"use client";

import React, { useState, useEffect } from "react";
import { EventPlan, TaskStatus, TaskType, PlanningTask } from "@/lib/types/plan";
import { SAMPLE_BIRTHDAY_PLAN } from "@/lib/storage/mock-data";
import { calculateBudgetSummary } from "@/lib/planning/budget";
import { selectTaskOption, transitionTaskStatus } from "@/lib/planning/task-state";
import { applyConstraintChanges } from "@/lib/planning/change-impact";
import {
  savePlanLocally,
  loadPlanLocally,
  clearPlanLocally,
} from "@/lib/storage/local-plans";

import { LandingHero } from "@/components/landing/LandingHero";
import { PlanHeader } from "@/components/workspace/PlanHeader";
import { BudgetBar } from "@/components/workspace/BudgetBar";
import { TaskChecklist } from "@/components/tasks/TaskChecklist";
import { ChatPanel, ChatMessage } from "@/components/chat/ChatPanel";
import { FinalHubView } from "@/components/hub/FinalHubView";
import { RotateCcw, PartyPopper } from "lucide-react";

function createCleanEventPlan(title: string = "New Event"): EventPlan {
  return {
    id: `plan-${Date.now()}`,
    version: 1,
    title,
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Asia/Kolkata",
    constraints: {
      currency: "INR",
      contingencyPercent: 10,
      dietaryNeeds: [],
      accessibilityNeeds: [],
      preferences: [],
      exclusions: [],
    },
    tasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<"workspace" | "hub">("workspace");
  const [plan, setPlan] = useState<EventPlan>(createCleanEventPlan());
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      role: "assistant",
      content:
        "Welcome to GatherWise! Describe your event idea to begin, and I will build an actionable checklist, budget, and grounded recommendations.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestedAnswers: [
        "Help me plan a birthday party with 5 friends in Koramangala under ₹3,000",
        "Quiet date night in Indiranagar under ₹2,500",
      ],
      isGrounded: false,
    },
  ]);

  const budgetSummary = calculateBudgetSummary(plan);

  // 1. Safe Hydration from LocalStorage on initial client mount
  useEffect(() => {
    const saved = loadPlanLocally();
    if (saved) {
      setPlan(saved.plan);
      if (saved.messages && saved.messages.length > 0) {
        setMessages(saved.messages);
      }
      setHasStarted(true);
    }
  }, []);

  // 2. Auto-persist changes to LocalStorage
  useEffect(() => {
    if (hasStarted) {
      savePlanLocally(plan, messages);
    }
  }, [plan, messages, hasStarted]);

  // Calls the server-side /api/chat route handler
  const callChatApi = async (newMessages: ChatMessage[], currentPlan: EventPlan) => {
    setIsLoading(true);

    try {
      const clientTimezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "Asia/Kolkata";

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          currentPlan,
          clientContext: {
            timezone: clientTimezone,
            dateIso: new Date().toISOString(),
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();

      if (data.updatedPlan) {
        setPlan(data.updatedPlan);
      }

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: data.assistantMessage || "Plan updated successfully.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        followUpQuestion: data.followUpQuestion,
        suggestedAnswers: data.suggestedAnswers || [],
        isGrounded: (data.sourceNotes && data.sourceNotes.length > 0) || false,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Chat API call error:", error);
      const fallbackMsg: ChatMessage = {
        id: `asst-err-${Date.now()}`,
        role: "assistant",
        content:
          "I experienced a connection issue reaching the planning service. Your current plan and tasks are safe.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedAnswers: ["Retry message", "View Final Event Hub"],
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Transition from landing prompt to workspace
  const handleStartWithPrompt = (promptText: string) => {
    const initialPlan: EventPlan = createCleanEventPlan(
      promptText.length > 50 ? `${promptText.slice(0, 47)}...` : promptText
    );

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [userMsg];
    setPlan(initialPlan);
    setMessages(updatedMessages);
    setHasStarted(true);

    callChatApi(updatedMessages, initialPlan);
  };

  // Instant Demo Load for Evaluators
  const handleLoadDemo = () => {
    setPlan(SAMPLE_BIRTHDAY_PLAN);
    setHasStarted(true);
  };

  // Chat message send handler
  const handleSendMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    callChatApi(nextMessages, plan);
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

  // Reset to landing and clear persisted storage
  const handleReset = () => {
    clearPlanLocally();
    setPlan(createCleanEventPlan());
    setMessages([
      {
        id: "msg-1",
        role: "assistant",
        content:
          "Welcome to GatherWise! Describe your event idea to begin, and I will build an actionable checklist, budget, and grounded recommendations.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedAnswers: [
          "Help me plan a birthday party with 5 friends in Koramangala under ₹3,000",
          "Quiet date night in Indiranagar under ₹2,500",
        ],
        isGrounded: false,
      },
    ]);
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
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Saved in browser
              </span>
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
