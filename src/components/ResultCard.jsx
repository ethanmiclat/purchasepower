import { equivalentSalary, money, pct, priceDiff, shortName } from "../lib/compare.js";

export default function ResultCard({ salary, from, to }) {
  const equivalent = equivalentSalary(salary, from, to);
  const diff = priceDiff(from.rpp.all, to.rpp.all);
  const badge =
    Math.abs(diff) < 0.005
      ? { text: "About the same cost of living", cls: "bg-white/10 text-ink-4" }
      : diff < 0
        ? {
            text: `${pct(diff)} lower cost of living`,
            cls: "bg-[rgba(48,163,108,0.16)] text-[#4ad991]",
          }
        : {
            text: `${pct(diff)} higher cost of living`,
            cls: "bg-[rgba(192,57,43,0.18)] text-[#ff9484]",
          };

  return (
    <section
      aria-label="Equivalent salary result"
      className="flex flex-col items-center justify-center rounded-[28px] bg-ink px-8 py-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.06),0_18px_50px_rgba(0,0,0,0.22)] sm:px-12"
    >
      <div className="flex items-center gap-2.5 text-[14px] font-medium text-ink-4">
        <span>{shortName(from)}</span>
        <span aria-hidden="true" className="text-[#5a5a5f]">
          {"→"}
        </span>
        <span className="text-[#f5f5f7]">{shortName(to)}</span>
      </div>
      <div className="mt-8 text-[15px] font-medium text-ink-4">
        Equivalent salary
      </div>
      <div className="mt-1 text-[56px] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-[72px]">
        {money.format(equivalent)}
      </div>
      <div
        className={`mt-5 inline-flex items-center rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${badge.cls}`}
      >
        {badge.text}
      </div>
      <div className="mt-7 text-[14px] text-ink-3">
        from{" "}
        <span className="font-semibold text-[#f5f5f7]">
          {money.format(salary)}
        </span>{" "}
        in {shortName(from)}
      </div>
    </section>
  );
}
