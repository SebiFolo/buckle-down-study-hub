import { describe, it, expect } from "vitest";
import { dailyKey, weeklyKey, periodStartIso, periodKey } from "./quests";

const d = (iso: string) => new Date(iso);

describe("dailyKey", () => {
  it("returns YYYY-MM-DD for a known date", () => {
    expect(dailyKey(d("2026-05-24T12:00:00Z"))).toBe("2026-05-24");
  });

  it("pads single-digit month and day", () => {
    expect(dailyKey(d("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });

  it("uses UTC date, not local time", () => {
    // 23:00 UTC on the 24th is still the 24th in UTC
    expect(dailyKey(d("2026-05-24T23:00:00Z"))).toBe("2026-05-24");
  });
});

describe("weeklyKey", () => {
  it("returns correct ISO week for a Thursday (anchor day)", () => {
    // Jan 1, 2026 is a Thursday → W01
    expect(weeklyKey(d("2026-01-01T00:00:00Z"))).toBe("2026-W01");
  });

  it("returns W02 for the following Monday", () => {
    // Jan 5, 2026 is a Monday → W02
    expect(weeklyKey(d("2026-01-05T00:00:00Z"))).toBe("2026-W02");
  });

  it("Monday and Sunday of the same week return the same key", () => {
    // May 18 (Mon) and May 24 (Sun) are in the same ISO week
    expect(weeklyKey(d("2026-05-18T00:00:00Z"))).toBe(weeklyKey(d("2026-05-24T00:00:00Z")));
  });

  it("handles year boundary: Dec 29 2025 is in 2026-W01", () => {
    // Jan 1, 2026 is Thursday → W01 starts Dec 29, 2025 (Monday)
    expect(weeklyKey(d("2025-12-29T00:00:00Z"))).toBe("2026-W01");
  });

  it("Dec 28 2025 (Sunday) is in 2025-W52", () => {
    expect(weeklyKey(d("2025-12-28T00:00:00Z"))).toBe("2025-W52");
  });

  it("returns a zero-padded week number", () => {
    // W01 should be padded to two digits
    expect(weeklyKey(d("2026-01-01T00:00:00Z"))).toMatch(/W\d{2}$/);
  });
});

describe("periodStartIso", () => {
  it("daily: returns UTC midnight of the given date", () => {
    expect(periodStartIso("daily", d("2026-05-24T15:30:00Z"))).toBe("2026-05-24T00:00:00.000Z");
  });

  it("weekly: returns UTC midnight of the Monday of the ISO week", () => {
    // May 24, 2026 is Sunday → Monday of that week is May 18
    expect(periodStartIso("weekly", d("2026-05-24T00:00:00Z"))).toBe("2026-05-18T00:00:00.000Z");
  });

  it("weekly: Monday itself returns the same Monday midnight", () => {
    expect(periodStartIso("weekly", d("2026-05-18T12:00:00Z"))).toBe("2026-05-18T00:00:00.000Z");
  });
});

describe("periodKey", () => {
  it("delegates to dailyKey for 'daily'", () => {
    const date = d("2026-05-24T00:00:00Z");
    expect(periodKey("daily", date)).toBe(dailyKey(date));
  });

  it("delegates to weeklyKey for 'weekly'", () => {
    const date = d("2026-05-24T00:00:00Z");
    expect(periodKey("weekly", date)).toBe(weeklyKey(date));
  });
});
