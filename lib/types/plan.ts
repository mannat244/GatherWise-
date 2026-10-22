import { z } from "zod";

// --- Provenance ---
export const ProvenanceKindSchema = z.enum([
  "verified_source",
  "user_provided",
  "estimate",
  "generated",
  "unknown",
]);
export type ProvenanceKind = z.infer<typeof ProvenanceKindSchema>;

export const ProvenanceSchema = z.object({
  kind: ProvenanceKindSchema,
  sourceName: z.string().optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  retrievedAt: z.string().optional(),
  note: z.string().optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

// --- Option Types ---
export const OptionStatusSchema = z.enum([
  "suggested",
  "selected",
  "booking_started",
  "booked",
]);
export type OptionStatus = z.infer<typeof OptionStatusSchema>;

export const PriceBasisSchema = z.enum([
  "per_person",
  "per_item",
  "per_event",
  "range",
  "unknown",
]);
export type PriceBasis = z.infer<typeof PriceBasisSchema>;

export const OptionPriceSchema = z.object({
  amount: z.number().nonnegative().optional(),
  currency: z.string().default("INR"),
  unit: z.string().optional(),
  basis: PriceBasisSchema.default("per_event"),
  isEstimate: z.boolean().default(true),
});
export type OptionPrice = z.infer<typeof OptionPriceSchema>;

export const OptionLocationSchema = z.object({
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  directionsUrl: z.string().url().optional().or(z.literal("")),
});
export type OptionLocation = z.infer<typeof OptionLocationSchema>;

export const OptionRatingSchema = z.object({
  value: z.number().min(0).max(5),
  scale: z.number().default(5),
  reviewCount: z.number().int().nonnegative().optional(),
  sourceName: z.string().optional(),
});
export type OptionRating = z.infer<typeof OptionRatingSchema>;

export const PlanningOptionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  status: OptionStatusSchema.default("suggested").optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  location: OptionLocationSchema.optional(),
  price: OptionPriceSchema.optional(),
  rating: OptionRatingSchema.optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  bookingUrl: z.string().url().optional().or(z.literal("")),
  provenance: z.array(ProvenanceSchema).default([]),
  fitReasons: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  lastCheckedAt: z.string().optional(),
});
export type PlanningOption = z.infer<typeof PlanningOptionSchema>;

// --- Task Types ---
export const TaskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "options_available",
  "option_selected",
  "completed",
  "blocked",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskTypeSchema = z.enum([
  "venue",
  "food",
  "decoration",
  "product",
  "vendor",
  "activity",
  "travel",
  "accommodation",
  "logistics",
  "general",
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const TaskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const PlanningTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: TaskTypeSchema.default("general"),
  status: TaskStatusSchema.default("todo"),
  priority: TaskPrioritySchema.default("medium"),
  dueDate: z.string().optional(), // YYYY-MM-DD
  estimatedCost: z.number().nonnegative().optional(),
  costBasis: PriceBasisSchema.default("per_event"),
  currency: z.string().default("INR"),
  dependsOn: z.array(z.string()).default([]),
  options: z.array(PlanningOptionSchema).default([]),
  selectedOptionId: z.string().optional(),
  userEdited: z.boolean().default(false),
  provenance: z.array(ProvenanceSchema).default([]),
  lastUpdatedAt: z.string(),
});
export type PlanningTask = z.infer<typeof PlanningTaskSchema>;

// --- Constraints & Plan ---
export const PlanConstraintsSchema = z.object({
  budgetAmount: z.number().nonnegative().optional(),
  currency: z.string().default("INR"),
  targetSpend: z.number().nonnegative().optional(),
  contingencyPercent: z.number().min(0).max(100).default(10), // default 10%
  dietaryNeeds: z.array(z.string()).default([]),
  accessibilityNeeds: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
});
export type PlanConstraints = z.infer<typeof PlanConstraintsSchema>;

export const EventPlanSchema = z.object({
  id: z.string(),
  version: z.number().int().positive().default(1),
  title: z.string().min(1),
  eventType: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD
  time: z.string().optional(), // HH:mm
  timezone: z.string().default("Asia/Kolkata"),
  location: z.string().optional(),
  guestCount: z.number().int().positive().optional(),
  constraints: PlanConstraintsSchema.default({ currency: "INR", contingencyPercent: 10 }),
  tasks: z.array(PlanningTaskSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EventPlan = z.infer<typeof EventPlanSchema>;

// --- Budget Summaries ---
export interface BudgetLineItem {
  taskId: string;
  taskTitle: string;
  type: TaskType;
  amount: number;
  currency: string;
  isCommitted: boolean;
  basis: PriceBasis;
  formula?: string;
  isEstimate: boolean;
}

export interface BudgetSummary {
  totalBudget: number;
  contingencyPercent: number;
  contingencyAmount: number;
  spendableBudget: number;
  committedSpend: number;
  estimatedSpend: number;
  totalPlannedSpend: number;
  remainingSpend: number;
  isOverBudget: boolean;
  overageAmount: number;
  currency: string;
  lineItems: BudgetLineItem[];
}

export const ProposedOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  status: OptionStatusSchema.default("suggested").optional(),
  imageUrl: z.string().optional(),
  location: z
    .object({
      address: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      directionsUrl: z.string().optional(),
    })
    .optional(),
  price: z
    .object({
      amount: z.number().nonnegative().optional(),
      currency: z.string().default("INR"),
      unit: z.string().optional(),
      basis: PriceBasisSchema.default("per_event"),
      isEstimate: z.boolean().default(true),
    })
    .optional(),
  rating: z
    .object({
      value: z.number().optional(),
      scale: z.number().default(5),
      reviewCount: z.number().optional(),
      sourceName: z.string().optional(),
    })
    .optional(),
  sourceUrl: z.string().optional(),
  bookingUrl: z.string().optional(),
  fitReasons: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});
export type ProposedOption = z.infer<typeof ProposedOptionSchema>;

// --- Action Union / Proposals ---
export const AgentActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ask_question"),
    question: z.string(),
    options: z.array(z.string()).optional(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("upsert_task"),
    task: z.object({
      id: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      type: TaskTypeSchema,
      priority: TaskPrioritySchema.optional(),
      dueDate: z.string().optional(),
      estimatedCost: z.number().nonnegative().optional(),
      costBasis: PriceBasisSchema.optional(),
      dependsOn: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    type: z.literal("remove_task"),
    taskId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("propose_options"),
    taskId: z.string().optional(),
    taskType: TaskTypeSchema.optional(),
    options: z.array(ProposedOptionSchema),
  }),
  z.object({
    type: z.literal("select_option"),
    taskId: z.string(),
    optionId: z.string(),
  }),
  z.object({
    type: z.literal("propose_constraint_change"),
    patch: z.object({
      budgetAmount: z.number().nonnegative().optional(),
      currency: z.string().optional(),
      guestCount: z.number().int().positive().optional(),
      date: z.string().optional(),
      location: z.string().optional(),
      dietaryNeeds: z.array(z.string()).optional(),
      accessibilityNeeds: z.array(z.string()).optional(),
      preferences: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    type: z.literal("explain_tradeoff"),
    message: z.string(),
  }),
]);
export type AgentAction = z.infer<typeof AgentActionSchema>;

export const AgentProposalSchema = z.object({
  assistantMessage: z.string(),
  intent: z.enum(["clarify", "plan", "search", "compare", "select", "edit", "explain"]),
  followUpQuestion: z.string().optional(),
  actions: z.array(AgentActionSchema).default([]),
  sourceNotes: z.array(z.string()).default([]),
});
export type AgentProposal = z.infer<typeof AgentProposalSchema>;
