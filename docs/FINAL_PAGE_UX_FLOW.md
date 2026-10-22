# GatherWise — Final Page UX Flow

## User journey

1. User starts with a natural-language event idea.
2. GatherWise asks only necessary follow-up questions.
3. The live workspace evolves: chat, tasks, budget, schedule and decisions.
4. User explores relevant places/services and selects options.
5. GatherWise updates the plan and explains meaningful constraint impacts.
6. User chooses **Finalize my plan**.
7. A review step summarizes confirmed details, estimates, unverified items and remaining tasks.
8. User confirms and opens the final event hub.

## Final event hub layout

### Header
- Event name and date
- Edit plan action
- Plan status and last-saved indicator

### Overview
- Guests, location, budget and key preferences
- Budget summary: estimated, confirmed and remaining
- Clear distinction between planned and completed actions

### Recommended next steps
- Primary unresolved decisions
- Upcoming tasks and due dates
- Warnings for unverified venue availability or missing information

### Places and services
- Filter by relevant category
- Option cards with rationale, price basis, location and source
- Actions: view source, directions, booking/contact link, select/replace
- Do not imply selection equals booking

### Invitation
- Editable invitation preview
- Include only details the user has provided or approved
- Actions: copy text, share using browser/device capabilities, print/save

### Plan export
- Print-friendly event summary
- Checklist, budget, selected options, links and unresolved decisions
- Use browser print-to-PDF for the first version

## Constraint changes after finalization

The plan remains editable. If the user changes the date, guest count or budget:
- Recalculate deterministic values.
- Identify affected tasks and recommendations.
- Preserve unrelated selections and completed tasks.
- Explain what changed and why.
- Mark stale source information as needing re-check where relevant.
- Refresh the invitation preview from the updated plan.

## Accessibility and responsive behavior

- Keyboard-operable controls and visible focus.
- Semantic headings and labels.
- Do not rely on color alone for status.
- Adequate contrast and touch targets.
- Cards and invitation preview must work on narrow screens.
- Announce meaningful state changes to assistive technology.
- Provide text alternatives for icons and meaningful images.

## MVP boundary

Include:
- Final event hub
- Real source/booking/directions links where verified
- Copyable invitation
- Native share when supported
- Print-friendly plan and invitation
- Editable plan and checklist

Defer:
- Payments and in-app bookings
- Guaranteed live availability
- Automatic messaging to invitees
- Public share links until storage, privacy and access controls exist
- Collaborative multi-user editing

## Demo sequence

1. Describe an event in one sentence.
2. Answer one targeted follow-up.
3. Review the generated task list and budget.
4. Open a grounded venue/activity suggestion.
5. Select an option.
6. Change a constraint and show only the affected plan changes.
7. Finalize the plan.
8. Show the event hub, booking/directions links, invitation preview and print/share actions.
