import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "../lib/meta.js";
import USMap, { MapLegend } from "../components/USMap.jsx";
import WorldMap, { WorldLegend } from "../components/WorldMap.jsx";
import STATES from "../data/states.json";
import COUNTRIES from "../data/countries.json";
import CES from "../data/ces.json";

const rankedStates = Object.values(STATES.states).sort(
  (a, b) => a.rpp.all - b.rpp.all
);
const cheapestStates = rankedStates.slice(0, 5);
const priciestStates = rankedStates.slice(-5).reverse();

const rankedCountries = COUNTRIES.countries
  .slice()
  .sort((a, b) => a.rpp.all - b.rpp.all);
const cheapestCountries = rankedCountries.slice(0, 6);
const priciestCountries = rankedCountries.slice(-6).reverse();

function RankList({ title, items, label, onPick }) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.map((it) => (
          <li key={label(it)}>
            <button
              type="button"
              onClick={() => onPick(it)}
              className="flex w-full items-baseline justify-between gap-3 rounded-[10px] px-2.5 py-1.5 text-left transition-colors hover:bg-field"
            >
              <span className="text-[14px] font-medium text-ink">{label(it)}</span>
              <span className="text-[13px] tabular-nums text-ink-3">
                {it.rpp.all.toFixed(1)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ViewToggle({ view, setView }) {
  const opts = [
    { value: "us", label: "U.S. states" },
    { value: "world", label: "World" },
  ];
  return (
    <div
      role="group"
      aria-label="Map scope"
      className="mx-auto flex w-fit rounded-full bg-field p-1"
    >
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={view === o.value}
          onClick={() => setView(o.value)}
          className={`rounded-full px-5 py-2 text-[13.5px] font-semibold transition-colors ${
            view === o.value ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Explore() {
  usePageMeta(
    "Explore price levels across states and countries - Purchasing Power",
    "Maps of U.S. state price parities and World Bank country price levels: see where prices run above or below the U.S. average, and jump into a salary comparison."
  );
  const navigate = useNavigate();
  const [view, setView] = useState("us");

  const pickState = (st) => {
    const metro = CES.largest_metro[st.usps];
    if (metro) navigate(`/compare?to=${metro}`);
  };
  const pickCountry = (c) => navigate(`/compare?to=${c.iso3}`);

  const world = view === "world";

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-12 sm:px-8 sm:pt-14">
      <header className="max-w-[600px]">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink sm:text-[36px]">
          Where does a dollar go furthest?
        </h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
          {world ? (
            <>
              Each country is shaded by its overall price level (World Bank,{" "}
              {COUNTRIES.meta.value_years}), where 100 is the U.S. average.
              Click any country to compare a salary against it. Countries with
              no published price level stay grey.
            </>
          ) : (
            <>
              Each state is shaded by its overall price level (BEA Regional
              Price Parities, {STATES.meta.rpp_year}), where 100 is the U.S.
              average. Click any state to compare a salary against its largest
              metro.
            </>
          )}
        </p>
      </header>

      <div className="mt-7 flex justify-center">
        <ViewToggle view={view} setView={setView} />
      </div>

      <section className="rise-in mt-6 rounded-[28px] bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-8">
        {world ? (
          <WorldMap onCountryClick={pickCountry} />
        ) : (
          <USMap onStateClick={pickState} />
        )}
        <div className="mt-4 flex justify-center">
          {world ? <WorldLegend /> : <MapLegend />}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-8 rounded-[28px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:grid-cols-2 sm:p-9">
        {world ? (
          <>
            <RankList
              title="Lowest price levels"
              items={cheapestCountries}
              label={(c) => c.name}
              onPick={pickCountry}
            />
            <RankList
              title="Highest price levels"
              items={priciestCountries}
              label={(c) => c.name}
              onPick={pickCountry}
            />
          </>
        ) : (
          <>
            <RankList
              title="Lowest price levels"
              items={cheapestStates}
              label={(s) => s.name}
              onPick={pickState}
            />
            <RankList
              title="Highest price levels"
              items={priciestStates}
              label={(s) => s.name}
              onPick={pickState}
            />
          </>
        )}
      </section>
    </main>
  );
}
