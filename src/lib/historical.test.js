import { describe, expect, it } from "vitest";
import {
  CPI_FIRST_YEAR,
  CPI_LAST_YEAR,
  CURRENT_YEAR,
  clampYear,
  cohort,
  cohortForYear,
  componentInflation,
  cpiRatio,
  hasCpi,
  medianIncome,
} from "./historical.js";

describe("cpiRatio", () => {
  it("is exactly 1 for the same year (adjustment vanishes)", () => {
    expect(cpiRatio(2000, 2000)).toBe(1);
    expect(cpiRatio(CURRENT_YEAR, CURRENT_YEAR)).toBe(1);
  });

  it("is > 1 going forward in time and its inverse going back", () => {
    const fwd = cpiRatio(1985, CPI_LAST_YEAR);
    expect(fwd).toBeGreaterThan(1);
    // $100 in 1985 is worth well over $200 today.
    expect(fwd).toBeGreaterThan(2);
    expect(cpiRatio(CPI_LAST_YEAR, 1985)).toBeCloseTo(1 / fwd, 10);
  });

  it("chains consistently across an intermediate year", () => {
    const direct = cpiRatio(1990, 2020);
    const chained = cpiRatio(1990, 2005) * cpiRatio(2005, 2020);
    expect(chained).toBeCloseTo(direct, 10);
  });

  it("throws for a year outside the series", () => {
    expect(() => cpiRatio(1800, 2000)).toThrow();
    expect(hasCpi(1800)).toBe(false);
    expect(hasCpi(CPI_FIRST_YEAR)).toBe(true);
  });
});

describe("clampYear", () => {
  it("bounds to the CPI coverage window", () => {
    expect(clampYear(1800)).toBe(CPI_FIRST_YEAR);
    expect(clampYear(3000)).toBe(CPI_LAST_YEAR);
    expect(clampYear(2000)).toBe(2000);
  });
});

describe("cohorts", () => {
  it("looks up a cohort by key", () => {
    expect(cohort("millennial").label).toBe("Millennials");
    expect(cohort("nope")).toBeNull();
  });

  it("maps a birth year to the right generation and gaps to null", () => {
    expect(cohortForYear(1990).key).toBe("millennial");
    expect(cohortForYear(1955).key).toBe("boomer");
    // Before the earliest defined cohort there is no match.
    expect(cohortForYear(1900)).toBeNull();
  });
});

describe("componentInflation", () => {
  it("returns comparable index pairs with growth for a recent span", () => {
    const rows = componentInflation(2000, CPI_LAST_YEAR);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.from).toBeGreaterThan(0);
      expect(r.to).toBeGreaterThan(0);
      expect(r.diff).toBeCloseTo(r.to / r.from - 1, 10);
    }
    // Medical care outpaces apparel over this span (a stable, known fact).
    const med = rows.find((r) => r.key === "medical");
    const app = rows.find((r) => r.key === "apparel");
    expect(med.diff).toBeGreaterThan(app.diff);
  });

  it("drops categories a year doesn't cover (recreation starts ~1993)", () => {
    const old = componentInflation(1975, CPI_LAST_YEAR).map((r) => r.key);
    expect(old).not.toContain("recreation");
    expect(old).toContain("apparel"); // apparel goes back to 1913
    const recent = componentInflation(2000, CPI_LAST_YEAR).map((r) => r.key);
    expect(recent).toContain("recreation");
  });
});

describe("medianIncome", () => {
  it("returns a number in range and null outside the series", () => {
    expect(typeof medianIncome(2020)).toBe("number");
    expect(medianIncome(1975)).toBeNull(); // FRED series starts 1984
  });
});
