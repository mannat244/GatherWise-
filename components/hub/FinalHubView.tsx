"use client";

import React, { useState } from "react";
import { EventPlan, BudgetSummary } from "@/lib/types/plan";
import { formatCurrency } from "@/lib/planning/budget";
import {
  Printer,
  Copy,
  Share2,
  Check,
  Calendar,
  MapPin,
  Users,
  Compass,
  ExternalLink,
  PartyPopper,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
} from "lucide-react";

interface FinalHubViewProps {
  plan: EventPlan;
  budgetSummary: BudgetSummary;
}

export function FinalHubView({ plan, budgetSummary }: FinalHubViewProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedPlan, setCopiedPlan] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Derive initial invitation text
  const selectedVenue = plan.tasks
    .find((t) => t.type === "venue")
    ?.options.find((o) => o.status === "selected");

  const defaultInvitationText = `🎉 You're Invited to ${plan.title}!

📅 Date: ${plan.date || "TBD"} ${plan.time ? `@ ${plan.time}` : ""}
📍 Venue: ${selectedVenue ? `${selectedVenue.name} (${selectedVenue.location?.address || ""})` : plan.location || "TBD"}
${selectedVenue?.location?.directionsUrl ? `🗺️ Map/Directions: ${selectedVenue.location.directionsUrl}\n` : ""}
👥 Guest Count: ~${plan.guestCount || "TBD"}
${plan.constraints.dietaryNeeds.length > 0 ? `🥗 Dietary Notes: ${plan.constraints.dietaryNeeds.join(", ")}\n` : ""}
Can't wait to see you there! Please RSVP soon.`;

  const [invitationText, setInvitationText] = useState(defaultInvitationText);

  // Copy invitation
  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invitationText);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Copy full plan summary
  const handleCopyPlan = async () => {
    const summaryText = `GatherWise Event Plan: ${plan.title}
Version: v${plan.version}
Date: ${plan.date || "TBD"} | Location: ${plan.location || "TBD"} | Guests: ${plan.guestCount || "TBD"}
Total Budget: ${formatCurrency(budgetSummary.totalBudget, budgetSummary.currency)}
Planned Spend: ${formatCurrency(budgetSummary.totalPlannedSpend, budgetSummary.currency)}
Remaining Spend: ${formatCurrency(budgetSummary.remainingSpend, budgetSummary.currency)}

Tasks:
${plan.tasks
  .map(
    (t) =>
      `- [${t.status === "completed" ? "X" : " "}] ${t.title} (${t.status})`
  )
  .join("\n")}
`;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedPlan(true);
      setTimeout(() => setCopiedPlan(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Native Web Share API
  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: plan.title,
          text: invitationText,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      } catch {
        // User cancelled share
      }
    } else {
      // Fallback to copy
      handleCopyInvite();
    }
  };

  // Print trigger
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Download Markdown summary
  const handleDownloadMarkdown = () => {
    const mdContent = `# GatherWise Event Plan: ${plan.title}
Version: v${plan.version} | Generated: ${new Date().toLocaleDateString()}

## Event Overview
- **Event Type:** ${plan.eventType || "Gathering"}
- **Date & Time:** ${plan.date || "TBD"} ${plan.time ? `@ ${plan.time}` : ""}
- **Location:** ${plan.location || "TBD"}
- **Guest Count:** ${plan.guestCount || "TBD"}
- **Total Budget:** ${formatCurrency(budgetSummary.totalBudget, budgetSummary.currency)}
- **Committed Spend:** ${formatCurrency(budgetSummary.committedSpend, budgetSummary.currency)}
- **Estimated Spend:** ${formatCurrency(budgetSummary.estimatedSpend, budgetSummary.currency)}
- **Remaining Spend:** ${formatCurrency(budgetSummary.remainingSpend, budgetSummary.currency)}

## Confirmed Choices
${
  selectedOptions.length > 0
    ? selectedOptions
        .map(
          (o) =>
            `### ${o.name} (${o.category || "General"})
- **Address:** ${o.location?.address || "N/A"}
${o.location?.directionsUrl ? `- **Directions:** ${o.location.directionsUrl}\n` : ""}${o.sourceUrl ? `- **Source:** ${o.sourceUrl}\n` : ""}${o.bookingUrl ? `- **Booking/Official Site:** ${o.bookingUrl}\n` : ""}`
        )
        .join("\n")
    : "No choices confirmed yet."
}

## Execution Checklist
${plan.tasks
  .map(
    (t) =>
      `- [${t.status === "completed" ? "X" : " "}] **${t.title}** (${t.status})${t.dueDate ? ` - Due: ${t.dueDate}` : ""}`
  )
  .join("\n")}

## Invitation Text
\`\`\`
${invitationText}
\`\`\`
`;

    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${plan.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_GatherWise_Plan.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedOptions = plan.tasks.flatMap((t) =>
    t.options.filter((o) => o.id === t.selectedOptionId)
  );

  const pendingTasks = plan.tasks.filter((t) => t.status !== "completed");
  const completedTasks = plan.tasks.filter((t) => t.status === "completed");

  return (
    <div className="space-y-6">
      {/* Hub Hero Header (Hidden in Print) */}
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50/80 via-white to-amber-50/50 p-6 shadow-sm no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
              <PartyPopper className="h-3.5 w-3.5" />
              Final Event Hub
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              {plan.title}
            </h2>
            <p className="mt-1 text-xs text-stone-600 sm:text-sm">
              Your plan is ready to execute. Review confirmed decisions, share invitations, and print your itinerary.
            </p>
          </div>

          {/* Quick Hub Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs"
            >
              <Printer className="h-4 w-4" />
              <span>Print to PDF</span>
            </button>
            <button
              type="button"
              onClick={handleCopyPlan}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs"
            >
              {copiedPlan ? <Check className="h-4 w-4 text-emerald-600" /> : <FileText className="h-4 w-4" />}
              <span>{copiedPlan ? "Plan Copied!" : "Copy Plan"}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-xs"
              title="Download entire event plan as a portable Markdown file"
            >
              <Download className="h-4 w-4 text-stone-600" />
              <span>Download (.md)</span>
            </button>
            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 shadow-xs"
            >
              <Share2 className="h-4 w-4" />
              <span>Share Invitation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Overview & Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Event Metadata & Financial Breakdown */}
        <div className="space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Event Overview
            </h3>

            <div className="space-y-2 text-xs text-stone-700">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-stone-400" />
                <span className="font-semibold">Date & Time: </span>
                <span>{plan.date || "Not set"} {plan.time ? `@ ${plan.time}` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-stone-400" />
                <span className="font-semibold">Location: </span>
                <span>{plan.location || "Not specified"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-stone-400" />
                <span className="font-semibold">Guest Count: </span>
                <span>{plan.guestCount ? `${plan.guestCount} guests` : "Not specified"}</span>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-3 space-y-1.5 text-xs">
              <span className="font-semibold text-stone-800">Budget Breakdown</span>
              <div className="flex justify-between text-stone-600">
                <span>Total Budget:</span>
                <span className="font-medium">{formatCurrency(budgetSummary.totalBudget, budgetSummary.currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Committed:</span>
                <span>{formatCurrency(budgetSummary.committedSpend, budgetSummary.currency)}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-medium">
                <span>Estimated:</span>
                <span>{formatCurrency(budgetSummary.estimatedSpend, budgetSummary.currency)}</span>
              </div>
              <div className="flex justify-between text-stone-800 font-bold border-t border-stone-100 pt-1">
                <span>Remaining:</span>
                <span className={budgetSummary.remainingSpend < 0 ? "text-rose-600" : "text-emerald-700"}>
                  {formatCurrency(budgetSummary.remainingSpend, budgetSummary.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Outstanding Execution Tasks */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Pending Actions ({pendingTasks.length})
              </h3>
              <span className="text-[11px] text-stone-400 font-medium">
                {completedTasks.length} finished
              </span>
            </div>

            <ul className="space-y-2 text-xs">
              {pendingTasks.map((task) => (
                <li key={task.id} className="flex items-start gap-2 rounded-lg bg-stone-50 p-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-semibold text-stone-900">{task.title}</span>
                    {task.dueDate && (
                      <p className="text-[11px] text-stone-500">Due: {task.dueDate}</p>
                    )}
                  </div>
                </li>
              ))}
              {pendingTasks.length === 0 && (
                <li className="text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All tasks completed!</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Middle & Right Column: Confirmed Choices & Invitation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Confirmed Options Section */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">
                Confirmed Places & Choices ({selectedOptions.length})
              </h3>
              <span className="text-xs text-stone-500">
                Direct links to verified sources and directions
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-stone-900">{opt.name}</h4>
                      {opt.category && (
                        <span className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">
                          {opt.category}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      <Check className="h-3 w-3" />
                      Selected
                    </span>
                  </div>

                  {opt.location?.address && (
                    <p className="text-xs text-stone-600 line-clamp-2">
                      📍 {opt.location.address}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {opt.location?.directionsUrl && (
                      <a
                        href={opt.location.directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700"
                      >
                        <Compass className="h-3.5 w-3.5" />
                        <span>Directions</span>
                      </a>
                    )}
                    {opt.bookingUrl && (
                      <a
                        href={opt.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-stone-700 hover:text-stone-900"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Official Booking</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {selectedOptions.length === 0 && (
                <div className="col-span-2 rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-500">
                  No places or vendors selected yet. Explore options in the checklist workspace.
                </div>
              )}
            </div>
          </div>

          {/* Invitation Generator */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Contextual Invitation Preview
                </h3>
                <p className="text-xs text-stone-500">
                  Auto-generated from your finalized details. Editable before sharing.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={invitationText}
              onChange={(e) => setInvitationText(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-stone-50/50 p-3 font-mono text-xs text-stone-800 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Editable invitation preview"
            />

            <p className="text-[11px] text-stone-500 italic">
              Note: GatherWise never sends messages autonomously. You maintain 100% control over invitation distribution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
