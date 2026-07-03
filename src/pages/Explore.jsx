import { useNavigate } from "react-router-dom";
import { usePageMeta } from "../lib/meta.js";
import USMap, { MapLegend } from "../components/USMap.jsx";
import STATES from "../data/states.json";
import CES from "../data/ces.json";

const ranked = Object.values(STATES.states).sort((a, b) => a.rpp.all - b.rpp.all);
const cheapest = ranked.slice(0, 5);
const priciest = ranked.slice(-5).reverse();

function StateList({ title, items, onPick }) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.map((s) => (
          <li key={s.usps}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="flex w-full items-baseline justify-between gap-3 rounded-[10px] px-2.5 py-1.5 text-left transition-colors hover:bg-field"
            >
              <span className="text-[14px] font-medium text-ink">{s.name}</span>
              <span className="text-[13px] tabular-nums text-ink-3">
                {s.rpp.all.toFixed(1)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Explore() {
  usePageMeta(
    "Explore state price levels - Purchasing Power",
    "A map of BEA state-level price parities: see which states run above or below U.S. average prices, and jump into a salary comparison."
  );
  const navigate = useNavigate();
  const pick = (st) => {
    const metro = CES.largest_metro[st.usps];
    if (metro) navigate(`/compare?to=${metro}`);
  };

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-12 sm:px-8 sm:pt-14">
      <header className="max-w-[560px]">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink sm:text-[36px]">
          Where does a dollar go furthest?
        </h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
          Each state is shaded by its overall price level (BEA Regional
          Price Parities, {STATES.meta.rpp_year}), where 100 is the U.S.
          average. Click any state to compare a salary against its largest
          metro.
        </p>
      </header>

      <section className="rise-in mt-8 rounded-[28px] bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-8">
        <USMap onStateClick={pick} />
        <div className="mt-4 flex justify-center">
          <MapLegend />
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-8 rounded-[28px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:grid-cols-2 sm:p-9">
        <StateList title="Lowest price levels" items={cheapest} onPick={pick} />
        <StateList title="Highest price levels" items={priciest} onPick={pick} />
      </section>
    </main>
  );
}
