// Pure comparison math over BEA RPP indices. An RPP is a price index where
// the U.S. average = 100, so a salary's equivalent in another metro is
// salary x (RPP_to / RPP_from), using BEA's all-items composite.

export const CATEGORIES = [
  { key: "housing", label: "Housing" },
  { key: "goods", label: "Goods" },
  { key: "utilities", label: "Utilities" },
  { key: "other_services", label: "Other services" },
];

export function equivalentSalary(salary, from, to) {
  return salary * (to.rpp.all / from.rpp.all);
}

// Relative price difference of `to` vs `from` for one index value.
// -0.195 means 19.5% cheaper in `to`.
export function priceDiff(fromValue, toValue) {
  return toValue / fromValue - 1;
}

export function categoryDiffs(from, to) {
  const rows = CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    from: from.rpp[key],
    to: to.rpp[key],
    diff: priceDiff(from.rpp[key], to.rpp[key]),
  }));
  const biggest = rows.reduce((a, b) =>
    Math.abs(b.diff) > Math.abs(a.diff) ? b : a
  );
  return rows.map((r) => ({ ...r, biggest: r.key === biggest.key }));
}

// "San Francisco-Oakland-Fremont, CA" -> "San Francisco"
export function shortName(metro) {
  return metro.name.split(",")[0].split("-")[0].trim();
}

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function pct(x) {
  return `${Math.abs(x * 100).toFixed(1).replace(/\.0$/, "")}%`;
}
