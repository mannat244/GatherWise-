import { PlanningTask, EventPlan } from "@/lib/types/plan";

export interface TimelineAssessment {
  eventDate?: string;
  daysUntilEvent?: number;
  isPastEvent: boolean;
  overdueTasks: PlanningTask[];
  urgentTasks: PlanningTask[];
  timelineWarnings: string[];
}

/**
 * Assesses an event plan's timeline and identifies overdue or urgent tasks.
 */
export function assessTimeline(
  plan: EventPlan,
  referenceDateIso: string = new Date().toISOString()
): TimelineAssessment {
  const warnings: string[] = [];
  const overdueTasks: PlanningTask[] = [];
  const urgentTasks: PlanningTask[] = [];

  const refDate = new Date(referenceDateIso);
  const refMidnight = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());

  let daysUntilEvent: number | undefined = undefined;
  let isPastEvent = false;

  if (plan.date) {
    const [year, month, day] = plan.date.split("-").map(Number);
    const eventMidnight = new Date(year, month - 1, day);
    const diffMs = eventMidnight.getTime() - refMidnight.getTime();
    daysUntilEvent = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntilEvent < 0) {
      isPastEvent = true;
      warnings.push(`Event date (${plan.date}) is in the past.`);
    } else if (daysUntilEvent === 0) {
      warnings.push("Event date is today.");
    } else if (daysUntilEvent <= 2) {
      warnings.push(`Event is in ${daysUntilEvent} day(s) — expedited bookings recommended.`);
    }
  }

  for (const task of plan.tasks) {
    if (task.status === "completed") continue;

    if (task.dueDate) {
      const [year, month, day] = task.dueDate.split("-").map(Number);
      const dueMidnight = new Date(year, month - 1, day);
      const diffDue = Math.round((dueMidnight.getTime() - refMidnight.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDue < 0) {
        overdueTasks.push(task);
      } else if (diffDue <= 2 || task.priority === "urgent") {
        urgentTasks.push(task);
      }
    } else if (task.priority === "urgent" || task.priority === "high") {
      urgentTasks.push(task);
    }
  }

  if (overdueTasks.length > 0) {
    warnings.push(`${overdueTasks.length} task(s) are overdue.`);
  }

  return {
    eventDate: plan.date,
    daysUntilEvent,
    isPastEvent,
    overdueTasks,
    urgentTasks,
    timelineWarnings: warnings,
  };
}
