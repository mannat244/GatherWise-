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

  it("does not overwrite total budget with menu item prices like ₹2000 for two", () => {
    const planWithBudget: EventPlan = {
      ...dummyPlan,
      constraints: {
        ...dummyPlan.constraints,
        budgetAmount: 3000,
      },
    };

    const proseWithItemPrice = `The total cost for your birthday celebration will depend on choices.
The Hole in the Wall Cafe: The cost for two people is around ₹2000. For your group of 6, this could be ₹6000.
Eskobar: The cost for two people is around ₹800.`;

    const result = parseModelResponseIntelligently(proseWithItemPrice, planWithBudget, dummyGrounding);
    const constraintAction = result.actions.find((a) => a.type === "propose_constraint_change");

    // The budget of 3000 should NOT be overwritten with 2000 or 800
    if (constraintAction && constraintAction.type === "propose_constraint_change") {
      expect(constraintAction.patch.budgetAmount).toBeUndefined();
    } else {
      expect(constraintAction).toBeUndefined();
    }
  });

  it("intelligently parses travel options and auto-creates travel task", () => {
    const travelProse = `You are in Electronic City Phase 2 and need to get to The Grid in Koramangala. Here are your travel options:

**1. Public Bus (Most Economical):**
You can take a BMTC bus route V600KA from Electronic City to Koramangala. Cost is around ₹35 per person.

**2. Metro Feeder Shuttle + Metro:**
Take free ELCITA feeder to metro, then metro to Koramangala. Cost is ₹50 per person.

**3. Ride-Sharing Services (Uber/Ola):**
Direct cab ride. Estimated cost ₹700 to ₹1000 for the ride.`;

    const result = parseModelResponseIntelligently(travelProse, dummyPlan, dummyGrounding);

    // Upserts travel task
    const upsertAction = result.actions.find(
      (a) => a.type === "upsert_task" && a.task.type === "travel"
    );
    expect(upsertAction).toBeDefined();

    // Proposes travel options
    const optionsAction = result.actions.find(
      (a) => a.type === "propose_options" && a.taskType === "travel"
    );
    expect(optionsAction).toBeDefined();
    if (optionsAction && optionsAction.type === "propose_options") {
      expect(optionsAction.options.length).toBeGreaterThanOrEqual(2);
      expect(optionsAction.options[0].category).toBe("travel");
    }
  });

  it("intelligently parses bowling activity options and auto-creates activity task", () => {
    const bowlingProse = `For bowling in Koramangala, here are great entertainment options:

* **The Grid - Gaming Arena:** Located in Koramangala with bowling, VR, and laser tag at ₹380 per person.
* **Timezone Nexus Koramangala:** Bowling alleys and arcade games inside Nexus Mall.
* **Amoeba:** Classic bowling lanes at Garuda Mall.`;

    const result = parseModelResponseIntelligently(bowlingProse, dummyPlan, dummyGrounding);

    const upsertAction = result.actions.find(
      (a) => a.type === "upsert_task" && a.task.type === "activity"
    );
    expect(upsertAction).toBeDefined();

    const optionsAction = result.actions.find(
      (a) => a.type === "propose_options" && a.taskType === "activity"
    );
    expect(optionsAction).toBeDefined();
    if (optionsAction && optionsAction.type === "propose_options") {
      expect(optionsAction.options.length).toBe(3);
      expect(optionsAction.options[0].name).toContain("The Grid");
      expect(optionsAction.options[0].category).toBe("activity");
    }
  });

  it("handles malformed JSON with trailing commas and syntax errors gracefully without crashing", () => {
    const malformed = `\`\`\`json
{
  "assistantMessage": "Here are recommendations",
  "intent": "search",
  "actions": [
    {
      "type": "propose_options",
      "taskType": "venue",
      "options": [{ "name": "Truffles" }],
    },
  ],
}
\`\`\``;

    const result = parseModelResponseIntelligently(malformed, dummyPlan, dummyGrounding);
    expect(result.assistantMessage).toBeDefined();
    expect(result.intent).toBeDefined();
    expect(result.actions).toBeInstanceOf(Array);
  });

  it("safely filters out unknown or malicious action types from model output", () => {
    const dangerousPayload = `\`\`\`json
{
  "assistantMessage": "Processed plan",
  "intent": "plan",
  "actions": [
    {
      "type": "illegal_remote_action",
      "command": "rm -rf /"
    },
    {
      "type": "propose_constraint_change",
      "patch": { "guestCount": 8 }
    }
  ]
}
\`\`\``;

    const result = parseModelResponseIntelligently(dangerousPayload, dummyPlan, dummyGrounding);
    // The illegal action should be strictly filtered out by schema validation
    expect(result.actions.some((a: any) => a.type === "illegal_remote_action")).toBe(false);
    expect(result.actions.some((a) => a.type === "propose_constraint_change")).toBe(true);
  });

  it("safely sanitizes task actions with missing required fields", () => {
    const invalidTaskPayload = `\`\`\`json
{
  "assistantMessage": "Tasks proposed",
  "intent": "plan",
  "actions": [
    {
      "type": "upsert_task",
      "task": {
        "title": "Valid Task",
        "type": "venue"
      }
    },
    {
      "type": "upsert_task",
      "task": {
        "invalidKeyWithoutTitle": true
      }
    }
  ]
}
\`\`\``;

    const result = parseModelResponseIntelligently(invalidTaskPayload, dummyPlan, dummyGrounding);
    // Only the valid task action should survive validation
    const upsertActions = result.actions.filter((a) => a.type === "upsert_task");
    expect(upsertActions.length).toBe(1);
    if (upsertActions[0] && upsertActions[0].type === "upsert_task") {
      expect(upsertActions[0].task.title).toBe("Valid Task");
    }
  });
});
