import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/chat/route";
import { NextRequest } from "next/server";
import { SAMPLE_BIRTHDAY_PLAN } from "@/lib/storage/mock-data";
import { resetCooldownsForTesting } from "@/lib/rate-limit/cooldown";
import { DEFAULT_GEMINI_MODEL } from "@/lib/gemini/client";

describe("POST /api/chat Route Handler", () => {
  beforeEach(() => {
    resetCooldownsForTesting();
  });
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

  it("preserves selected option and committed spend when travel options are requested", async () => {
    const planWithSelectedVenue = {
      id: "plan-selected-test",
      version: 3,
      title: "Birthday Gathering",
      timezone: "Asia/Kolkata",
      location: "Koramangala, Bengaluru",
      guestCount: 6,
      constraints: {
        budgetAmount: 3000,
        currency: "INR",
        contingencyPercent: 10,
        dietaryNeeds: [],
        accessibilityNeeds: [],
        preferences: ["Good ambiance"],
        exclusions: [],
      },
      tasks: [
        {
          id: "task-venue-1",
          title: "Choose Venue / Cafe",
          type: "venue" as const,
          status: "option_selected" as const,
          priority: "high" as const,
          costBasis: "per_event" as const,
          currency: "INR",
          dependsOn: [],
          selectedOptionId: "opt-grid-1",
          options: [
            {
              id: "opt-grid-1",
              name: "The Grid - Gaming Arena",
              description: "Bowling & gaming",
              category: "venue",
              status: "selected" as const,
              price: {
                amount: 380,
                currency: "INR",
                basis: "per_person" as const,
                isEstimate: true,
              },
              provenance: [{ kind: "verified_source" as const, note: "Verified" }],
              fitReasons: [],
              warnings: [],
            },
          ],
          userEdited: false,
          provenance: [],
          lastUpdatedAt: "2026-10-22T10:00:00Z",
        },
      ],
      createdAt: "2026-10-22T10:00:00Z",
      updatedAt: "2026-10-22T10:00:00Z",
    };

    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "now travel options from electronic city ??" }],
        currentPlan: planWithSelectedVenue,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // 1. The venue task must still have The Grid as selectedOptionId!
    const venueTask = data.updatedPlan.tasks.find((t: any) => t.id === "task-venue-1");
    expect(venueTask).toBeDefined();
    expect(venueTask.selectedOptionId).toBe("opt-grid-1");
    expect(venueTask.options.some((o: any) => o.id === "opt-grid-1")).toBe(true);

    // 2. A travel task was added with options!
    const travelTask = data.updatedPlan.tasks.find((t: any) => t.type === "travel");
    expect(travelTask).toBeDefined();
    expect(travelTask.options.length).toBeGreaterThan(0);

    // 3. Committed spend remains ₹2,280 (380 * 6)
    expect(data.budgetSummary.committedSpend).toBe(2280);
    expect(data.budgetSummary.totalBudget).toBe(3000);
  });

  it("answers cost inquiry with accurate committed spend from confirmed choices", async () => {
    const planWithSelectedVenue = {
      id: "plan-cost-inquiry",
      version: 4,
      title: "Birthday Gathering",
      timezone: "Asia/Kolkata",
      location: "Koramangala, Bengaluru",
      guestCount: 6,
      constraints: {
        budgetAmount: 3000,
        currency: "INR",
        contingencyPercent: 10,
        dietaryNeeds: [],
        accessibilityNeeds: [],
        preferences: [],
        exclusions: [],
      },
      tasks: [
        {
          id: "task-venue-1",
          title: "Choose Venue / Cafe",
          type: "venue" as const,
          status: "option_selected" as const,
          priority: "high" as const,
          costBasis: "per_event" as const,
          currency: "INR",
          dependsOn: [],
          selectedOptionId: "opt-grid-1",
          options: [
            {
              id: "opt-grid-1",
              name: "The Grid - Gaming Arena",
              description: "Bowling & arcade",
              category: "venue",
              status: "selected" as const,
              price: {
                amount: 380,
                currency: "INR",
                basis: "per_person" as const,
                isEstimate: true,
              },
              provenance: [{ kind: "verified_source" as const, note: "Verified" }],
              fitReasons: [],
              warnings: [],
            },
          ],
          userEdited: false,
          provenance: [],
          lastUpdatedAt: "2026-10-22T10:00:00Z",
        },
      ],
      createdAt: "2026-10-22T10:00:00Z",
      updatedAt: "2026-10-22T10:00:00Z",
    };

    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "what was our cost ??" }],
        currentPlan: planWithSelectedVenue,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // Must mention confirmed choice and exact budget status
    expect(data.assistantMessage).toContain("The Grid - Gaming Arena");
    expect(data.assistantMessage).toContain("2,280");

    // Verify observability telemetry
    expect(data.telemetry).toBeDefined();
    expect(data.telemetry.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(typeof data.telemetry.latencyMs).toBe("number");
  });

  it("returns full token telemetry and skips search grounding on local constraint edit", async () => {
    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "we dont need wheelchair accesibility who said that?" }],
        currentPlan: SAMPLE_BIRTHDAY_PLAN,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.telemetry).toBeDefined();
    expect(data.telemetry.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(data.telemetry.searchGroundingFired).toBe(false);
  });

  it("enforces 4-second cooldown rate limit on rapid consecutive requests (15 RPM Free Tier)", async () => {
    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "x-client-id": "cooldown-rate-test-client" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "first quick message" }],
          currentPlan: SAMPLE_BIRTHDAY_PLAN,
        }),
      });

    // 1st request should succeed
    const firstRes = await POST(makeReq());
    expect(firstRes.status).toBe(200);

    // Immediate 2nd request from same client should trigger HTTP 429
    const secondRes = await POST(makeReq());
    expect(secondRes.status).toBe(429);
    expect(secondRes.headers.get("Retry-After")).toBeDefined();

    const data = await secondRes.json();
    expect(data.error).toBe("Rate limit exceeded");
    expect(data.retryAfter).toBeGreaterThanOrEqual(1);
    expect(data.rateLimit.rpm).toBe(15);
    expect(data.rateLimit.rpd).toBe(500);
  });
});
