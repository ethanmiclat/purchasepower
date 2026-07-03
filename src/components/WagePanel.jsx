import { money, pct, priceDiff, shortName } from "../lib/compare.js";

function Figure({ metro, value }) {
  return (
    <div className="flex-1">
      <div className="text-[13px] font-medium text-ink-3">{shortName(metro)}</div>
      <div className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
        {value == null ? (
          <span className="text-[16px] font-medium text-ink-4">
            not published
          </span>
        ) : (
          money.format(value)
        )}
      </div>
    </div>
  );
}

// Median annual wage for the selected occupation group in both metros.
// This shows what the local job market actually pays; it is separate from
// the cost-of-living adjustment above.
export default function WagePanel({ wages, occupations, occ, from, to }) {
  const title =
    occ === "00-0000"
      ? "all occupations"
      : occupations.find((o) => o.code === occ)?.title ?? occ;
  const a = wages.wages[from.id]?.[occ] ?? null;
  const b = wages.wages[to.id]?.[occ] ?? null;
  const delta = a != null && b != null ? priceDiff(a, b) : null;

  return (
    <section
      aria-label="Typical pay comparison"
      className="rounded-[28px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-9"
    >
      <h2 className="text-[15px] font-semibold text-ink">
        What {title === "all occupations" ? "work" : `${title.toLowerCase()} work`}{" "}
        typically pays
      </h2>
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4">
        <Figure metro={from} value={a} />
        {delta != null && (
          <div
            className={`mb-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${
              delta >= 0 ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg"
            }`}
          >
            {delta >= 0 ? "+" : "-"}
            {pct(delta)}
          </div>
        )}
        <Figure metro={to} value={b} />
      </div>
      <p className="mt-6 border-t border-line pt-5 text-[12.5px] leading-relaxed text-ink-3">
        Median annual wage from BLS OEWS. This is what the local market pays,
        independent of the cost-of-living conversion above.
      </p>
    </section>
  );
}
