// Time axis for the comparison: national inflation via CPI-U, plus the
// generational cohorts that act as labeled shortcuts into the year
// picker. Kept separate from compare.js (the place axis) so each axis is
// a single, testable ratio; Compare.jsx multiplies the two.
//
// A country or metro is a "place"; a year is a "time". The equivalent
// salary is salary x (placeTo/placeFrom) x (cpiTo/cpiFrom). When both
// years are the present year the CPI ratio is exactly 1, so nothing about
// the existing same-year comparison changes.

import CPI from "../data/cpi.json";
import GEN from "../data/generations.json";

const annual = CPI.annual;

export const CPI_FIRST_YEAR = CPI.meta.first_year;
export const CPI_LAST_YEAR = CPI.meta.last_year;
export const COHORTS = GEN.cohorts;
export const GEN_META = GEN.meta;

// The latest year we can price. The site treats this as "today" — the
// default on both sides, where the inflation adjustment vanishes.
export const CURRENT_YEAR = CPI_LAST_YEAR;

export function hasCpi(year) {
  return annual[String(year)] != null;
}

export function cpiFor(year) {
  const v = annual[String(year)];
  if (v == null) throw new Error(`no CPI index for year ${year}`);
  return v;
}

// Dollars in `fromYear` -> dollars in `toYear`. Same year => 1.
export function cpiRatio(fromYear, toYear) {
  if (fromYear === toYear) return 1;
  return cpiFor(toYear) / cpiFor(fromYear);
}

export function clampYear(year) {
  return Math.min(CPI_LAST_YEAR, Math.max(CPI_FIRST_YEAR, year));
}

export function cohort(key) {
  return COHORTS.find((c) => c.key === key) ?? null;
}

// The generation whose birth-year span contains `year`, or null. Used to
// label a manually-typed year, not to drive any math.
export function cohortForYear(year) {
  return (
    COHORTS.find((c) => year >= c.birth_start && year <= c.birth_end) ?? null
  );
}

// Nominal median household income for a year, or null when outside the
// series (pre-1984). Context only — never part of the equivalence math.
export function medianIncome(year) {
  const v = GEN.median_income[String(year)];
  return v == null ? null : v;
}
