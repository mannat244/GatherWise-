import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/chat/route";
import { NextRequest } from "next/server";
import { SAMPLE_BIRTHDAY_PLAN } from "@/lib/storage/mock-data";

describe("POST /api/chat Route Handler", () => {
  it("rejects invalid request payloads with HTTP 400", async () => {
    const invalidReq = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ invalidField: "bad" }),
    });

    const res = await POST(invalidReq);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid request payload");
  });

  it("processes a valid message and applies deterministic planning proposals", async () => {
    const validReq = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "user", content: "We now have 18 guests joining instead." },
        ],
        currentPlan: SAMPLE_BIRTHDAY_PLAN,
      }),
    });

    const res = await POST(validReq);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.assistantMessage).toBeDefined();
    expect(data.updatedPlan.guestCount).toBe(18);
    // Version incremented
    expect(data.updatedPlan.version).toBe(SAMPLE_BIRTHDAY_PLAN.version + 1);
    // Budget summary returned
    expect(data.budgetSummary).toBeDefined();
    expect(data.budgetSummary.totalBudget).toBe(5000);
  });

  it("parses user prompt with 5 friends in Koramangala under 3000 into clean constraints", async () => {
    const cleanPlan = {
      id: "plan-clean-test",
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

    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Help me plan a birthday party with 5 friends in kormangala under 3000",
          },
        ],
        currentPlan: cleanPlan,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.updatedPlan.guestCount).toBe(6); // 5 friends + host
    expect(data.updatedPlan.constraints.budgetAmount).toBe(3000);
    expect(data.updatedPlan.location).toContain("Koramangala");
    expect(data.updatedPlan.constraints.accessibilityNeeds.length).toBe(0); // Zero unstated assumptions!
    expect(data.updatedPlan.tasks.length).toBeGreaterThan(0); // Auto-populated tasks
    const venueTask = data.updatedPlan.tasks.find((t: any) => t.type === "venue");
    expect(venueTask).toBeDefined();
    expect(venueTask.options.length).toBeGreaterThan(0); // Real options attached!
  });

  it("removes wheelchair accessibility when user requests removal", async () => {
    const planWithWheelchair = {
      ...SAMPLE_BIRTHDAY_PLAN,
      constraints: {
        ...SAMPLE_BIRTHDAY_PLAN.constraints,
        accessibilityNeeds: ["Wheelchair accessible entrance"],
      },
    };

    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "we dont need wheelchair accesibility who said that?",
          },
        ],
        currentPlan: planWithWheelchair,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.updatedPlan.constraints.accessibilityNeeds).toEqual([]); // Successfully cleared!
  });
});
