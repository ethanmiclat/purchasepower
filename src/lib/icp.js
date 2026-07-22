// Category price levels by country, from the World Bank International
// Comparison Program (ICP 2021), re-based U.S. = 100. Used only for the
// category breakdown on country-vs-country comparisons: ICP publishes
// category detail for benchmark years only (2021 here) and under its own
// COICOP groupings, so this never feeds the headline number and never
// applies to U.S. metros or historical years.

import ICP from "../data/icp.json";

export const ICP_META = ICP.meta;
export const ICP_CATEGORIES = ICP.categories;

export function hasIcp(iso3) {
  return iso3 != null && ICP.countries[iso3] != null;
}

// Paired category rows for two countries (by iso3), or null when either
// lacks ICP data. Each row: the category price level (U.S. = 100) for
// each side and the relative difference, matching the shape the Breakdown
// component renders for U.S. metros.
export function countryCategoryDiffs(fromIso, toIso) {
  const A = ICP.countries[fromIso];
  const B = ICP.countries[toIso];
  if (!A || !B) return null;
  const rows = [];
  for (const c of ICP_CATEGORIES) {
    const a = A[c.key];
    const b = B[c.key];
    if (a == null || b == null) continue;
    rows.push({ key: c.key, label: c.label, from: a, to: b, diff: b / a - 1 });
  }
  return rows.length ? rows : null;
}
