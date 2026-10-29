# GatherWise 🎈

**A Conversational, Constraint-Aware Event-Planning Copilot**

> *"The conversation is the control surface; the checklist is the evolving result."*

GatherWise bridges the gap between conversational AI and structured planning. Instead of generating static walls of bullet points or rigid directory wizards, GatherWise turns natural-language discussion into an **actionable, editable workspace** with a dynamic task checklist, grounded venue/service recommendations, deterministic budget calculations, constraint-aware replanning, and a finalized event hub.

---

## 🌟 Key Product Innovations

1. **Conversational Control Surface, Structured Living Result**: Discuss your event naturally; GatherWise extracts intents, dates, guests, and budgets into structured task items rather than passive text.
2. **Deterministic Arithmetic**: Budgets, per-person multiplications, contingency reserves, and overage detection are computed exclusively by pure TypeScript code—never delegated to LLM hallucination.
3. **Google Search Grounding with Honest Provenance**: Real places, venues, and transit options are discovered using live Google Search Grounding via the official `@google/genai` SDK. Missing details are marked as estimates rather than fabricated, and official Google Maps directions links are provided for every verified address.
4. **Accurate Option-Level Grounding Attribution**: Every proposed option is independently verified against candidate search sources by token and domain matching. Only places with matching citations are marked `verified_source`; unmatched options are labeled `estimate` with live verification pending.
5. **Constraint-Aware Replanning**: If your guest count shifts from 10 to 20 or your budget drops to ₹4,000, GatherWise recalculates affected items, flags budget impacts, and **strictly preserves completed tasks and user manual edits**.
6. **Final Event Hub & Export**: Transition smoothly from planning to execution with an editable invitation generator, native Web Share API (`navigator.share`), one-click Markdown download, and print-to-PDF layout (`@media print`).
7. **Graceful Offline Fallback & Explicit Sample Mode**: Works with a Gemini API key for live search grounding and AI reasoning, or seamlessly in deterministic offline copilot mode with zero configuration. Offline samples are visibly labeled so evaluators can inspect every feature immediately.

---

## 🎯 Chosen Vertical & Target Persona

* **Vertical**: **Event Planning & Social Gathering Copilot** (Casual & Milestone Gatherings: Birthdays, Group Outings, Team Celebrations, Dinners, and Weekend Activities).
* **Target Persona**: The **"Reluctant Group Organizer"** — someone coordinating friends or colleagues who needs to balance shifting guest counts, strict budgets, varied preferences, and transport logistics. Instead of drowning in endless chat text or filling out rigid forms, they need an intelligent copilot that turns ideas into a living, editable checklist with verified places and deterministic budget numbers.

---

## 💡 Approach and Logic

1. **Dual-Surface Interface ("Conversation as Control, Checklist as Result")**:
   Natural language conversation acts as the primary control surface. The copilot extracts entities, constraints, and tasks, projecting them into a real-time reactive workspace.
2. **Deterministic Arithmetic Boundary**:
   LLMs are notoriously prone to math errors and budget hallucinations. In GatherWise, **zero financial math is left to the AI**. All per-person costs, committed vs. estimated totals, contingency reserves, and overage detection are computed by pure TypeScript domain engines (`lib/planning/budget.ts`).
3. **Constraint-Aware Replanning**:
   Events are volatile. When constraints change (e.g., guest count jumps from 6 to 10 or budget drops), GatherWise re-evaluates the plan, updates estimates dynamically, and **strictly preserves completed tasks and user-finalized choices**.
4. **Selective Google Search Grounding with Honest Provenance**:
   Google Search Grounding is triggered only for external discovery requests to conserve quota. Every recommended place is matched specifically against candidate search sources by token and domain. Only matching options receive `verified_source`; ungrounded options remain honestly labeled as `estimate`.

---

## ⚙️ How the Solution Works

1. **Brief Ingestion & Server Validation**:
   The user inputs an event idea (e.g., *"Help me plan a birthday for 6 friends in Koramangala under ₹3,000"*). The Next.js Route Handler validates request bounds with Zod, checks the 4-second rate-limit cooldown, and derives client identity from trusted headers.
2. **Selective Tool Gating & Directive Prompting**:
   If external recommendations are needed, the Google Search tool is attached, and Gemini is commanded with a zero-stalling directive to query Google Search immediately. For local inquiries (budget questions, constraint removals), the search tool is skipped to save tokens.
3. **Resilient Schema Parsing & Action Sanitization**:
   The response is parsed by a robust parser. If full schema validation fails, fallback actions are individually sanitized against `AgentActionSchema.safeParse`, ensuring malformed model output never corrupts domain state.
4. **Deterministic Domain Execution**:
   Validated actions (`upsert_task`, `propose_options`, `propose_constraint_change`, `select_option`) are applied through pure domain modules (`proposal-actions.ts`, `change-impact.ts`), recalculating the budget deterministically.
5. **Interactive Workspace & Final Event Hub**:
   The user explores places with verified Google Maps links, selects choices, reviews token telemetry, and transitions to the **Final Event Hub** to view the auto-generated invitation, share via Web Share API, export as Markdown, or print to PDF.

---

## 📝 Assumptions Made

1. **Free-Tier API Quota Baseline**:
   The solution is architected around the `gemini-3.5-flash-lite` Free Tier (15 RPM / 500 RPD). The system enforces a 4-second message cooldown pacing and client daily quota tracking to prevent rate-limit 429 exhaustion.
2. **Planning Copilot vs. Transactional Booking**:
   GatherWise coordinates decisions, budgets, and recommendations. It does not process monetary payments or place automated table holds; prices discovered from search snippets are treated as estimates (`isEstimate: true`), and direct official links are provided for manual booking.
3. **Local-First Privacy Architecture**:
   Event plans and chat histories are stored entirely client-side in browser `localStorage` using a versioned schema (`v1`), ensuring zero server-side user data retention.
4. **Offline Resilience & Sample Mode**:
   If no `GEMINI_API_KEY` is provided, GatherWise gracefully operates in a deterministic Sample Mode, clearly labeled as unverified sample data so evaluators can test the complete UI and export flow without API setup.

---

## 🏗️ Architecture & Technology Stack

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js App Router)                     │
│                                                                        │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │       Chat Panel        │  │         Live Workspace               │ │
│  │ - Conversation stream   │  │ - Plan Header & Constraints          │ │
│  │ - Clarification chips   │  │ - Deterministic Budget Bar           │ │
│  │ - Grounding indicators  │  │ - Categorized Task Checklist         │ │
│  │ - Pacing cooldown badge │  │ - Option Drawer (Citations/Links)    │ │
│  │                         │  │ - Final Event Hub & Invitation Preview││
│  └────────────▲────────────┘  └──────────────────▲───────────────────┘ │
│               │                                  │                     │
│               └─────────────────┬────────────────┘                     │
│                                 │ React State / Context Reducer        │
│                                 ▼                                      │
│               ┌───────────────────────────────────┐                    │
│               │ LocalStorage Envelope (v1 Schema) │                    │
│               └───────────────────────────────────┘                    │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ POST /api/chat
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      SERVER (Next.js Route Handler)                    │
│                                                                        │
│  1. Request & Payload Bounds (Zod Schema Validation)                  │
│  2. Server-Derived Rate Limiting (15 RPM / 4s cooldown pacing)         │
│  3. Deterministic Tool Gating & System Prompt Directive:               │
│     ├── Discovery Queries -> Google Search Grounding Tool ACTIVE       │
│     └── Local Planning/Budget Queries -> Search Gated, Pure Arithmetic │
│  4. Gemini Model Execution (@google/genai SDK):                        │
│     ├── Candidate & Grounding Metadata Extraction                      │
│     └── Observability Telemetry (latency, token counts, cost estimate) │
│  5. Proposal Parsing & Fallback Action Sanitization (Zod SafeParse)    │
│  6. Domain Execution Engines (Pure TypeScript Modules):               │
│     ├── lib/planning/proposal-actions.ts (Deterministic State Updates) │
│     ├── lib/planning/budget.ts (Committed vs Estimated Calculations)   │
│     ├── lib/planning/change-impact.ts (Constraint Sensitivity Analysis)│
│     ├── lib/planning/plan-factory.ts (Clean Entity Initialization)     │
│     └── lib/planning/offline-copilot.ts (Sample Mode Fallback)         │
│  7. Response Formulation (Message + Validated Plan + Budget + Telemetry)│
└────────────────────────────────────────────────────────────────────────┘
```

- **Framework**: Next.js 15 (App Router, React 19)
- **Language**: TypeScript 5 with strict compiler verification (`tsc --noEmit`)
- **Styling**: Tailwind CSS with custom palette and dedicated `@media print` rules
- **AI SDK**: Official `@google/genai` (v2.30.0) with Google Search Grounding
- **Default AI Model**: `gemini-3.5-flash-lite` (Free Tier: 15 RPM, 500 RPD, 250k TPM)
- **Rate Limit & Quota Protection**: Client & server 4s message cooldown pacing (15 RPM) and 500 RPD daily request counter
- **AI Observability**: Live token telemetry (prompt, candidate, grounding search tokens), round-trip latency, and transparent `null`/`unmeasured` status handling
- **Validation**: Zod (runtime validation on all API requests, responses, and localStorage state)
- **Testing**: Vitest (64 automated unit and integration tests across 12 suites)
- **Icons**: Lucide React

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
- Node.js `v20+` or `v22+`
- `pnpm` (`v10+` recommended)

### 2. Clone and Install
```bash
git clone https://github.com/mannat244/GatherWise-.git
cd gatherwise
pnpm install
```

### 3. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env.local
```
Edit `.env.local` to provide your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```
> *Note: If `GEMINI_API_KEY` is not provided, GatherWise automatically runs in deterministic offline copilot mode, allowing full inspection of the checklist, budget bar, replanning, and export features without an API key.*

### 4. Run Development Server
```bash
pnpm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Type Check & Verification Suite
```bash
pnpm run type-check
```
Executes `tsc --noEmit` to verify type safety across all components, API routes, domain engines, and test mocks with zero compilation errors.

### 6. Run Unit & Integration Tests
```bash
pnpm test
```
Executes all **64 automated unit and integration tests across 12 test suites** verifying:
- Deterministic budget calculations & per-person scaling
- Task state machine transitions & provenance preservation on proposal updates
- Option-level grounding source matching & honest estimate fallbacks (never marking options verified merely from URLs)
- Dynamic token & tool cost estimation across billing tiers and model configurations
- Model parser edge cases (malformed JSON, unknown actions, missing fields)
- Rate limit cooldown enforcement & daily quota management
- Chat API route integration & offline fallback orchestration

### 7. Production Build
```bash
pnpm run build
```
Creates an optimized production build validating static pages, dynamic server handlers, and build traces.

---

## 🎬 Recommended Demo Walkthrough

Follow this sequence to evaluate the complete end-to-end user journey:

1. **Natural-Language Ingestion**:
   - On the landing page, enter:
     > *"Help me plan a birthday party for 12 people this Saturday in Koramangala under ₹5,000."*
   - Or click the **Instant Inspection: Load Sample Birthday Plan** button to load the full scenario immediately.
2. **Review Checklist & Deterministic Budget Bar**:
   - Observe the live workspace: Venue, Cake, Snacks, and Logistics tasks are populated with estimated costs.
   - The stacked budget bar shows committed spend, estimated spend, and contingency reserve.
3. **Inspect Grounded Places**:
   - In the "Choose Birthday Venue / Cafe" task, click **options**.
   - Review the verified option cards:
     - Notice the **Verified Source** badge.
     - Click **Directions** to open the real Google Maps destination link.
     - Click **View Source** to see source attribution.
4. **Make a Decision**:
   - Click **Choose this Option** on a venue.
   - Watch the task transition to `Selected for Plan`, and observe the budget bar dynamically promote estimated spend into committed spend.
5. **Test Constraint-Aware Replanning**:
   - In the chat panel or via **Adjust Constraints**, type or select:
     > *"We have 15 guests instead of 12"*
   - Observe that per-person food estimates scale to 15 guests, the budget bar updates, and **completed tasks and your selected venue are strictly preserved**.
6. **Open Final Event Hub**:
   - Click **Final Event Hub** in the top navigation.
   - Review confirmed decisions, pending actions, and the auto-generated invitation preview.
   - Click **Copy Text** or **Share** to distribute the invitation.
   - Click **Download (.md)** to export the complete plan to disk, or **Print to PDF** for a distraction-free print layout.

---

## 🛡️ Hackathon Submission Verification

- **Branch Count**: Exactly one branch (`main`).
- **Repository Size**: ~274 KiB (verified with `git count-objects -vH`, strictly under the 10 MB limit).
- **Security & Secret Protection**: All Gemini API calls run server-side via Next.js Route Handlers. `.env.local` is ignored and zero credentials are committed to Git. Cooldown bypass is locked in production, and client identifiers are derived securely from server headers.
- **Strict Code Quality & Boundaries**: Decoupled domain engines (`lib/planning/`) from UI components and API handlers. Schema-validated action application with zero unsafe `any` assertions in core paths.
- **Test Coverage**: 64 tests passing across 12 test suites (`pnpm test`).
- **Reproducible Build**: Clean compilation with `tsc --noEmit` and `next build`.

---

## 📚 Living Documentation Map

Detailed design specifications are stored in the [`docs/`](docs/) directory:
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — Problem statement, product vision, user journey, and success criteria.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System boundaries, data flow, grounding adapter, and security rules.
- [`docs/AGENT_AND_DATA_MODEL.md`](docs/AGENT_AND_DATA_MODEL.md) — Agent behavior, schemas, task lifecycle, and action union.
- [`docs/REAL_WORLD_DISCOVERY.md`](docs/REAL_WORLD_DISCOVERY.md) — Google Search/Maps grounding, booking link verification, and failure modes.
- [`docs/FINAL_PAGE_UX_FLOW.md`](docs/FINAL_PAGE_UX_FLOW.md) — Event hub layout, invitation generation, and print behavior.
- [`docs/FINAL_PLAN_AND_SHARING.md`](docs/FINAL_PLAN_AND_SHARING.md) — Sharing policies, privacy boundaries, and status distinctions.
- [`docs/IMPLEMENTATION_AND_EVALUATION.md`](docs/IMPLEMENTATION_AND_EVALUATION.md) — Implementation milestones, risk mitigations, and competition evaluation criteria.

---

## 📄 License
MIT License. Built for the GenAI Hackathon.
