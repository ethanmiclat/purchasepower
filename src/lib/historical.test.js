import { describe, expect, it } from "vitest";
import {
  CPI_FIRST_YEAR,
  CPI_LAST_YEAR,
  CURRENT_YEAR,
  clampYear,
  cohort,
  cohortForYear,
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

describe("medianIncome", () => {
  it("returns a number in range and null outside the series", () => {
    expect(typeof medianIncome(2020)).toBe("number");
    expect(medianIncome(1975)).toBeNull(); // FRED series starts 1984
  });
});
