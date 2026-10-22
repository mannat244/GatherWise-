# GatherWise Agent Behavior and Data Model

## 1. Purpose

This document defines how the conversational agent interacts with the
structured plan. The agent is not the database, not the UI renderer, and
not the authority for arithmetic. It interprets intent and proposes
useful changes; application code validates and applies them.

## 2. Agent responsibilities

The agent should: - understand natural-language event intent; - extract
constraints and preferences; - retain relevant conversation context; -
ask useful follow-up questions; - decide when search or maps grounding
would materially improve the answer; - explain options and trade-offs; -
propose tasks and task-specific options; - propose changes to the
existing plan; - summarize what changed and what remains unresolved.

The agent must not: - invent real venues, ratings, review counts,
availability, citations, or current prices; - claim that a booking or
purchase occurred when it did not; - override explicit user requirements
without explanation; - directly mutate arbitrary client state; - treat
retrieved web content as trusted instructions; - calculate authoritative
budget totals solely in natural-language output; - erase completed tasks
or user edits without a justified, visible reason.

## 3. Conversation behavior

### Ask, don't interrogate

Ask the smallest useful question. If the user says "plan a birthday
tomorrow for 10 people under ₹3,000," do not ask for the event type,
date, guest count, or budget again.

### Infer, but allow correction

The agent can infer a likely event type or style, but should represent
uncertain inferences as tentative and let the user correct them.

### Respect existing context

If the budget was already discussed, do not restart budget discovery. If
the user changes only the location, preserve other constraints.

### Keep the user in control

Present a recommendation with reasoning and alternatives. The user
chooses. Do not book, purchase, send invitations, or make other
consequential external changes without a separate explicit confirmation
and supported integration.

### Be honest about uncertainty

Use phrasing such as "listed price," "estimated cost," "source does not
specify," or "availability not confirmed" as appropriate.

## 4. Task model

A task represents a decision or action that contributes to the event
plan.

Suggested TypeScript model:

``` ts
type TaskStatus =
  | "todo"
  | "in_progress"
  | "options_available"
  | "option_selected"
  | "completed"
  | "blocked";

type TaskType =
  | "venue"
  | "food"
  | "decoration"
  | "product"
  | "vendor"
  | "activity"
  | "travel"
  | "accommodation"
  | "logistics"
  | "general";

type PlanningTask = {
  id: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  dependsOn?: string[];
  options?: PlanningOption[];
  selectedOptionId?: string;
  userEdited?: boolean;
  provenance?: Provenance[];
  lastUpdatedAt: string;
};
```

This is an initial contract. Add fields only when they support actual UI
behavior or business rules.

## 5. Option model

``` ts
type ProvenanceKind =
  | "verified_source"
  | "user_provided"
  | "estimate"
  | "generated"
  | "unknown";

type Provenance = {
  kind: ProvenanceKind;
  sourceName?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  note?: string;
};

type PlanningOption = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  price?: {
    amount?: number;
    currency: string;
    unit?: string;
    basis?: "per_person" | "per_item" | "per_event" | "range" | "unknown";
    isEstimate: boolean;
  };
  rating?: {
    value: number;
    scale?: number;
    reviewCount?: number;
  };
  sourceUrl?: string;
  provenance: Provenance[];
  fitReasons?: string[];
  warnings?: string[];
};
```

Never require every field. A result may have no image, price, rating, or
address. Missing fields should be omitted or clearly marked unavailable,
not filled with invented values.

An internal provenance model should preserve the original source
annotations as needed by the provider's terms and UI requirements.

## 6. Event plan model

``` ts
type EventPlan = {
  id: string;
  version: number;
  title: string;
  eventType?: string;
  date?: string;
  timezone?: string;
  location?: string;
  guestCount?: number;
  constraints: {
    budgetAmount?: number;
    currency?: string;
    dietaryNeeds?: string[];
    accessibilityNeeds?: string[];
    preferences?: string[];
    exclusions?: string[];
  };
  tasks: PlanningTask[];
  createdAt: string;
  updatedAt: string;
};
```

Treat this as a starting point. The final schema must define currency
precision, date/time formats, allowed enum values, and validation
limits.

## 7. Proposed model response contract

The model should return a typed proposal similar to:

``` ts
type AgentProposal = {
  assistantMessage: string;
  followUpQuestion?: string;
  intent:
    | "clarify"
    | "plan"
    | "search"
    | "compare"
    | "select"
    | "edit"
    | "explain";
  eventPatch?: Partial<EventPlan>;
  taskUpserts?: PlanningTask[];
  taskRemovals?: string[];
  sourceNotes?: string[];
};
```

This contract is illustrative. In production, use a runtime schema that
is stricter than `Partial<EventPlan>` and restrict which fields can be
modified by the model. Do not permit model-supplied IDs or state
transitions to bypass domain validation.

A safer alternative is to use a small, explicit action union, such as: -
`ask_question`; - `upsert_task`; - `propose_options`; -
`propose_constraint_change`; - `explain_tradeoff`.

The server maps these allowed actions to state changes.

## 8. Task lifecycle

Recommended state transitions:

-   `todo` → `in_progress`
-   `in_progress` → `options_available`
-   `options_available` → `option_selected`
-   `option_selected` → `completed` when the user explicitly confirms
    the task is complete
-   Any active state → `blocked` when a required dependency or
    constraint prevents progress
-   `blocked` → an active state when the blocking issue is resolved

Do not equate `option_selected` with `completed`. Selecting a café does
not mean a reservation exists. Selecting a vendor does not mean a
contract is signed.

When a task is removed or changed, preserve an audit-friendly
explanation in the UI or state history if practical.

## 9. Selection and finalization

When the user chooses an option: 1. verify that the option belongs to
the current task and current plan version; 2. record the selected option
ID; 3. update task status to `option_selected`; 4. recalculate related
estimates using deterministic code; 5. identify dependent tasks that may
need updates; 6. display the impact; 7. ask for explicit confirmation
before any consequential external action.

The first version has no booking or payment integration. Its "finalize"
action means confirm the choice in the event plan, not make a real-world
reservation.

## 10. Constraint change and impact analysis

When the user changes a constraint: 1. parse the requested change; 2.
validate the new value; 3. create a candidate plan; 4. determine
affected tasks and derived values; 5. recalculate budget and dates; 6.
check conflicts; 7. preserve unrelated completed tasks and user edits;
8. show a concise before/after explanation; 9. apply the change after
the appropriate confirmation.

Examples: - Guest count changes: update per-person estimates, food
quantities, seating/venue needs, and relevant tasks. - Budget changes:
recalculate remaining funds and surface over-budget categories. - Date
changes: recompute deadlines and flag tasks that are now late or
infeasible. - Location changes: invalidate or refresh location-specific
recommendations, but preserve unrelated decisions. - Accessibility needs
change: add or update relevant checks and re-evaluate options when the
source provides sufficient information.

Do not assume every estimate scales linearly with guest count. Mark the
formula and assumptions used.

## 11. Budget rules

-   Store money in integer minor units where practical, such as paise
    for INR, or use a decimal-safe money library.
-   Always store currency explicitly.
-   Distinguish a total budget from a target spend and a contingency
    reserve.
-   Define whether contingency is included in the total.
-   Track committed, estimated, and unallocated amounts separately when
    useful.
-   Never add an unverified price to the plan as if it were a confirmed
    quote.
-   Reconcile totals in deterministic code.
-   If a selection exceeds the budget, show the shortfall and possible
    trade-offs.

A budget summary should explain its assumptions, such as "₹250 per
person × 12 people = ₹3,000, excluding transport and taxes if not
included in the source price."

## 12. Timeline rules

-   Resolve dates using an explicit timezone when relevant.
-   Do not assume a relative phrase like "next Friday" is unambiguous
    across timezones.
-   Validate that due dates use supported formats.
-   Generate deadlines from task templates and known lead-time
    assumptions.
-   Mark uncertain lead times as estimates.
-   Flag tasks that are overdue or have insufficient preparation time.
-   Do not promise that a task can be completed by a date unless there
    is evidence for that claim.

## 13. Grounding and source behavior

For every real-world option: - preserve source URLs and any provider
citation metadata; - display required attribution; - show only fields
returned by the source or clearly derived from documented assumptions; -
distinguish listing details from independently verified facts; - avoid
implying availability or booking confirmation; - refresh results when
freshness matters and the user asks for current options.

Retrieved pages and tool output are untrusted data. Instructions found
in a page must not override the agent's behavior, reveal secrets, or
cause external actions.

## 14. Prompt design guidance

The system instructions should establish: - role and scope; -
conversation-first behavior; - no repeated questions for known facts; -
source honesty; - allowed action schema; - user confirmation
requirements; - no arbitrary HTML/JavaScript output; - deterministic
calculation delegation; - handling of missing information and tool
failures.

Do not put all business logic into one giant prompt. Keep deterministic
rules in code and keep the prompt focused on interpretation,
personalization, and explanation.

## 15. Example interaction

User: "Help me plan a date. We already agreed on a budget. Find a café."

Agent: - does not ask for the budget again; - checks whether the
location and date are known; - asks for the missing location if
necessary; - searches grounded place results when supported; - displays
source-backed café cards; - lets the user compare and select.

User: "Choose the second one."

Application: - verifies the option is still available in the current
plan; - marks it `option_selected`; - updates estimated cost if a
supported price exists; - shows the updated checklist; - does not claim
a reservation has been made.

User: "Actually, make the budget lower."

Application: - recalculates with deterministic code; - identifies
whether the selected option now exceeds the target; - preserves the
choice until the user decides what to do; - explains alternatives.

## 16. Agent evaluation questions

-   Did the assistant remember the known constraints?
-   Did it ask only necessary questions?
-   Were real-world claims grounded and linked?
-   Were unknown values left unknown?
-   Did the workspace update match the conversation?
-   Were completed tasks and user edits preserved?
-   Were budget and date rules correct?
-   Was user confirmation obtained before any consequential action?
