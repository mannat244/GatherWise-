import { PlanningTask, TaskStatus, PlanningOption } from "@/lib/types/plan";

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "options_available", "blocked"],
  in_progress: ["options_available", "option_selected", "completed", "blocked"],
  options_available: ["option_selected", "in_progress", "blocked"],
  option_selected: ["completed", "options_available", "in_progress", "blocked"],
  completed: ["option_selected", "in_progress", "todo"], // Allow reopening
  blocked: ["todo", "in_progress", "options_available", "option_selected"],
};

/**
 * Validates whether a task status transition is permitted.
 */
export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Transitions a task's status with invariant verification.
 */
export function transitionTaskStatus(
  task: PlanningTask,
  nextStatus: TaskStatus,
  nowIso: string = new Date().toISOString()
): PlanningTask {
  if (!canTransitionTask(task.status, nextStatus)) {
    throw new Error(
      `Invalid task status transition from '${task.status}' to '${nextStatus}' for task '${task.id}'`
    );
  }

  return {
    ...task,
    status: nextStatus,
    lastUpdatedAt: nowIso,
  };
}

/**
 * Selects an option on a task and applies corresponding state transitions.
 * Ensures an option exists, assigns selectedOptionId, and sets task status to 'option_selected'.
 */
export function selectTaskOption(
  task: PlanningTask,
  optionId: string,
  nowIso: string = new Date().toISOString()
): PlanningTask {
  const option = task.options.find((opt) => opt.id === optionId);
  if (!option) {
    throw new Error(`Option '${optionId}' not found on task '${task.id}'`);
  }

  const updatedOptions: PlanningOption[] = task.options.map((opt) => ({
    ...opt,
    status: opt.id === optionId ? "selected" : "suggested",
  }));

  return {
    ...task,
    options: updatedOptions,
    selectedOptionId: optionId,
    status: "option_selected",
    lastUpdatedAt: nowIso,
  };
}

/**
 * Checks if all prerequisites for a task are completed.
 */
export function areTaskDependenciesMet(
  task: PlanningTask,
  allTasks: PlanningTask[]
): { isMet: boolean; missingDependencyIds: string[] } {
  if (!task.dependsOn || task.dependsOn.length === 0) {
    return { isMet: true, missingDependencyIds: [] };
  }

  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const missing: string[] = [];

  for (const depId of task.dependsOn) {
    const depTask = taskMap.get(depId);
    if (!depTask || depTask.status !== "completed") {
      missing.push(depId);
    }
  }

  return {
    isMet: missing.length === 0,
    missingDependencyIds: missing,
  };
}
