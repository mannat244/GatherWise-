# GatherWise Product Specification

## 1. Background

Event planning is not a single question that can be answered with a
one-off list. It is a sequence of interdependent decisions. A user may
need to decide what the event should feel like, how much can be spent,
which venue or service to choose, what must happen first, and what to
change when a constraint moves.

Generic chatbots can generate ideas and checklists, but a user often has
to manually turn the answer into tasks, compare real-world options,
track decisions, recalculate costs, and remember what has already been
agreed. A static dashboard has the opposite weakness: it can track
information but may not understand an evolving, conversational
intention.

GatherWise combines these modes. The user discusses the event naturally;
the application turns the discussion into a structured, editable plan.
The plan is not a static report. It is a living workspace that changes
when the user makes decisions.

## 2. Product vision

**Help people organize real events by turning an evolving conversation
into a feasible, actionable, and user-controlled plan.**

The product should feel like a capable planning partner. It should
understand context, ask useful questions, research relevant options when
appropriate, explain trade-offs, and keep the user's plan organized.

## 3. Product positioning

GatherWise is a conversational event-planning copilot with a
decision-oriented workspace.

It is not merely: - a general-purpose chatbot with an event-themed
prompt; - a static checklist generator; - a directory that claims every
listed venue is available; - a shopping interface that invents product
prices; - an autonomous booking agent.

Its distinctive interaction is the link between conversation and action:
discussing a decision creates or updates a checklist task; selecting an
option updates the plan; changing a constraint triggers an impact
review.

## 4. Users and event types

The system should support natural-language planning for different
gatherings, including weddings, birthdays, dates, community events, and
other event types. It must not force the user to select a fixed category
before they can explain their intent.

Event type is contextual information inferred from the conversation. It
may be stored as a best-effort classification, but the user can correct
it. Unknown or unusual event types should still use the common planning
capabilities.

The product should use one shared planning engine and adapt questions,
task templates, and option categories to the event. It should not build
three separate applications.

## 5. Core problem

Users need help converting an idea into decisions and tasks while
keeping the plan consistent with constraints such as: - total budget and
cost priorities; - date, time, and remaining preparation window; -
location and travel requirements; - guest count and venue capacity; -
food, cultural, dietary, and accessibility needs; - preferences and
atmosphere; - vendor, product, and service availability; - decisions
already made and tasks already completed.

The root problem is not simply a lack of ideas. It is the difficulty of
coordinating information and decisions over time.

## 6. Product principles

### 6.1 Conversation first

Start with a broad prompt. Parse information the user has already
supplied. Do not ask them to repeat it in a form.

### 6.2 Progressive clarification

Ask only questions that are relevant to the current decision. For
example, accommodation is relevant when overnight stays are needed, not
for every birthday.

### 6.3 Actionable workspace

Represent planning progress as tasks and decisions. A task may include a
list of real options, an editable estimate, a due date, dependencies,
and a selected option.

### 6.4 Real data with provenance

Ground current venue or place suggestions through supported services.
Display source links and attribution. Treat missing information as
unknown rather than guessing.

### 6.5 User agency

The agent may recommend and explain, but the user selects options.
Selecting an option is not equivalent to making a booking or purchase.

### 6.6 Deterministic constraints

Use code for arithmetic, date calculations, state transitions, and
validation. Use the model for language understanding, personalized
ideas, and explanations.

### 6.7 Preserve user decisions

When the user edits or replans, do not discard completed tasks or
explicit choices unless they are affected. Explain material changes.

## 7. Main user journey

### Stage 1: Natural-language start

The landing page shows a large prompt, for example: - "Help me plan a
birthday party on October 24 under ₹5,000." - "Help me organize a
wedding in March with a budget of ₹20 lakh." - "I need a small community
fundraiser next month." - "Plan a date night for two somewhere quiet and
affordable."

These are examples, not a restrictive template. Users can enter a
free-form request.

### Stage 2: Interpret and clarify

GatherWise extracts known details and identifies missing information
that matters. It asks a concise follow-up, ideally one question at a
time, unless several details can be collected naturally together.

It should make uncertainty visible. Relative dates must be resolved
against a known timezone and current date; ambiguous dates should be
clarified.

### Stage 3: Open the planning workspace

The interface transitions into: - a chat panel for conversation; - a
main workspace containing the current checklist and decision cards; -
optional context such as budget, date, guest count, and progress.

The workspace should not begin as a wall of charts. The checklist is the
primary organizing surface.

### Stage 4: Work through decisions

Each task can be expanded. Depending on its type, it can contain: - real
venue/place cards; - food or activity ideas; - products from a supported
source; - vendor comparison details; - an editable estimate; - subtasks
and a deadline; - a user choice and a finalization action.

The exact card type depends on the task. Do not show a venue search UI
for a task that only needs a simple checklist.

### Stage 5: Select and finalize

The user selects an option. The application stores the selected option
ID, updates the task state, and updates relevant plan details. If a
selection changes the budget or conflicts with a constraint, show the
impact and ask for confirmation when needed.

"Selected" and "booked" must be distinct states. Only a real, confirmed
booking integration can justify the word "booked."

### Stage 6: Replan

When the user changes the budget, guest count, date, location, or a key
preference, identify affected tasks and calculations. Keep unaffected
user decisions. Explain what changed and why.

### Stage 7: Save and use the plan

The user can revisit the plan in the same browser and print or export a
useful summary. The first version does not promise cross-device
synchronization.

## 8. Interface requirements

### Landing

-   Prominent, accessible free-text prompt.
-   Example prompts that communicate possibilities without restricting
    input.
-   Submit with keyboard and pointer.
-   Clear transition into the workspace.

### Chat

-   Conversation history and pending/error states.
-   Context-aware follow-up questions.
-   Quick-action chips that adapt to current state.
-   Clear indication when external search is being used.
-   Source links and citations for grounded claims.
-   No false claims that a booking, purchase, or external action
    occurred.

### Main workspace

-   Checklist grouped by useful stage or category.
-   Each task has status and may open a specialized option view.
-   Option cards support comparison and selection.
-   Budget and timeline views appear when relevant.
-   Task status and selection changes are reflected immediately.
-   Changes are explainable and reversible where practical.

### Option cards

A card may display: - name and relevant image; - short description and
why it fits; - location and distance when available; - cuisine,
category, or service type; - price or price range with units and
provenance; - rating and review count only when sourced; - source link
and any required attribution; - fit/constraint warnings; - selection
state and a clear action.

Only display fields that are actually available. Missing values must not
be fabricated. Avoid presenting an estimated price as a live quote.

### Accessibility and responsive behavior

-   Semantic headings, labels, buttons, and lists.
-   Keyboard access to all actions.
-   Visible focus indicators and sufficient contrast.
-   Status changes announced accessibly where appropriate.
-   Responsive chat/workspace layout for narrow screens.
-   Do not communicate status by color alone.

## 9. Functional requirements

### FR-1: Understand a brief

Extract event intent and known constraints from natural language. Allow
correction.

### FR-2: Maintain context

Carry relevant information across turns without asking repeatedly for
known values.

### FR-3: Ask follow-ups

Ask for missing information only when needed for a useful or safe next
step.

### FR-4: Create tasks

Generate tasks with stable IDs, titles, statuses, and optional due
dates, dependencies, and task-specific options.

### FR-5: Find real options

Use supported grounding/search tools when the task requires current
external data. Preserve source metadata and citations.

### FR-6: Select options

Allow the user to select one option for a task and update the plan.

### FR-7: Manage estimates

Maintain an editable budget with explicit currency, units, estimate
provenance, and deterministic totals.

### FR-8: Replan

Apply a patch to the plan and identify the affected tasks when
constraints change.

### FR-9: Save

Persist the plan locally in the browser and handle malformed or outdated
saved data safely.

### FR-10: Export

Provide a print-friendly or downloadable plan summary.

### FR-11: Handle failures

Handle model errors, invalid output, search failures, quota limits, and
network interruptions without losing saved work.

## 10. Non-functional requirements

-   **Reliability:** core checklist and budget behavior must work
    without a successful AI call.
-   **Security:** API credentials remain server-side; validate inputs
    and limit request sizes.
-   **Privacy:** collect the minimum data needed and explain local
    storage behavior.
-   **Performance:** avoid unnecessary model calls and external
    searches.
-   **Maintainability:** separate UI, model integration, planning logic,
    and validation.
-   **Accessibility:** keyboard support, labels, contrast, and
    responsive layout.
-   **Transparency:** source links, estimate labels, and clear
    distinction between suggested, selected, and confirmed.
-   **Portability:** setup should be reproducible from the README and
    lockfile.

## 11. Success criteria

A successful MVP allows a new user to: 1. enter an event idea in natural
language; 2. answer a relevant follow-up; 3. see an editable checklist;
4. see grounded real-world options when the feature and source are
available; 5. compare and select an option; 6. see the plan update; 7.
change a major constraint and see the impact; 8. refresh and recover the
saved plan; 9. understand which information is sourced, estimated, or
generated.

Product quality is measured by completed workflows and correct behavior,
not by the number of AI features.

## 12. Explicit non-goals

The MVP does not guarantee that a venue is open, has space, or will
honor a displayed price. It does not book or pay for services. It does
not claim to have verified information when the source has not supplied
it. It does not require users to create an account. It does not use an
LLM as the authority for arithmetic or date validation.

## 13. Open questions

Verify before implementation: - exact challenge vertical/submission
rules; - which Gemini model and grounding tools are available for the
selected API project; - current Search/Maps grounding behavior,
attribution, quotas, and pricing; - whether shopping/product results
require a separate provider; - whether the final submission requires a
live deployment; - whether browser-local persistence is sufficient for
the demo; - default locale, timezone, and currency behavior.
