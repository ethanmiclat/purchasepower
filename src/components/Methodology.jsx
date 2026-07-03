import { useState } from "react";

// The plan requires the personalization to be legible: what each answer
// changes and which numbers are published data vs. stated assumptions.
export default function Methodology({ ces }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto mt-3 max-w-[720px] text-center">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-[13px] font-medium text-ink-3 underline decoration-ink-4 underline-offset-4 hover:text-ink"
      >
        How personalization works
      </button>
      {open && (
        <div className="rise-in mt-4 rounded-[20px] bg-card p-6 text-left text-[13.5px] leading-relaxed text-ink-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)]">
          <p>
            The generic result converts your salary with BEA's all-items
            price index, which assumes average U.S. spending. Personalizing
            rebuilds the budget weights from the BLS Consumer Expenditure
            Survey ({ces.meta.cx_year}), then prices each slice of that
            budget with the matching BEA index.
          </p>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
            <li>
              <strong className="font-semibold text-ink">Rent or own</strong>:
              uses the published renter or homeowner spending shares
              (renters put ~34% of spending into housing vs ~22% for
              owners).
            </li>
            <li>
              <strong className="font-semibold text-ink">Kids</strong>:
              applies the published with-children spending ratios.
            </li>
            <li>
              <strong className="font-semibold text-ink">Cars</strong>:
              scales vehicle spending by your car count against the
              published {ces.meta.vehicles_per_cu}-vehicle household
              average. Proportional scaling is our assumption.
            </li>
            <li>
              <strong className="font-semibold text-ink">Dining out</strong>:
              scales the restaurant share of your budget (0.6x to 1.8x of
              average). The scale points are assumptions, not survey data.
            </li>
            <li>
              <strong className="font-semibold text-ink">Getting around</strong>:
              transit doubles the public-transit share; walking, biking, or
              staying home trims vehicle spending by 10%. Both are
              assumptions.
            </li>
          </ul>
          <p className="mt-3">
            <strong className="font-semibold text-ink">Transportation prices</strong>:
            BEA publishes no transportation price index, so metros are
            compared on household transportation spending intensity from
            the Consumer Expenditure Survey: measured directly for{" "}
            {ces.meta.msa_direct_count} large metros, estimated from region
            and city size elsewhere. It reflects how car-dependent a metro
            is, not pure prices.
          </p>
        </div>
      )}
    </div>
  );
}
