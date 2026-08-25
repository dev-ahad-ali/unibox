import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isWithinServiceWindow } from "@/lib/service-window";

const NOW = new Date("2026-08-25T12:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isWithinServiceWindow", () => {
  it("is open right after an inbound message", () => {
    expect(isWithinServiceWindow(new Date(NOW - 1000).toISOString())).toBe(true);
  });

  it("is open just inside 24 hours", () => {
    expect(isWithinServiceWindow(new Date(NOW - 24 * 3600 * 1000 + 1000).toISOString())).toBe(true);
  });

  it("closes at exactly 24 hours", () => {
    expect(isWithinServiceWindow(new Date(NOW - 24 * 3600 * 1000).toISOString())).toBe(false);
  });

  it("is closed with no inbound message at all", () => {
    expect(isWithinServiceWindow(undefined)).toBe(false);
  });

  it("is closed for an unparseable timestamp", () => {
    expect(isWithinServiceWindow("not-a-date")).toBe(false);
  });

  it("is closed for a future timestamp (clock skew guard)", () => {
    expect(isWithinServiceWindow(new Date(NOW + 60_000).toISOString())).toBe(false);
  });
});
