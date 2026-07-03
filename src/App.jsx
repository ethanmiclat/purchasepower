import { useMemo, useState } from "react";
import { useData } from "./hooks/useData.js";
import ComparisonForm from "./components/ComparisonForm.jsx";
import ResultCard from "./components/ResultCard.jsx";
import Breakdown from "./components/Breakdown.jsx";
import WagePanel from "./components/WagePanel.jsx";

const DEFAULTS = { from: "41860", to: "12420", salary: 85000 }; // SF -> Austin

function Skeleton() {
  return (
    <div aria-hidden="true" className="mx-auto mt-10 w-full max-w-[560px] animate-pulse">
      <div className="h-[380px] rounded-[28px] bg-card/70" />
    </div>
  );
}

function Hint({ children }) {
  return (
    <p className="mx-auto mt-12 max-w-[420px] text-center text-[15px] text-ink-3">
      {children}
    </p>
  );
}

export default function App() {
  const data = useData();
  const [salary, setSalary] = useState(DEFAULTS.salary);
  const [fromId, setFromId] = useState(DEFAULTS.from);
  const [toId, setToId] = useState(DEFAULTS.to);
  const [occ, setOcc] = useState("00-0000");

  const metros = data.status === "ready" ? data.metros.metros : [];
  const byId = useMemo(
    () => Object.fromEntries(metros.map((m) => [m.id, m])),
    [metros]
  );
  const from = byId[fromId] ?? null;
  const to = byId[toId] ?? null;
  const ready = from && to && salary != null && salary > 0;
  const meta = data.status === "ready" ? data.metros.meta : null;

  return (
    <div className="min-h-[100dvh] font-sans text-ink">
      <main className="mx-auto w-full max-w-[1080px] px-5 pb-16 pt-12 sm:px-8 sm:pt-16">
        <header className="mx-auto mb-10 max-w-[560px] text-center sm:mb-12">
          <h1 className="text-[32px] font-bold tracking-[-0.02em] sm:text-[38px]">
            Purchasing Power
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
            See what your salary is really worth in another city, using
            official U.S. government price data.
          </p>
        </header>

        {data.status === "loading" && <Skeleton />}

        {data.status === "error" && (
          <div className="mx-auto mt-10 max-w-[480px] rounded-[28px] bg-card p-9 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)]">
            <p className="text-[15px] font-semibold">The data failed to load.</p>
            <p className="mt-2 text-[14px] text-ink-2">{String(data.error)}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-[14px] bg-ink px-6 py-3 text-[14px] font-semibold text-white transition-transform active:scale-[0.98]"
            >
              Reload
            </button>
          </div>
        )}

        {data.status === "ready" && (
          <>
            <ComparisonForm
              metros={metros}
              occupations={data.wages.occupations}
              salary={salary}
              setSalary={setSalary}
              from={from}
              setFrom={(m) => setFromId(m?.id ?? null)}
              to={to}
              setTo={(m) => setToId(m?.id ?? null)}
              occ={occ}
              setOcc={setOcc}
            />

            {!ready && (
              <Hint>
                {salary == null || salary <= 0
                  ? "Enter a salary to see what it's worth."
                  : "Pick two metro areas to compare."}
              </Hint>
            )}

            {ready && from.id === to.id && (
              <Hint>
                That's the same metro on both sides. Pick a different
                destination to compare.
              </Hint>
            )}

            {ready && from.id !== to.id && (
              <div
                key={`${from.id}-${to.id}`}
                className="rise-in mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2"
              >
                <ResultCard salary={salary} from={from} to={to} />
                <Breakdown from={from} to={to} />
                <div className="lg:col-span-2">
                  <WagePanel
                    wages={data.wages}
                    occupations={data.wages.occupations}
                    occ={occ}
                    from={from}
                    to={to}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-[1080px] px-5 pb-12 sm:px-8">
        <div className="border-t border-[#dcdce0] pt-6 text-[12.5px] leading-relaxed text-ink-3">
          <p>
            Equivalent salary = your salary adjusted by the ratio of BEA
            all-items price levels between the two metros.
          </p>
          <p className="mt-1.5">
            Prices: U.S. Bureau of Economic Analysis, Regional Price Parities
            {meta ? ` (${meta.rpp_year})` : ""}. Wages: U.S. Bureau of Labor
            Statistics, OEWS{meta ? ` (${meta.oews_vintage})` : ""}.
            {meta ? ` Retrieved ${meta.pulled}.` : ""} Public domain data.
          </p>
        </div>
      </footer>
    </div>
  );
}
