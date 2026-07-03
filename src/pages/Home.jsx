import { Link, useNavigate } from "react-router-dom";
import { usePageMeta } from "../lib/meta.js";
import USMap from "../components/USMap.jsx";
import CES from "../data/ces.json";

export default function Home() {
  usePageMeta(
    "Purchasing Power - what your salary is really worth, city to city",
    "See what your salary is actually worth in another U.S. city, using official BEA price data across 386 metro areas."
  );
  const navigate = useNavigate();

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 sm:px-8">
      <section className="grid grid-cols-1 items-center gap-10 pb-14 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div>
          <h1 className="text-[38px] font-bold leading-[1.06] tracking-[-0.02em] text-ink sm:text-[52px]">
            What is your salary{" "}
            <span className="text-accent">really worth?</span>
          </h1>
          <p className="mt-5 max-w-[42ch] text-[17px] leading-relaxed text-ink-2">
            The same paycheck buys a different life in Austin than in San
            Francisco. Compare any two U.S. metros with official government
            price, wage, and tax data.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/compare"
              className="rounded-full bg-accent-strong px-7 py-3.5 text-[15px] font-semibold text-white transition-transform hover:bg-[#a93016] active:scale-[0.98]"
            >
              Compare your salary
            </Link>
            <Link
              to="/explore"
              className="rounded-full px-6 py-3.5 text-[15px] font-semibold text-ink transition-colors hover:bg-field"
            >
              Explore the map
            </Link>
          </div>
        </div>
        <div className="rise-in">
          <USMap
            onStateClick={(st) => {
              const metro = CES.largest_metro[st.usps];
              navigate(metro ? `/compare?to=${metro}` : "/explore");
            }}
          />
          <p className="mt-2 text-center text-[12.5px] text-ink-3">
            State price levels, BEA 2024. Click a state to compare against
            its largest metro.
          </p>
        </div>
      </section>

      <section className="border-t border-line pb-16 pt-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <div className="text-[26px] font-bold tracking-[-0.02em] text-ink">
              386 metros
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              Every metro area BEA prices, with housing, goods, utilities,
              and services broken out separately.
            </p>
          </div>
          <div>
            <div className="text-[26px] font-bold tracking-[-0.02em] text-ink">
              Your lifestyle
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              Optional questions reweight the result to how you actually
              spend, from rent to daycare to your commute.
            </p>
          </div>
          <div>
            <div className="text-[26px] font-bold tracking-[-0.02em] text-ink">
              After taxes
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
              2026 federal, state, and NYC taxes turn the headline number
              into take-home purchasing power.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
