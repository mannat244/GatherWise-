# GatherWise — Final Plan, Invitation & Sharing

## Purpose

The final page should turn the planning conversation into an actionable event hub. It is not just a summary or a static PDF: it helps the user act on decisions, invite people, and see what remains to be done.

## Final-page sections

1. **Event overview**
   - Event name/type, date, time, location, guest count, budget and preferences.
   - Show unknown or unconfirmed details explicitly rather than inventing them.
2. **Budget and decisions**
   - Estimated vs. confirmed costs.
   - Selected options, outstanding choices, contingency and remaining budget.
3. **Places and booking options**
   - Venues, restaurants, activities, vendors, travel or accommodation options when relevant.
   - Each result should show why it fits, an estimate where grounded, location, source, and an appropriate next-step link.
4. **Invitation**
   - Generate invitation wording from the finalized event details.
   - Preview before sharing.
   - Support copy, print/save, and native share where available.
5. **Execution checklist**
   - Remaining tasks, due dates, dependencies, and status.
   - Clearly distinguish chosen, booked, paid, and completed.
6. **Shareable plan**
   - A concise version for collaborators.
   - Print-friendly layout and browser print-to-PDF for the MVP.
   - A public share URL is a later feature requiring server-side storage and access controls.

## Important status distinctions

Do not collapse these states:
- `suggested`: proposed by GatherWise.
- `selected`: user chose the option.
- `booking_started`: user opened or began an external booking flow, if tracked.
- `booked`: user explicitly confirms the booking, or a trusted booking integration verifies it.
- `completed`: the relevant task is finished.

Opening a booking link does not mean a booking occurred. Selecting a venue does not mean it is reserved.

## Invitation generation

The invitation may include:
- Event title and host-provided wording
- Date and time, with timezone when relevant
- Venue and map/directions link
- RSVP instructions/contact details only if supplied by the user
- Dress code or special instructions only if supplied or explicitly approved

Never invent host contact information, venue address, RSVP deadlines, or event details. If required details are missing, use an editable placeholder or ask the user.

## Sharing behavior

MVP:
- Copy invitation text.
- Use the device/browser share sheet when supported.
- Print/save invitation and plan through a print stylesheet.
- Copy a plain-text event summary.

Later:
- Public or invite-only share URL.
- Revocation, expiry, privacy controls, and clear visibility settings.
- Optional collaborator editing with explicit permissions.

## Privacy and safety

- Ask for confirmation before publishing a plan to a public URL.
- Tell users which details will be shared.
- Do not expose private chat history, internal reasoning, API keys, or unrelated personal data in a shared plan.
- Treat venue and vendor pages as untrusted external content.
- Keep external actions user-controlled; do not claim to book, pay, message, or invite people unless the action actually succeeded.

## Acceptance criteria

- Final plan includes event details, budget, selected options, outstanding tasks and source links.
- Invitation details are derived from the current plan and can be edited before sharing.
- Copy and print/save flows work without a third-party account.
- Missing data is labelled instead of fabricated.
- Booking status is never inferred from a click or selection.
- Shared/printed output is readable on mobile and desktop and accessible by keyboard.
- Changes to the event plan update the final page and invitation preview.
