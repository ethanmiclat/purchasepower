import CityCombobox from "./CityCombobox.jsx";
import {
  COHORTS,
  CPI_FIRST_YEAR,
  CURRENT_YEAR,
  clampYear,
  cohort,
} from "../lib/historical.js";

function ScopeToggle({ scope, setScope, id }) {
  const opts = [
    { value: "us", label: "U.S. metro" },
    { value: "world", label: "Country" },
  ];
  return (
    <div
      role="group"
      aria-label={`${id} place type`}
      className="mb-2 flex rounded-full bg-field p-0.5"
    >
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={scope === o.value}
          onClick={() => setScope(o.value)}
          className={`flex-1 rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors ${
            scope === o.value
              ? "bg-ink text-white"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// A plain year input plus a generation quick-pick. "Today" is the latest
// CPI year (the default, where the inflation adjustment is 1). Generations
// are shortcuts that jump the year to that cohort's representative era.
function YearField({ year, setYear }) {
  const select =
    year === CURRENT_YEAR
      ? "today"
      : COHORTS.find((c) => c.ref_year === year)?.key ?? "custom";

  return (
    <div className="mt-3 grid grid-cols-[92px_1fr] gap-2">
      <input
        aria-label="Year"
        inputMode="numeric"
        autoComplete="off"
        className="w-full rounded-[12px] border-[1.5px] border-transparent bg-field px-3 py-2 text-[14px] font-medium tabular-nums text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-ink"
        value={year}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
          if (digits === "") return;
          setYear(clampYear(Number(digits)));
        }}
      />
      <select
        aria-label="Jump to a generation or today"
        className="w-full appearance-none rounded-[12px] border-[1.5px] border-transparent bg-field px-3 py-2 text-[14px] font-medium text-ink outline-none transition-colors focus:border-ink"
        value={select}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "today") setYear(CURRENT_YEAR);
          else if (v === "custom") return;
          else setYear(cohort(v).ref_year);
        }}
      >
        <option value="today">Today ({CURRENT_YEAR})</option>
        {COHORTS.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label} · {c.ref_year}
          </option>
        ))}
        {select === "custom" && <option value="custom">Custom year</option>}
      </select>
    </div>
  );
}

// One side of the comparison: where (a U.S. metro or a country) and when
// (a year, defaulting to today). Switching place type clears the current
// selection, since a metro is not a country.
export default function PlaceField({
  label,
  scope,
  setScope,
  metros,
  countries,
  place,
  setPlace,
  year,
  setYear,
}) {
  const world = scope === "world";
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold text-ink-2">{label}</div>
      <ScopeToggle
        scope={scope}
        setScope={(s) => {
          if (s !== scope) setPlace(null);
          setScope(s);
        }}
        id={label}
      />
      <CityCombobox
        label={label}
        hideLabel
        metros={world ? countries : metros}
        value={place}
        onChange={setPlace}
        placeholder={
          world
            ? `Search ${countries.length} countries`
            : `Search ${metros.length} metro areas`
        }
        noun={world ? "country" : "metro"}
      />
      <YearField year={year} setYear={setYear} />
      <p className="mt-1.5 text-[11.5px] leading-snug text-ink-4">
        {year === CURRENT_YEAR
          ? "Today's dollars"
          : `${year} dollars · inflation-adjusted (CPI-U ${CPI_FIRST_YEAR}–${CURRENT_YEAR})`}
      </p>
    </div>
  );
}
