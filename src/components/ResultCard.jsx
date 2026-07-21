import { money, pct, shortName } from "../lib/compare.js";
import { CURRENT_YEAR, cpiRatio, medianIncome } from "../lib/historical.js";
import { useCountUp } from "../lib/motion.js";

function Badge({ diff }) {
  const b =
    Math.abs(diff) < 0.005
      ? { text: "About the same cost of living", cls: "bg-white/10 text-ink-4" }
      : diff < 0
        ? {
            text: `${pct(diff)} lower cost of living`,
            cls: "bg-[rgba(48,163,108,0.16)] text-[#4ad991]",
          }
        : {
            text: `${pct(diff)} higher cost of living`,
            cls: "bg-[rgba(179,38,75,0.25)] text-[#ff8fae]",
          };
  return (
    <div
      className={`mt-5 inline-flex items-center rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${b.cls}`}
    >
      {b.text}
    </div>
  );
}

function ModeToggle({ mode, setMode }) {
  const opts = [
    { value: "generic", label: "Generic" },
    { value: "personal", label: "Personalized" },
  ];
  return (
    <div
      role="group"
      aria-label="Result mode"
      className="mx-auto mb-4 flex rounded-full bg-[#e2e2e6] p-1"
    >
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={mode === o.value}
          onClick={() => setMode(o.value)}
          className={`rounded-full px-5 py-2 text-[13.5px] font-semibold transition-colors ${
            mode === o.value ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Endpoint({ place, year }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span>{shortName(place)}</span>
      {year !== CURRENT_YEAR && (
        <span className="text-[12px] tabular-nums text-[#8e8e93]">{year}</span>
      )}
    </span>
  );
}

// Dark equivalent-salary card. The headline already combines the place
// ratio and the CPI (time) ratio. When a personalized result exists a
// toggle sits above and the non-active number stays visible as a
// reference; when the two years differ an inflation line discloses the
// CPI adjustment, and a historical year shows the era's median income as
// context (never part of the math).
export default function ResultCard({
  salary,
  from,
  to,
  fromYear,
  toYear,
  samePlace,
  mode,
  setMode,
  generic,
  personal,
}) {
  const active = mode === "personal" && personal ? personal : generic;
  const other = mode === "personal" && personal ? generic : personal;
  const otherLabel = mode === "personal" ? "generic estimate" : "personalized";
  const refDelta =
    personal ? (personal.equivalent - generic.equivalent) / generic.equivalent : null;
  const countRef = useCountUp(active.equivalent, (v) => money.format(v));

  const yearsDiffer = fromYear !== toYear;
  const timeR = cpiRatio(fromYear, toYear);
  const fromIncome = fromYear !== CURRENT_YEAR ? medianIncome(fromYear) : null;
  const toIncome = toYear !== CURRENT_YEAR ? medianIncome(toYear) : null;

  return (
    <div className="flex flex-col">
      {personal && <ModeToggle mode={mode} setMode={setMode} />}
      <section
        aria-label="Equivalent salary result"
        className="flex flex-1 flex-col items-center justify-center rounded-[28px] bg-ink px-8 py-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.06),0_18px_50px_rgba(0,0,0,0.22)] sm:px-12"
      >
        <div className="flex items-center gap-2.5 text-[14px] font-medium text-ink-4">
          <Endpoint place={from} year={fromYear} />
          <span aria-hidden="true" className="text-[#5a5a5f]">
            {"→"}
          </span>
          <span className="text-[#f5f5f7]">
            <Endpoint place={to} year={toYear} />
          </span>
        </div>
        <div className="mt-8 text-[15px] font-medium text-ink-4">
          Equivalent salary
        </div>
        <div
          ref={countRef}
          className="mt-1 text-[56px] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-[72px]"
        >
          {money.format(active.equivalent)}
        </div>
        {!samePlace && <Badge diff={active.diff} />}
        <div className="mt-7 text-[14px] text-ink-3">
          from{" "}
          <span className="font-semibold text-[#f5f5f7]">
            {money.format(salary)}
          </span>{" "}
          in <Endpoint place={from} year={fromYear} />
        </div>
        {yearsDiffer && (
          <div className="mt-5 w-full border-t border-white/10 pt-5 text-[13px] leading-relaxed text-ink-3">
            Inflation (CPI-U): $1 in {fromYear} has the buying power of about{" "}
            <span className="font-semibold text-[#f5f5f7]">
              ${timeR.toFixed(2)}
            </span>{" "}
            in {toYear}.
            {(fromIncome || toIncome) && (
              <div className="mt-2 text-[12px] text-ink-4">
                Typical U.S. household income —{" "}
                {[
                  fromIncome && `${fromYear}: ${money.format(fromIncome)}`,
                  toIncome && `${toYear}: ${money.format(toIncome)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {" "}(nominal, context only)
              </div>
            )}
          </div>
        )}
        {other && (
          <div className="mt-6 w-full border-t border-white/10 pt-5 text-[13px] text-ink-3">
            {otherLabel}: {money.format(other.equivalent)}
            {mode === "personal" && Math.abs(refDelta) >= 0.001 && (
              <span className="ml-2 text-ink-4">
                your basket runs {pct(refDelta)}{" "}
                {refDelta < 0 ? "lower" : "higher"}
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
