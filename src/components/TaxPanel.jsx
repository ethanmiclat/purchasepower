import { useState } from "react";
import { Link } from "react-router-dom";
import { money, pct, shortName } from "../lib/compare.js";
import {
  TAX_YEAR,
  metroState,
  salesTaxInfo,
  stateHasIncomeTax,
  takeHome,
} from "../lib/tax.js";

const NYC_METRO = "35620";

function FilingToggle({ filing, setFiling }) {
  return (
    <div role="group" aria-label="Filing status" className="flex rounded-full bg-field p-1">
      {[
        { value: "single", label: "Single" },
        { value: "married", label: "Married joint" },
      ].map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={filing === o.value}
          onClick={() => setFiling(o.value)}
          className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
            filing === o.value ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function whyLine(from, to, taxA, taxB, stateA, stateB) {
  const a = taxA.state + taxA.local;
  const b = taxB.state + taxB.local;
  if (b === 0 && a > 0) {
    return `${stateB} has no state income tax, while ${stateA} takes ${money.format(a)} of your current salary${taxA.local ? " (city tax included)" : ""}.`;
  }
  if (a === 0 && b > 0) {
    return `${stateB} levies ${money.format(b)} in state${taxB.local ? " and city" : ""} income tax on the equivalent salary, while ${stateA} takes nothing today.`;
  }
  if (a === 0 && b === 0) {
    return "Neither state levies an income tax; the difference comes from federal brackets applying to a different nominal salary.";
  }
  return `State${taxB.local || taxA.local ? " and local" : ""} income tax runs ${money.format(b)} on the equivalent salary in ${shortName(to)} vs ${money.format(a)} on your salary in ${shortName(from)}.`;
}

// Pre-tax vs. after-tax view per the design reference. The two numbers
// answer different questions and are labeled accordingly:
//  - pre-tax equivalent: same price-adjusted salary (v1/v2 output)
//  - after-tax purchasing power: earning that equivalent in the
//    destination, what it feels like after taxes vs. your pay today.
export default function TaxPanel({ salary, from, to, equivalent }) {
  const [filing, setFiling] = useState("single");
  const [nycResident, setNycResident] = useState(true);

  const stateA = metroState(from);
  const stateB = metroState(to);
  const nycInvolved = from.id === NYC_METRO || to.id === NYC_METRO;
  const taxA = takeHome(salary, stateA, filing, {
    nyc: from.id === NYC_METRO && nycResident,
  });
  const taxB = takeHome(equivalent, stateB, filing, {
    nyc: to.id === NYC_METRO && nycResident,
  });

  // afterTax = equivalent x (netB / priceB) / (netA / priceA); since
  // equivalent already carries priceB/priceA, this reduces to
  // salary x netB/netA.
  const afterTax = salary * (taxB.net / taxA.net);
  const delta = afterTax / equivalent - 1;

  const salesA = salesTaxInfo(stateA);
  const salesB = salesTaxInfo(stateB);
  const multiState = [from, to].filter((m) =>
    m.name.split(",").pop().includes("-")
  );

  return (
    <section
      aria-label="Pre-tax versus after-tax comparison"
      className="rounded-[28px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-9"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            After taxes ({TAX_YEAR})
          </h2>
          <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-ink-2">
            If you earned the pre-tax equivalent in {shortName(to)}, taxes
            would make it feel like this next to your pay today.
          </p>
        </div>
        <FilingToggle filing={filing} setFiling={setFiling} />
      </div>

      <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:gap-0">
        <div className="flex-1 rounded-[20px] border-[1.5px] border-[#dcdce0] px-6 py-7">
          <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-4">
            Pre-tax
          </div>
          <div className="mt-1 text-[15px] text-ink-2">equivalent salary</div>
          <div className="mt-4 text-[34px] font-semibold tracking-[-0.02em] text-ink-2 sm:text-[40px]">
            {money.format(equivalent)}
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 sm:w-[64px] sm:flex-col sm:gap-1.5">
          <div
            className={`rounded-full px-2 py-1 text-[12px] font-bold ${
              delta >= 0 ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg"
            }`}
          >
            {delta >= 0 ? "+" : "-"}
            {pct(delta)}
          </div>
          <div aria-hidden="true" className="text-[20px] text-[#c7c7cc]">
            <span className="hidden sm:inline">{"→"}</span>
            <span className="sm:hidden">{"↓"}</span>
          </div>
        </div>
        <div className="flex-1 rounded-[20px] bg-ink px-6 py-7">
          <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8e8e93]">
            After-tax
          </div>
          <div className="mt-1 text-[15px] text-ink-4">purchasing power</div>
          <div className="mt-4 text-[34px] font-bold tracking-[-0.02em] text-white sm:text-[40px]">
            {money.format(afterTax)}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-[13px] leading-relaxed text-ink-2">
        <p>
          <span className="text-ink-3">Why the difference?</span>{" "}
          {whyLine(from, to, taxA, taxB, stateA, stateB)}
        </p>
        <p className="text-[12.5px] text-ink-3">
          Sales tax, for reference only (BEA's price levels already include
          it): {stateA} {(salesA.state * 100).toFixed(2)}% state,{" "}
          {(salesA.combined_avg * 100).toFixed(2)}% avg combined vs {stateB}{" "}
          {(salesB.state * 100).toFixed(2)}% state,{" "}
          {(salesB.combined_avg * 100).toFixed(2)}% avg combined.
        </p>
        {multiState.length > 0 && (
          <p className="text-[12.5px] text-ink-3">
            {multiState
              .map((m) => `${shortName(m)} spans state lines; taxes use ${metroState(m)}.`)
              .join(" ")}
          </p>
        )}
        {nycInvolved && (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={nycResident}
              onChange={(e) => setNycResident(e.target.checked)}
              className="h-4 w-4 accent-[#c13a22]"
            />
            Include New York City income tax (assumes living in the city
            proper)
          </label>
        )}
      </div>

      <p className="mt-5 rounded-[14px] bg-field px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
        These are estimates for a simple W-2 situation: {TAX_YEAR} brackets,
        standard deduction only, employee-side FICA, no credits, itemizing,
        or local taxes beyond New York City. Real situations vary. This is
        not tax or financial advice; consult a professional about yours.
        Full modeling limits are on the{" "}
        <Link
          to="/methodology"
          className="font-semibold text-accent-strong underline decoration-accent/40 underline-offset-4"
        >
          methodology page
        </Link>
        .
      </p>
    </section>
  );
}
