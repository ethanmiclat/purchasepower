import { CATEGORIES, pct, priceDiff, shortName } from "../lib/compare.js";

function Row({ row, biggest }) {
  const max = Math.max(row.from, row.to);
  const note =
    Math.abs(row.diff) < 0.005
      ? "about the same"
      : `${pct(row.diff)} ${row.diff < 0 ? "lower" : "higher"}`;

  return (
    <div className={biggest ? "" : "opacity-60"}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold text-ink">
          {row.label}
          {row.sub && (
            <span className="ml-2 text-[11.5px] font-medium text-ink-4">
              {row.sub}
            </span>
          )}
        </span>
        {biggest ? (
          <span className="shrink-0 rounded-full bg-neg-soft px-2.5 py-0.5 text-[12px] font-semibold text-neg">
            biggest gap: {note}
          </span>
        ) : (
          <span className="shrink-0 text-[12px] text-ink-4">{note}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div
          className="h-[18px] rounded-[6px] bg-bar-a"
          style={{ width: `${(row.from / max) * 100}%` }}
        />
        <div
          className="h-[18px] rounded-[6px] bg-bar-b"
          style={{ width: `${(row.to / max) * 100}%` }}
        />
      </div>
    </div>
  );
}

// Paired-bar breakdown of BEA's four published price components, plus a
// CES spending-based transportation row in personalized mode (BEA has no
// transport price index and no combined "services" index; components are
// shown as published, never blended).
export default function Breakdown({ from, to, transport }) {
  const rows = CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    from: from.rpp[key],
    to: to.rpp[key],
    diff: priceDiff(from.rpp[key], to.rpp[key]),
  }));
  if (transport) {
    rows.push({
      key: "transport",
      label: "Transportation",
      sub: "spending-based",
      from: transport.from,
      to: transport.to,
      diff: priceDiff(transport.from, transport.to),
    });
  }
  const biggestKey = rows.reduce((a, b) =>
    Math.abs(b.diff) > Math.abs(a.diff) ? b : a
  ).key;

  return (
    <section
      aria-label="Price breakdown by category"
      className="rounded-[28px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-9"
    >
      <h2 className="text-[15px] font-semibold text-ink">
        What drives the gap
      </h2>
      <div className="mt-4 flex items-center gap-5">
        <span className="flex items-center gap-2 text-[13px] text-ink-2">
          <span aria-hidden="true" className="h-[11px] w-[11px] rounded-[3px] bg-bar-a" />
          {shortName(from)}
        </span>
        <span className="flex items-center gap-2 text-[13px] text-ink-2">
          <span aria-hidden="true" className="h-[11px] w-[11px] rounded-[3px] bg-bar-b" />
          {shortName(to)}
        </span>
      </div>
      <div className="mt-7 flex flex-col gap-6">
        {rows.map((row) => (
          <Row key={row.key} row={row} biggest={row.key === biggestKey} />
        ))}
      </div>
      <p className="mt-7 border-t border-line pt-5 text-[12.5px] leading-relaxed text-ink-3">
        Bars show BEA price levels for each category, where the U.S. average
        is 100. Longer means more expensive.
        {transport &&
          " Transportation instead compares household transportation spending intensity (Consumer Expenditure Survey); BEA publishes no transport price index."}
      </p>
    </section>
  );
}
