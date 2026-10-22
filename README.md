# GatherWise

**A conversational, constraint-aware event-planning copilot.**

GatherWise helps people turn an event idea into a practical plan through
a conversation. As the user and assistant discuss the event, GatherWise
builds and updates an interactive checklist containing decisions, tasks,
and real-world options the user can compare and select.

The defining interaction is:

> **The conversation is the control surface; the checklist is the
> evolving result.**

GatherWise is designed for weddings, birthdays, dates, community events,
and other gatherings without forcing users through a rigid event-type
wizard. The agent infers the event context from natural language, asks
relevant follow-up questions, and adapts the workspace as the plan
becomes clearer.

## Product principles

1.  **Conversation-first:** start with a natural-language brief, not a
    long questionnaire.
2.  **Actionable output:** convert discussion into tasks, choices, and
    decisions.
3.  **Real-world grounding:** use supported search and maps capabilities
    for current places and sources; show citations and links.
4.  **Constraint-aware:** respect budget, date, guest count, location,
    preferences, and stated needs.
5.  **User-controlled:** users select and finalize options; the agent
    does not silently book or purchase anything.
6.  **Honest uncertainty:** distinguish verified source information,
    user-provided information, estimates, and generated suggestions.
7.  **Deterministic correctness:** application code validates budgets,
    dates, state transitions, and structured output.
8.  **Incremental changes:** preserve completed tasks and user edits
    when the plan changes.
9.  **Accessible and testable:** support keyboard use, clear status,
    responsive layouts, and reproducible tests.
10. **Small, maintainable scope:** build one reliable workflow before
    adding complex integrations.

## Experience at a glance

1.  The landing page presents a prompt such as: "Help me plan a birthday
    party on October 24 under ₹5,000."
2.  GatherWise extracts what it can: event idea, date, budget, location,
    guest count, and preferences.
3.  It asks only the follow-up questions that materially affect the
    plan.
4.  The UI transitions into a chat panel and a live event workspace.
5.  The workspace shows an actionable checklist. Each task can open
    option cards, such as cafés, venues, food, decoration products, or
    vendors.
6.  Users compare options, select one, and explicitly finalize their
    choice.
7.  The assistant updates relevant tasks, budget estimates, dates, and
    the itinerary without discarding unrelated decisions.

## Example

A user planning a date says that the budget has already been discussed
and asks to choose a café. GatherWise might show cards for two grounded
café listings. Each card can display a name, image where available,
cuisine, price information, rating, location, and source link. The user
chooses one. GatherWise marks it as selected, updates the plan, and asks
whether to continue to the next task.

Any illustrative names, prices, ratings, or images used in mockups must
be labeled as examples. They must not be presented as live verified
results.

## Technology direction

-   **Development environment:** Google Antigravity
-   **Framework:** Next.js App Router with React and TypeScript
-   **AI:** Google Gemini API, with a model and features selected after
    checking current documentation and access
-   **Grounding:** Google Search grounding and Maps grounding where
    supported, enabled only when relevant
-   **Hosting:** Vercel
-   **Initial persistence:** browser-local saved plans; no account
    system required for the first version
-   **Validation:** TypeScript types plus runtime schema validation and
    deterministic planning functions

Antigravity is used to build and verify the application. It is not a
runtime dependency for the deployed product.

## Scope of the first version

### In scope

-   Natural-language event brief and conversational follow-up
-   Chat plus dynamic checklist workspace
-   Task status and task-specific option cards
-   Budget estimates and deterministic calculations
-   Timeline and task prioritization
-   Real-world search results with provenance when supported
-   Selection and finalization of options
-   Replanning when important constraints change
-   Browser-local saving and a printable/exportable summary
-   Error handling, security basics, accessibility, and tests

### Out of scope unless time and APIs permit

-   Actual bookings, payments, or purchases
-   Guaranteed vendor availability
-   A full vendor marketplace
-   User accounts and multi-device synchronization
-   Multi-user collaboration
-   Autonomous actions that commit the user to spending money
-   Complex agent frameworks or multiple agents without a demonstrated
    need

## Run and configuration

The implementation should provide clear setup instructions after the
repository is created. A typical configuration will use a server-only
environment variable such as `GEMINI_API_KEY`. Never expose it through a
`NEXT_PUBLIC_` variable or commit it to Git.

Provide `.env.example` with placeholder names only, `.gitignore`, a
lockfile, tests, and a complete README. The final repository must comply
with the competition's requirements: public repository, one branch, less
than 10 MB, and any official submission rules.

## Documentation map

-   `PRODUCT_SPEC.md` --- product background, users, goals, user
    journeys, requirements, and success criteria.
-   `ARCHITECTURE.md` --- application architecture, state model, data
    flow, grounding, persistence, security, and failure handling.
-   `AGENT_AND_DATA_MODEL.md` --- agent behavior, schemas, task
    lifecycle, source provenance, change impact, and safety rules.
-   `IMPLEMENTATION_AND_EVALUATION.md` --- build sequence, testing,
    acceptance criteria, competition constraints, assumptions, and
    risks.

## Status

This document set defines the intended product and implementation
direction. It is not evidence that the application has already been
implemented, that external APIs are enabled, or that example venues and
prices have been verified.
