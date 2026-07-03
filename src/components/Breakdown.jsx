import { categoryDiffs, pct, shortName } from "../lib/compare.js";

function Row({ row }) {
  const max = Math.max(row.from, row.to);
  const note =
    Math.abs(row.diff) < 0.005
      ? "about the same"
      : `${pct(row.diff)} ${row.diff < 0 ? "lower" : "higher"}`;

  return (
    <div className={row.biggest ? "" : "opacity-60"}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[15px] font-semibold text-ink">{row.label}</span>
        {row.biggest ? (
          <span className="rounded-full bg-neg-soft px-2.5 py-0.5 text-[12px] font-semibold text-neg">
            biggest gap: {note}
          </span>
        ) : (
          <span className="text-[12px] text-ink-4">{note}</span>
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

// Paired-bar breakdown of BEA's four published price components. BEA has
// no combined "services" index (only housing / utilities / other) and no
// weights to blend one, so all four are shown as published.
export default function Breakdown({ from, to }) {
  const rows = categoryDiffs(from, to);
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
          <Row key={row.key} row={row} />
        ))}
      </div>
      <p className="mt-7 border-t border-line pt-5 text-[12.5px] leading-relaxed text-ink-3">
        Bars show BEA price levels for each category, where the U.S. average
        is 100. Longer means more expensive.
      </p>
    </section>
  );
}
