import { describe, expect, it } from "vitest";
import { countryCategoryDiffs, hasIcp } from "./icp.js";

describe("countryCategoryDiffs", () => {
  it("returns paired category price levels for two known countries", () => {
    const rows = countryCategoryDiffs("USA", "JPN");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.from).toBeGreaterThan(0);
      expect(r.to).toBeGreaterThan(0);
      expect(r.diff).toBeCloseTo(r.to / r.from - 1, 10);
    }
    // Every category is re-based U.S. = 100, so the U.S. side reads 100.
    for (const r of rows) expect(r.from).toBeCloseTo(100, 5);
    // Japan health is far cheaper than the U.S.; food is pricier.
    const health = rows.find((r) => r.key === "health");
    const food = rows.find((r) => r.key === "food");
    expect(health.to).toBeLessThan(100);
    expect(food.to).toBeGreaterThan(100);
  });

  it("reports ICP coverage and returns null when a side is missing", () => {
    expect(hasIcp("USA")).toBe(true);
    expect(hasIcp("ZZZ")).toBe(false);
    expect(countryCategoryDiffs("USA", "ZZZ")).toBeNull();
  });
});
