import { describe, it, expect } from "vitest";
import { thresholdForLevel, levelFromXp, titleForLevel, levelProgress } from "./leveling";

describe("thresholdForLevel", () => {
  it("returns 0 for level 1", () => {
    expect(thresholdForLevel(1)).toBe(0);
  });

  it("returns 0 for level 0", () => {
    expect(thresholdForLevel(0)).toBe(0);
  });

  it("returns 0 for negative levels", () => {
    expect(thresholdForLevel(-5)).toBe(0);
  });

  it("returns 200 for level 2", () => {
    expect(thresholdForLevel(2)).toBe(200);
  });

  it("returns 500 for level 3", () => {
    expect(thresholdForLevel(3)).toBe(500);
  });

  it("returns 900 for level 4", () => {
    expect(thresholdForLevel(4)).toBe(900);
  });

  it("increases each level (never flat or decreasing)", () => {
    for (let lvl = 2; lvl <= 20; lvl++) {
      expect(thresholdForLevel(lvl)).toBeGreaterThan(thresholdForLevel(lvl - 1));
    }
  });
});

describe("levelFromXp", () => {
  it("returns level 1 at 0 XP", () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it("returns level 1 just below the level 2 threshold", () => {
    expect(levelFromXp(199)).toBe(1);
  });

  it("returns level 2 at exactly 200 XP", () => {
    expect(levelFromXp(200)).toBe(2);
  });

  it("returns level 3 at exactly 500 XP", () => {
    expect(levelFromXp(500)).toBe(3);
  });

  it("returns level 4 at exactly 900 XP", () => {
    expect(levelFromXp(900)).toBe(4);
  });

  it("is consistent with thresholdForLevel", () => {
    for (let lvl = 1; lvl <= 15; lvl++) {
      expect(levelFromXp(thresholdForLevel(lvl))).toBe(lvl);
    }
  });
});

describe("titleForLevel", () => {
  it("returns Fawn at level 1", () => {
    expect(titleForLevel(1)).toBe("Fawn");
  });

  it("returns Young Buck at level 2", () => {
    expect(titleForLevel(2)).toBe("Young Buck");
  });

  it("returns Meadow Scholar at level 5", () => {
    expect(titleForLevel(5)).toBe("Meadow Scholar");
  });

  it("returns Elder Buck at level 15", () => {
    expect(titleForLevel(15)).toBe("Elder Buck");
  });

  it("returns Grand Buck at level 20", () => {
    expect(titleForLevel(20)).toBe("Grand Buck");
  });

  it("returns Grand Buck for levels beyond 20", () => {
    expect(titleForLevel(25)).toBe("Grand Buck");
  });

  it("returns the closest lower title for in-between levels", () => {
    // level 7 is Glade Keeper, level 8 is Ridge Runner — level 6 should be Pine Sage
    expect(titleForLevel(6)).toBe("Pine Sage");
  });

  it("returns Antler Sage for levels 11-14 (gap in TITLES map)", () => {
    expect(titleForLevel(11)).toBe("Antler Sage");
    expect(titleForLevel(13)).toBe("Antler Sage");
    expect(titleForLevel(14)).toBe("Antler Sage");
  });
});

describe("levelProgress", () => {
  it("reports level 1 and 0% progress at 0 XP", () => {
    const p = levelProgress(0);
    expect(p.level).toBe(1);
    expect(p.pct).toBe(0);
    expect(p.intoLevel).toBe(0);
  });

  it("reports correct level and XP when at a threshold boundary", () => {
    const p = levelProgress(200);
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(0);
    expect(p.pct).toBe(0);
  });

  it("reports 100% progress capped correctly when at next threshold", () => {
    const p = levelProgress(500);
    // At exactly level 3, intoLevel is 0 and pct is 0 (just hit the threshold)
    expect(p.level).toBe(3);
    expect(p.pct).toBe(0);
  });

  it("toNext is the remaining XP to the next level", () => {
    const p = levelProgress(300); // level 2, threshold 200, next 500 → toNext 200
    expect(p.toNext).toBe(200);
  });

  it("xp field echoes back the input", () => {
    expect(levelProgress(750).xp).toBe(750);
  });

  it("title matches titleForLevel for the same level", () => {
    const p = levelProgress(900);
    expect(p.title).toBe(titleForLevel(p.level));
  });

  it("reports correct pct mid-level", () => {
    // level 2: threshold 200, next 500, span 300 — at 300 XP: into=100, pct=33
    const p = levelProgress(300);
    expect(p.level).toBe(2);
    expect(p.pct).toBe(33);
  });

  it("spanLevel is the XP range for the current level", () => {
    // level 2: threshold 200, next 500 → span 300
    const p = levelProgress(200);
    expect(p.spanLevel).toBe(300);
  });
});
