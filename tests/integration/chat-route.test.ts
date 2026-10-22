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
});
