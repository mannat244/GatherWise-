import { describe, it, expect, beforeEach } from "vitest";
import {
  savePlanLocally,
  loadPlanLocally,
  clearPlanLocally,
  hasSavedPlanLocally,
  STORAGE_KEY_V1,
} from "@/lib/storage/local-plans";
import { SAMPLE_BIRTHDAY_PLAN } from "@/lib/storage/mock-data";

describe("LocalStorage Plan Persistence", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    const localStorageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    (global as any).window = {
      localStorage: localStorageMock,
    };
  });

  it("persists an event plan and verifies hasSavedPlanLocally", () => {
    expect(hasSavedPlanLocally()).toBe(false);

    const success = savePlanLocally(SAMPLE_BIRTHDAY_PLAN);
    expect(success).toBe(true);
    expect(hasSavedPlanLocally()).toBe(true);

    const raw = mockStorage[STORAGE_KEY_V1];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.plan.title).toBe(SAMPLE_BIRTHDAY_PLAN.title);
  });

  it("loads a saved plan accurately", () => {
    savePlanLocally(SAMPLE_BIRTHDAY_PLAN, [
      {
        id: "msg-1",
        role: "user",
        content: "Hello",
        timestamp: "10:00",
      },
    ]);

    const loaded = loadPlanLocally();
    expect(loaded).not.toBeNull();
    expect(loaded?.plan.title).toBe(SAMPLE_BIRTHDAY_PLAN.title);
    expect(loaded?.messages?.length).toBe(1);
  });

  it("safely handles corrupted storage without crashing", () => {
    mockStorage[STORAGE_KEY_V1] = "{ invalid json ...";
    const loaded = loadPlanLocally();
    expect(loaded).toBeNull();
  });

  it("safely handles schema violations", () => {
    mockStorage[STORAGE_KEY_V1] = JSON.stringify({
      schemaVersion: 999, // unsupported version
      plan: {},
    });
    const loaded = loadPlanLocally();
    expect(loaded).toBeNull();
  });

  it("clears stored plan successfully", () => {
    savePlanLocally(SAMPLE_BIRTHDAY_PLAN);
    expect(hasSavedPlanLocally()).toBe(true);

    clearPlanLocally();
    expect(hasSavedPlanLocally()).toBe(false);
    expect(loadPlanLocally()).toBeNull();
  });
});
