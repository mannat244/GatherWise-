import { describe, it, expect } from "vitest";
import { parseModelResponseIntelligently } from "@/lib/gemini/parser";
import { EventPlan } from "@/lib/types/plan";

describe("Intelligent Model Response Parser", () => {
  const dummyPlan: EventPlan = {
    id: "plan-1",
    version: 1,
    title: "Birthday Gathering",
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

  const dummyGrounding = {
    isGrounded: true,
    searchQueries: ["burgers in koramangala"],
    sources: [
      {
        title: "Truffles Official",
        url: "https://example.com/truffles",
      },
    ],
  };

  it("parses valid markdown-fenced JSON cleanly", () => {
    const raw = `Here is your plan:
\`\`\`json
{
  "assistantMessage": "Found great places!",
  "intent": "search",
  "actions": [
    {
      "type": "propose_options",
      "taskType": "venue",
      "options": [{ "name": "Truffles" }]
    }
  ]
}
\`\`\``;

    const result = parseModelResponseIntelligently(raw, dummyPlan, dummyGrounding);
    expect(result.assistantMessage).toBe("Found great places!");
    expect(result.actions.length).toBe(1);
    expect(result.actions[0].type).toBe("propose_options");
  });

  it("parses raw JSON without code blocks without throwing SyntaxError", () => {
    const raw = `Sure! {"assistantMessage": "Venue options attached", "intent": "plan", "actions": []}`;
    const result = parseModelResponseIntelligently(raw, dummyPlan, dummyGrounding);
    expect(result.assistantMessage).toBe("Venue options attached");
    expect(result.intent).toBe("plan");
  });

  it("intelligently parses conversational prose starting with 'Here are a few options' without crashing", () => {
    const raw = `Here are a few great options in Koramangala for your birthday with 5 friends under ₹3,000:

1. **Truffles**: Famous for incredible burgers and pizzas with cozy youth vibe in Koramangala 5th Block.
2. **The Hole in the Wall Cafe**: All-day comfort food, burgers, and waffles in Koramangala 4th Block.

Let me know which one you prefer!`;

    const result = parseModelResponseIntelligently(raw, dummyPlan, dummyGrounding);
    expect(result.assistantMessage).toContain("Here are a few great options");

    // Extracted constraints
    const constraintAction = result.actions.find((a) => a.type === "propose_constraint_change");
    expect(constraintAction).toBeDefined();
    if (constraintAction && constraintAction.type === "propose_constraint_change") {
      expect(constraintAction.patch.guestCount).toBe(6); // 5 friends + host
      expect(constraintAction.patch.budgetAmount).toBe(3000);
      expect(constraintAction.patch.location).toContain("Koramangala");
    }

    // Extracted places
    const optionsAction = result.actions.find((a) => a.type === "propose_options");
    expect(optionsAction).toBeDefined();
    if (optionsAction && optionsAction.type === "propose_options") {
      expect(optionsAction.options.length).toBe(2);
      expect(optionsAction.options[0].name).toBe("Truffles");
      expect(optionsAction.options[1].name).toBe("The Hole in the Wall Cafe");
      expect(optionsAction.options[0].location?.directionsUrl).toContain("Truffles");
    }
  });

  it("clears accessibility needs when assistant text notes wheelchair removal", () => {
    const raw = `My apologies! I have removed the wheelchair accessibility requirement from our search.`;
    const result = parseModelResponseIntelligently(raw, dummyPlan, dummyGrounding);

    const constraintAction = result.actions.find((a) => a.type === "propose_constraint_change");
    expect(constraintAction).toBeDefined();
    if (constraintAction && constraintAction.type === "propose_constraint_change") {
      expect(constraintAction.patch.accessibilityNeeds).toEqual([]);
    }
  });
});
