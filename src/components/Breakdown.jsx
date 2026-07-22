import { pct } from "../lib/compare.js";
import { useGrowBars } from "../lib/motion.js";

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
          data-bar
          className="h-[18px] rounded-[6px] bg-bar-a"
          style={{ width: `${(row.from / max) * 100}%` }}
        />
        <div
          data-bar
          className="h-[18px] rounded-[6px] bg-bar-b"
          style={{ width: `${(row.to / max) * 100}%` }}
        />
      </div>
    </div>
  );
}

// Generic paired-bar category breakdown. Each row carries a `from` and
// `to` value on a comparable scale plus a relative `diff`; the two legend
// labels name the two bars. The same component renders three cases:
//  - place gap across BEA metro categories (U.S. metros, U.S. avg = 100)
//  - inflation across CPI major groups between two years (bars are the
//    index in each year; the longer second bar = more inflation)
//  - price-level gap across ICP categories between two countries.
// The "biggest gap" is whichever row has the largest absolute diff.
export default function Breakdown({ title, legendA, legendB, rows, footnote }) {
  const biggestKey = rows.reduce((a, b) =>
    Math.abs(b.diff) > Math.abs(a.diff) ? b : a
  ).key;
  const scope = useGrowBars([legendA, legendB, rows.length]);

  return (
    <section
      ref={scope}
      aria-label="Category breakdown"
      className="rounded-[28px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-9"
    >
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <div className="mt-4 flex items-center gap-5">
        <span className="flex items-center gap-2 text-[13px] text-ink-2">
          <span aria-hidden="true" className="h-[11px] w-[11px] rounded-[3px] bg-bar-a" />
          {legendA}
        </span>
        <span className="flex items-center gap-2 text-[13px] text-ink-2">
          <span aria-hidden="true" className="h-[11px] w-[11px] rounded-[3px] bg-bar-b" />
          {legendB}
        </span>
      </div>
      <div className="mt-7 flex flex-col gap-6">
        {rows.map((row) => (
          <Row key={row.key} row={row} biggest={row.key === biggestKey} />
        ))}
      </div>
      {footnote && (
        <p className="mt-7 border-t border-line pt-5 text-[12.5px] leading-relaxed text-ink-3">
          {footnote}
        </p>
      )}
    </section>
  );
}
