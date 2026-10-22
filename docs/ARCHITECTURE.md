# GatherWise Architecture

## 1. Architecture goals

The architecture should make the central interaction reliable: a
conversation produces a structured plan, and user decisions update that
plan and the visible checklist.

The design prioritizes: - a single Next.js application; - a server-side
Gemini integration; - clear separation between model output and
authoritative application state; - deterministic planning rules; -
external grounding only when needed; - incremental state changes; -
testability and low deployment complexity.

Do not introduce a separate Express server, database, vector database,
multi-agent framework, or job queue unless a concrete requirement
emerges. Next.js Route Handlers are sufficient for the first version.

## 2. Technology stack

-   Next.js App Router
-   React and TypeScript
-   Google Gemini API through a supported official SDK
-   Search grounding and Maps grounding where supported by the selected
    model/API configuration
-   Vercel hosting
-   Browser local storage for initial persistence
-   Runtime schema validation, such as Zod, for untrusted input and
    model output
-   Unit tests for pure planning functions; integration tests for route
    and state behavior

Before implementation, verify current official documentation for SDK
installation, model availability, tool support, structured output,
quotas, pricing, and Vercel runtime constraints. Do not assume that
every Gemini model supports every tool.

## 3. High-level components

### Client

Responsible for: - landing prompt; - chat history and input; - event
workspace and task checklist; - option cards and selection
interactions; - budget and timeline views; - local persistence; -
accessibility and responsive presentation.

The client must not hold the Gemini secret or call privileged APIs
directly.

### Next.js Route Handler

Responsible for: - validating requests and payload size; - validating
session/plan identifiers where applicable; - preparing the model
request; - calling Gemini and supported grounding tools; - validating
the model response; - applying or returning a proposed state patch; -
returning safe errors and structured data.

A route such as `POST /api/chat` is sufficient initially. Split routes
only if the application needs distinct contracts for search, export, or
saved plans.

### Agent orchestration layer

Responsible for: - deciding whether to ask a follow-up or proceed; -
interpreting user intent; - deciding whether external research is
necessary; - requesting structured output; - mapping model output into
allowed application actions; - explaining changes in natural language.

The agent must not directly execute arbitrary code or return raw HTML
for rendering.

### Planning domain layer

Responsible for deterministic rules: - budget totals and remaining
balance; - date parsing and deadline checks; - task state transitions; -
dependency checks; - identifying affected tasks after constraint
changes; - preserving user edits and completed tasks; - checking plan
invariants.

This layer should be pure where possible, independent of React and
Gemini, and covered by unit tests.

### Grounding adapter

Responsible for: - invoking supported search/maps grounding; -
preserving returned source annotations and URLs; - normalizing source
metadata into the app's internal shape; - recording which fields are
sourced, estimated, user-provided, or generated; - handling missing
sources and tool failures.

Do not scrape sites or invent unsupported API behaviors. A shopping
integration is separate from general Search grounding and should be
added only when a permitted, suitable data source is verified.

## 4. Data flow

1.  The client submits a user message and the relevant conversation/plan
    state.
2.  The server validates message length, event data, and allowed request
    fields.
3.  The agent interprets the message and decides whether it needs
    clarification, a planning update, or external information.
4.  If external information is required and supported, the server calls
    the relevant grounded capability.
5.  The model returns a structured proposal, not arbitrary UI code.
6.  Runtime validation checks the response shape.
7.  The domain layer applies deterministic rules and validates
    invariants.
8.  The server returns the assistant message, validated state patch,
    source metadata, and any required follow-up.
9.  The client applies the patch and renders the affected task cards.
10. The updated plan is saved locally.

A model response should not be blindly merged into the plan. Treat it as
a proposal that must pass schema and domain validation.

## 5. State separation

Maintain separate but linked state for:

### Conversation

-   messages;
-   message IDs;
-   timestamps;
-   pending/error status;
-   relevant tool/source metadata.

### Event plan

-   event identity and user-approved constraints;
-   tasks;
-   task options;
-   selected option IDs;
-   budget;
-   timeline;
-   plan version;
-   last-updated timestamp.

### UI state

-   current input;
-   expanded task;
-   selected tabs or filters;
-   loading indicators;
-   temporary confirmation dialogs.

Do not reconstruct the entire event plan from chat history on every
render. Store the plan as structured state and update it using explicit
patches.

## 6. Suggested folder structure

``` text
app/
  page.tsx
  layout.tsx
  globals.css
  api/
    chat/
      route.ts
components/
  landing/
  chat/
  workspace/
  tasks/
  options/
  budget/
  timeline/
lib/
  gemini/
    client.ts
    prompts.ts
    grounding.ts
  agent/
    orchestrator.ts
    schemas.ts
    actions.ts
  planning/
    types.ts
    budget.ts
    timeline.ts
    task-state.ts
    change-impact.ts
  storage/
    local-plans.ts
  validation/
    request.ts
tests/
  unit/
  integration/
```

Keep the initial implementation small. The folder structure expresses
boundaries, not a requirement to create empty modules for every future
idea.

## 7. Agent decision loop

The agent should follow a bounded loop:

1.  Understand the user's latest message in context.
2.  Identify the requested outcome: clarify, plan, search, compare,
    select, edit, or explain.
3.  Check which required facts are already known.
4.  Ask a targeted question if a critical fact is missing.
5.  Determine whether current external data is necessary.
6.  Call the appropriate supported capability only when needed.
7.  Produce a structured proposal.
8.  Validate the proposal and domain invariants.
9.  Return a concise explanation and the workspace update.
10. Wait for the user's next action.

Do not build an unbounded autonomous loop. Limit tool calls, payload
size, retries, and execution time. Require explicit user action for
consequential choices.

## 8. External data and grounding

### Search

Use Search grounding for current information and source-backed research
when appropriate. Preserve citations and source URLs as returned. Show
the sources associated with claims in the UI.

### Maps

Use Maps grounding when location-aware place recommendations are needed
and supported. Preserve required attribution and source details. Do not
infer a place's availability, capacity, accessibility, or opening status
unless a reliable source provides that information.

### Shopping and vendors

Search grounding is not a guarantee of structured product inventory or
checkout-ready prices. If the product requires exact prices, stock, or
product images, integrate a suitable permitted provider. Otherwise, show
source links and label the data accurately.

### Provenance

Every external field should be classified as one of: -
`verified_source`: directly returned by a recognized source, within the
limits of that source; - `user_provided`: supplied or confirmed by the
user; - `estimate`: computed or estimated from stated assumptions; -
`generated`: model-generated creative content; - `unknown`: not
available.

A source-backed rating is not proof that a venue is suitable. A
displayed price is not a booking quote. A listing is not confirmation of
availability.

## 9. Persistence

For the MVP, use browser local storage for plans and task status. Use a
versioned storage envelope so future schema changes can migrate or
reject old data safely.

Requirements: - validate data when loading; - handle malformed or
quota-exceeded storage; - avoid storing unnecessary sensitive details; -
provide a clear way to reset/delete the local plan; - do not store API
keys or secrets; - do not imply that local data is synchronized across
devices.

If multi-device access or sharing becomes a requirement, evaluate a
database and authentication separately. Do not add them pre-emptively.

## 10. Security

-   Store the Gemini key in a server-only environment variable.
-   Never use a `NEXT_PUBLIC_` prefix for secrets.
-   Never commit `.env.local` or credentials.
-   Validate user input and model output at runtime.
-   Enforce request-size limits and reasonable tool-call limits.
-   Return safe error messages; do not expose stack traces or
    credentials.
-   Avoid rendering model-generated HTML.
-   Treat web content and retrieved text as untrusted data, not
    instructions.
-   Do not let external content override system policy or execute
    actions.
-   Do not implement booking or purchasing without a separate, explicit,
    user-confirmed workflow.
-   Follow provider terms, attribution rules, and data-retention
    requirements.

## 11. Reliability and failure behavior

### Gemini unavailable

Preserve the current plan. Explain that AI assistance is temporarily
unavailable. Permit manual task edits and deterministic budget
calculations.

### Grounding unavailable

Do not invent search results. Offer to retry or continue with the
current plan. Any sample content must be visibly marked as illustrative.

### Invalid model output

Reject the output, retry in a bounded way if appropriate, or fall back
to a safe clarification/error response. Never apply a malformed patch.

### Stale or conflicting update

Use plan versioning or an equivalent stale-update check so a delayed
response cannot overwrite a newer user action.

### Local storage failure

Keep the in-memory plan usable and tell the user it could not be saved.

## 12. Performance and cost controls

-   Do not search the web for every message.
-   Search only when current external information materially helps.
-   Cache only where permitted and where freshness rules are understood.
-   Limit conversation history sent to the model; retain a concise state
    summary when needed.
-   Keep images optimized and avoid large bundled assets.
-   Avoid background polling and unnecessary API calls.
-   Record basic request/error timing during development without logging
    secrets or unnecessary personal data.
-   Check provider quotas and cost implications before enabling
    grounding by default.

## 13. Deployment

Use Vercel for the Next.js application. Configure environment variables
in the deployment environment. Run lint, type checks, tests, and a
production build before deployment.

After deployment, test: - initial page load; - chat request; - grounding
and citation display; - malformed request behavior; - AI-provider
failure behavior; - browser persistence; - mobile layout; - environment
variable configuration.

A successful deployment is not complete until the primary workflow has
been exercised in the hosted environment.
