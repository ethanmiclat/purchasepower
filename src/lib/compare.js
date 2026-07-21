// Pure comparison math over price-level indices. Both BEA RPP (U.S.
// metros/states) and the World Bank price level (countries) are scaled so
// the U.S. average = 100, so a salary's equivalent in another place is
// salary x (index_to / index_from) using the all-items composite. The
// place axis lives here; the time axis (CPI) lives in historical.js.

export const CATEGORIES = [
  { key: "housing", label: "Housing" },
  { key: "goods", label: "Goods" },
  { key: "utilities", label: "Utilities" },
  { key: "other_services", label: "Other services" },
];

// A country record carries an `iso3` and only an all-items `rpp.all`; a
// U.S. metro/state record carries the four BEA category components.
export function isCountry(place) {
  return place != null && place.iso3 != null;
}

// True when a place has BEA's four-way category breakdown (U.S. only);
// countries do not, so the breakdown / tax / wage panels gate on this.
export function hasCategories(place) {
  return place != null && place.rpp != null && place.rpp.housing != null;
}

export function equivalentSalary(salary, from, to) {
  return salary * (to.rpp.all / from.rpp.all);
}

// Relative price difference of `to` vs `from` for one index value.
// -0.195 means 19.5% cheaper in `to`.
export function priceDiff(fromValue, toValue) {
  return toValue / fromValue - 1;
}

export function categoryDiffs(from, to) {
  if (!hasCategories(from) || !hasCategories(to)) return null;
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

// "San Francisco-Oakland-Fremont, CA" -> "San Francisco"; a country keeps
// its full name ("United States", "Japan").
export function shortName(place) {
  if (isCountry(place)) return place.name;
  return place.name.split(",")[0].split("-")[0].trim();
}

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function pct(x) {
  return `${Math.abs(x * 100).toFixed(1).replace(/\.0$/, "")}%`;
}
