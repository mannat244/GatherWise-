# GatherWise Implementation, Testing, and Evaluation Plan

## 1. Implementation philosophy

Build the smallest end-to-end workflow that proves the product's core
promise. Do not ask the coding agent to create the entire application in
one uncontrolled prompt.

The work should proceed in inspectable increments. Each stage should
compile, run, and have a clear acceptance test before the next stage is
added.

## 2. Suggested milestones

### Milestone 0 --- Verify the environment

-   Confirm the exact H2S submission instructions and allowed verticals.
-   Confirm Google Antigravity is installed and usable.
-   Create a public GitHub repository with one branch.
-   Confirm Node.js/package-manager versions.
-   Create a Next.js App Router project with TypeScript.
-   Check the current Gemini SDK and selected model's tool support.
-   Create `.env.example`; never add real secrets.
-   Establish the repository-size budget and `.gitignore`.

**Exit condition:** a minimal Next.js app runs locally and the
repository meets the structural rules.

### Milestone 1 --- Build the interaction shell

-   Landing page with natural-language prompt.
-   Chat panel and message list.
-   Main checklist workspace.
-   Responsive layout and keyboard-accessible controls.
-   Mock event plan stored in typed state.
-   Task cards and selection UI using clearly labeled mock data.

**Exit condition:** a scripted conversation can demonstrate the
transition from landing to chat/workspace, and selecting a mock option
updates the checklist.

### Milestone 2 --- Implement the domain engine

-   Event plan and task schemas.
-   Task lifecycle transitions.
-   Budget calculations and money formatting.
-   Timeline/date validation.
-   Constraint-change impact logic.
-   Preservation of user edits and completed tasks.
-   Unit tests for edge cases.

**Exit condition:** the core planning behavior works without an AI API
call.

### Milestone 3 --- Integrate Gemini

-   Server-only Gemini client.
-   Validated request and response schemas.
-   Conversation-aware prompt.
-   Structured planning proposals.
-   Targeted follow-up questions.
-   Error and quota handling.
-   No arbitrary model-generated HTML.

**Exit condition:** a user can describe an event and receive a
structured, validated planning update.

### Milestone 4 --- Add grounded real-world options

-   Verify Search grounding support for the chosen model.
-   Verify Maps grounding support, configuration, and attribution.
-   Implement a grounding adapter.
-   Normalize returned results while retaining source metadata.
-   Display citations and source links in option cards.
-   Clearly distinguish unknown, estimated, and source-provided fields.
-   Add safe fallback when grounding fails.

**Exit condition:** when the user requests real places, the UI shows
actual returned results and citations, or transparently reports that
search is unavailable. No invented listing is presented as real.

### Milestone 5 --- Complete option selection and replanning

-   Select an option for a task.
-   Mark selected versus completed states correctly.
-   Update affected estimates and tasks.
-   Show impact when constraints change.
-   Preserve unaffected decisions.
-   Handle stale responses and concurrent client actions.

**Exit condition:** an end-to-end planning scenario works without losing
user choices.

### Milestone 6 --- Persistence and export

-   Versioned local storage.
-   Safe hydration and migration behavior.
-   Recovery from malformed storage.
-   Print-friendly plan or downloadable summary.
-   Clear indication that local plans are browser-specific.

**Exit condition:** refresh and revisit do not lose a saved plan in the
same browser.

### Milestone 7 --- Hardening and submission

-   Accessibility and mobile review.
-   Lint, type checks, unit tests, integration tests, production build.
-   Test provider failure and invalid model output.
-   Deploy to Vercel and test the live workflow.
-   Review sources, attribution, and secret handling.
-   Check public repository, one branch, repository size under 10 MB.
-   Complete README and official submission steps.

**Exit condition:** a fresh evaluator can run or open the app and
reproduce the main scenario.

## 3. Primary demo scenario

Use one reproducible scenario that shows the distinctive interaction,
not every possible feature.

Example: 1. User enters: "Help me plan a birthday for 12 people in two
days, under ₹5,000." 2. GatherWise asks for location because real place
recommendations require it. 3. The user provides a location and a
preference. 4. The assistant creates a checklist and budget draft. 5.
The user asks to find a café or venue. 6. Grounded options appear with
source links and only the available attributes. 7. The user selects an
option. 8. The task changes to `option_selected`; the estimated budget
updates. 9. The user changes guest count or budget. 10. GatherWise flags
the impact and offers alternatives. 11. The user refreshes and the saved
plan is restored.

Use a birthday/date example for the demo if it is easiest to make
concrete, but keep the engine general. If external API access is not
available during judging, use a clearly labeled demo fixture and explain
that it is sample data; do not disguise it as live search.

## 4. Acceptance tests

### Conversation

-   Known information is not requested again.
-   A missing location is requested before local recommendations.
-   Ambiguous dates are clarified or resolved transparently.
-   The user can correct inferred event type or constraints.

### Checklist

-   Tasks have stable IDs and valid statuses.
-   Selecting an option updates the correct task.
-   Selected and completed states remain distinct.
-   Unrelated tasks survive a plan update.
-   Completed tasks are not silently reset.

### Grounded options

-   Real results retain source URLs and required citations.
-   Missing prices and ratings are omitted or marked unknown.
-   No fabricated availability is shown.
-   A search failure does not generate fake results.
-   Attribution appears as required by the provider.

### Budget

-   Currency is explicit.
-   Arithmetic reconciles exactly at the chosen precision.
-   Per-person estimates state the number of people and assumptions.
-   A budget overrun is surfaced.
-   Editing a price updates totals.
-   Unverified prices remain labeled as estimates or source-provided
    listings.

### Timeline

-   Invalid dates are rejected or clarified.
-   Relative dates use an explicit reference date/timezone.
-   Overdue tasks are flagged.
-   Date changes update affected tasks.
-   The application does not guarantee infeasible completion.

### Security and resilience

-   No API key is present in client bundles or Git.
-   Invalid payloads are rejected.
-   Malformed model output is not applied.
-   Provider failure preserves the current plan.
-   External content cannot execute code or override instructions.
-   Request size and retry counts are bounded.

### Accessibility

-   All actions are keyboard reachable.
-   Inputs have labels.
-   Focus is visible.
-   Status is not conveyed only through color.
-   Layout works on narrow screens.
-   Dynamic status changes are communicated appropriately.

## 5. Competition evaluation alignment

The supplied challenge brief names code quality, security, efficiency,
testing, accessibility, and problem alignment. GatherWise should provide
visible evidence for each.

### Code quality

-   Separate domain rules from UI and provider calls.
-   Use clear types and runtime schemas.
-   Keep components focused.
-   Avoid duplicate planning logic.

### Security

-   Server-side API key.
-   Validated request payloads.
-   Safe handling of retrieved content.
-   No unapproved booking/purchasing.
-   No secrets in the repository.

### Efficiency

-   Ground only when useful.
-   Avoid unnecessary model calls.
-   Limit context size and retries.
-   Keep dependencies and assets small.
-   Avoid unnecessary database infrastructure.

### Testing

-   Unit tests for budget and timeline functions.
-   Integration tests for route validation and structured responses.
-   Manual test of the complete demo.
-   Production deployment smoke test.

### Accessibility

-   Semantic controls, keyboard support, focus indicators, contrast,
    responsive layout.

### Problem alignment

-   The main workflow converts discussion into decisions and tasks.
-   Real-world options have source provenance.
-   Selecting options changes the plan.
-   Constraint changes trigger meaningful updates.

Do not claim that these categories have particular numeric weights
unless the official challenge material confirms those weights.

## 6. Repository and submission constraints

The user-provided competition brief requires: - a public GitHub
repository; - exactly one branch; - repository size below 10 MB; -
complete source code; - a README covering the selected vertical,
approach, operation, and assumptions; - compliance with the official
submission process.

Practical checks: - Commit source code, tests, lockfile, docs, and
`.env.example`. - Exclude `node_modules`, `.next`, build output, local
environment files, logs, and large assets. - Do not commit screenshots,
videos, or binary assets unless necessary. - Check repository size after
the final commit and push. - Verify branch count on GitHub. - Confirm
the repository is public. - Run the app from a fresh clone using the
README.

The official challenge rules take precedence over this checklist if they
specify anything more restrictive.

## 7. Key risks and mitigations

### Risk: broad scope

**Mitigation:** complete one event flow and shared engine first. Event
types are contextual, not separate applications.

### Risk: fabricated or stale information

**Mitigation:** grounding, source links, provenance, honest unknowns,
and no availability claims without evidence.

### Risk: agent overwrites user choices

**Mitigation:** structured patches, stable IDs, plan versions,
preservation rules, and explicit confirmation.

### Risk: model errors

**Mitigation:** runtime schemas, deterministic validation, bounded
retries, graceful failure.

### Risk: provider quota or pricing

**Mitigation:** verify current limits and costs; search only when
useful; provide an honest fallback.

### Risk: API or feature incompatibility

**Mitigation:** verify the selected Gemini model's current grounding and
structured-output support before implementation.

### Risk: sensitive data in browser storage

**Mitigation:** store only what is needed, disclose local persistence,
provide reset/delete, and avoid collecting unnecessary personal details.

### Risk: last-minute deployment failure

**Mitigation:** deploy a thin working version early and test the
deployed route, environment variables, and grounding behavior.

## 8. Assumptions that must be verified

-   The challenge allows the chosen general event-planning approach.
-   Google Antigravity is the intended development environment.
-   A suitable Gemini API key and quota are available.
-   The selected Gemini model supports the desired grounding features.
-   Search/Maps grounding can be used under the applicable terms and
    attribution rules.
-   Vercel deployment is permitted and suitable for the selected
    runtime.
-   Browser-local persistence is enough for the MVP.
-   Any product search beyond general web results can be implemented
    through a permitted source or omitted.
-   The final evaluation environment has access to required services, or
    a transparent fallback is acceptable.

## 9. Submission evidence

Prepare: - public repository URL; - deployed application URL if required
or supported; - README with setup, architecture, assumptions, and test
instructions; - a short demonstration path; - screenshots only if useful
and small; - evidence that the primary flow was tested; - a list of
current limitations.

Never claim that an API integration, test, deployment, or source
verification succeeded unless it has actually been checked.
