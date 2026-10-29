import { describe, it, expect } from "vitest";
import { applyProposalActions } from "@/lib/planning/proposal-actions";
import { normalizeGroundedOption } from "@/lib/gemini/grounding";
import { EventPlan, AgentProposal } from "@/lib/types/plan";

describe("Proposal Actions Engine & Grounding Provenance Preservation", () => {
  const basePlan: EventPlan = {
    id: "plan-test-1",
    version: 1,
    title: "Gathering Test",
    timezone: "Asia/Kolkata",
    constraints: {
      currency: "INR",
      contingencyPercent: 10,
      dietaryNeeds: [],
      accessibilityNeeds: [],
      preferences: [],
      exclusions: [],
    },
    tasks: [],
    createdAt: "2026-10-22T10:00:00Z",
    updatedAt: "2026-10-22T10:00:00Z",
  };

  it("preserves verified grounding provenance when applying proposed options to the plan", () => {
    // 1. Create a verified option matching a real grounding source
    const verifiedOption = normalizeGroundedOption(
      {
        name: "Truffles Koramangala",
        description: "Burgers & American comfort food",
        price: { amount: 400, currency: "INR", basis: "per_person", isEstimate: true },
      },
      "Koramangala, Bengaluru",
      { title: "Truffles Official Portal", url: "https://truffles.co.in" }
    );

    expect(verifiedOption.provenance[0].kind).toBe("verified_source");
    expect(verifiedOption.provenance[0].sourceUrl).toBe("https://truffles.co.in");

    // 2. Create proposal proposing this option
    const proposal: AgentProposal = {
      assistantMessage: "Here are verified places!",
      intent: "search",
      actions: [
        {
          type: "propose_options",
          taskType: "venue",
          options: [verifiedOption],
        },
      ],
      sourceNotes: ["Verified via Google Grounding"],
    };

    // 3. Apply proposal actions to the event plan
    const { updatedPlan } = applyProposalActions(basePlan, proposal);

    // 4. Assert: Task was auto-created and the verified status was NOT downgraded!
    expect(updatedPlan.tasks.length).toBe(1);
    const venueTask = updatedPlan.tasks[0];
    expect(venueTask.options.length).toBe(1);

    const savedOption = venueTask.options[0];
    expect(savedOption.name).toBe("Truffles Koramangala");
    expect(savedOption.provenance[0].kind).toBe("verified_source");
    expect(savedOption.provenance[0].sourceUrl).toBe("https://truffles.co.in");
    expect(savedOption.provenance[0].sourceName).toBe("Truffles Official Portal");
    expect(savedOption.price?.isEstimate).toBe(true); // Pricing remains honestly estimate
  });

  it("ensures ungrounded options remain marked as estimate and cannot become verified accidentally", () => {
    // 1. Ungrounded option (without a matched grounding source)
    const ungroundedOption = normalizeGroundedOption(
      {
        name: "Mystery Unverified Cafe",
        description: "No grounding citation matched this cafe",
        sourceUrl: "https://arbitrary-blog.com/mention",
      },
      "Bengaluru"
    );

    expect(ungroundedOption.provenance[0].kind).toBe("estimate");

    // 2. Apply to plan
    const proposal: AgentProposal = {
      assistantMessage: "Found an unverified suggestion",
      intent: "plan",
      actions: [
        {
          type: "propose_options",
          taskType: "venue",
          options: [ungroundedOption],
        },
      ],
      sourceNotes: [],
    };

    const { updatedPlan } = applyProposalActions(basePlan, proposal);

    // 3. Assert: Must remain an estimate, never accidentally upgraded
    const savedOption = updatedPlan.tasks[0].options[0];
    expect(savedOption.provenance[0].kind).toBe("estimate");
    expect(savedOption.provenance[0].note).toContain("live verification pending");
  });
});
