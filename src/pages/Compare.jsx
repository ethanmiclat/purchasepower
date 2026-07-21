import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { usePageMeta } from "../lib/meta.js";
import {
  equivalentSalary,
  hasCategories,
  isCountry,
  money,
  priceDiff,
  shortName,
} from "../lib/compare.js";
import { CURRENT_YEAR, cpiRatio } from "../lib/historical.js";
import { answeredCount, personalizedComparison } from "../lib/personalize.js";
import ComparisonForm from "../components/ComparisonForm.jsx";
import Questionnaire from "../components/Questionnaire.jsx";
import ResultCard from "../components/ResultCard.jsx";
import Breakdown from "../components/Breakdown.jsx";
import TaxPanel from "../components/TaxPanel.jsx";
import WagePanel from "../components/WagePanel.jsx";
import METROS from "../data/metros.json";
import COUNTRIES from "../data/countries.json";
import WAGES from "../data/wages.json";
import CES from "../data/ces.json";

const DEFAULTS = { from: "41860", to: "12420", salary: 85000 }; // SF -> Austin
const COUNTRY_ISO = new Set(COUNTRIES.countries.map((c) => c.iso3));

function profileChips(a) {
  const chips = [];
  if (a.tenure) chips.push(a.tenure === "rent" ? "renter" : "homeowner");
  if (a.housing_share != null) chips.push(`~${Math.round(a.housing_share * 100)}% on housing`);
  if (a.kids != null) chips.push(a.kids === 0 ? "no kids" : `${a.kids === 3 ? "3+" : a.kids} kid${a.kids > 1 ? "s" : ""}`);
  if (a.kid_ages) chips.push({ young: "under 5", school: "ages 5 to 12", teens: "teenagers", mixed: "mixed ages" }[a.kid_ages]);
  if (a.cars != null) chips.push(a.cars === 0 ? "no car" : `${a.cars === 3 ? "3+" : a.cars} car${a.cars > 1 ? "s" : ""}`);
  if (a.commute) chips.push({ drive: "drives", transit: "rides transit", active: "walks or bikes", wfh: "mostly home" }[a.commute]);
  if (a.commute_len) chips.push(`${{ short: "short", medium: "medium", long: "long" }[a.commute_len]} commute`);
  if (a.dining) chips.push({ rarely: "rarely dines out", weekly: "dines out weekly", often: "dines out often", daily: "dines out daily" }[a.dining]);
  return chips;
}

// A place plus its year, shown as "Name" or "Name (1990)".
function whenLabel(place, year) {
  return year === CURRENT_YEAR
    ? shortName(place)
    : `${shortName(place)} (${year})`;
}

export default function Compare() {
  usePageMeta(
    "Compare salaries across cities, countries, and eras - Purchasing Power",
    "Enter a salary and compare its purchasing power between U.S. metros or countries, and across time from any year to today."
  );
  const [params, setParams] = useSearchParams();
  const toParam = params.get("to");
  const [phase, setPhase] = useState("setup");
  const [salary, setSalary] = useState(DEFAULTS.salary);
  const [fromScope, setFromScope] = useState("us");
  const [fromId, setFromId] = useState(DEFAULTS.from);
  const [fromYear, setFromYear] = useState(CURRENT_YEAR);
  // A `?to=` from the Explore maps is a metro id (US) or an iso3 (country).
  const [toScope, setToScope] = useState(
    toParam && COUNTRY_ISO.has(toParam) ? "world" : "us"
  );
  const [toId, setToId] = useState(toParam ?? DEFAULTS.to);
  const [toYear, setToYear] = useState(CURRENT_YEAR);
  const [occ, setOcc] = useState("00-0000");
  const [answers, setAnswers] = useState(null);
  const [qOpen, setQOpen] = useState(false);
  const [mode, setMode] = useState("generic");

  const metros = METROS.metros;
  // Countries carry an `iso3`; give them an `id` too so the combobox and
  // lookups treat metros and countries uniformly (id spaces never collide:
  // 5-digit CBSA codes vs 3-letter ISO codes).
  const countries = useMemo(
    () => COUNTRIES.countries.map((c) => ({ ...c, id: c.iso3 })),
    []
  );
  const metroById = useMemo(
    () => Object.fromEntries(metros.map((m) => [m.id, m])),
    [metros]
  );
  const countryById = useMemo(
    () => Object.fromEntries(countries.map((c) => [c.id, c])),
    [countries]
  );
  const resolve = (scope, id) =>
    (scope === "world" ? countryById[id] : metroById[id]) ?? null;

  const from = resolve(fromScope, fromId);
  const to = resolve(toScope, toId);

  const samePlace = from && to && from.id === to.id;
  const usBoth = hasCategories(from) && hasCategories(to);
  const sameYearToday = fromYear === CURRENT_YEAR && toYear === CURRENT_YEAR;
  const ready =
    from && to && salary != null && salary > 0 && !(samePlace && fromYear === toYear);
  // When arriving from an Explore map, `to` is already the picked place.
  const fromMap = Boolean(toParam) && to;

  useEffect(() => {
    if (phase === "results") window.scrollTo({ top: 0 });
  }, [phase]);

  const timeR = cpiRatio(fromYear, toYear);
  const generic = ready
    ? {
        equivalent: equivalentSalary(salary, from, to) * timeR,
        diff: priceDiff(from.rpp.all, to.rpp.all),
      }
    : null;
  const personalRaw =
    ready && usBoth && answers
      ? personalizedComparison(salary, from, to, CES, answers)
      : null;
  const personal = personalRaw
    ? { ...personalRaw, equivalent: personalRaw.equivalent * timeR }
    : null;
  const nAnswered = answers ? answeredCount(answers) : 0;

  const swap = () => {
    setFromScope(toScope);
    setToScope(fromScope);
    setFromId(toId);
    setToId(fromId);
    setFromYear(toYear);
    setToYear(fromYear);
    if (params.get("to")) setParams({}, { replace: true });
  };

  if (phase === "results" && ready) {
    return (
      <main className="mx-auto w-full max-w-[1080px] px-5 pt-10 sm:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-ink-2">
            <span className="font-semibold text-ink">{money.format(salary)}</span>{" "}
            in {whenLabel(from, fromYear)}, compared to{" "}
            <span className="font-semibold text-ink">{whenLabel(to, toYear)}</span>
            {personal && nAnswered > 0 && (
              <span className="text-ink-3">
                {" "}
                · personalized ({nAnswered} of 8 answered)
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setPhase("setup")}
            className="rounded-full bg-field px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-[#e8e8ec]"
          >
            Edit comparison
          </button>
        </div>

        <div className="rise-in grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ResultCard
            salary={salary}
            from={from}
            to={to}
            fromYear={fromYear}
            toYear={toYear}
            samePlace={samePlace}
            mode={mode}
            setMode={setMode}
            generic={generic}
            personal={personal}
          />
          {usBoth && !samePlace ? (
            <Breakdown
              from={from}
              to={to}
              transport={
                personal && mode === "personal"
                  ? { from: CES.transport_idx[from.id], to: CES.transport_idx[to.id] }
                  : null
              }
            />
          ) : (
            <section
              aria-label="Breakdown availability"
              className="flex items-center justify-center rounded-[28px] bg-card p-9 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)]"
            >
              <p className="max-w-[34ch] text-[13.5px] leading-relaxed text-ink-3">
                {samePlace
                  ? "Same place on both sides — this comparison is purely across time, so there's no place-by-category gap to break down."
                  : "The category breakdown uses BEA's housing / goods / utilities / services split, which is published for U.S. metros only. Countries carry a single all-items price level."}
              </p>
            </section>
          )}
          {usBoth && sameYearToday && (
            <>
              <div className="lg:col-span-2">
                <TaxPanel
                  salary={salary}
                  from={from}
                  to={to}
                  equivalent={(mode === "personal" && personal ? personal : generic).equivalent}
                />
              </div>
              <div className="lg:col-span-2">
                <WagePanel
                  wages={WAGES}
                  occupations={WAGES.occupations}
                  occ={occ}
                  from={from}
                  to={to}
                />
              </div>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-[13px] text-ink-3">
          Wondering where these numbers come from?{" "}
          <Link
            to="/methodology"
            className="font-semibold text-accent-strong underline decoration-accent/40 underline-offset-4"
          >
            Read the methodology
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-12 sm:px-8 sm:pt-14">
      <header className="mx-auto max-w-[600px] text-center">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink sm:text-[36px]">
          Compare your salary
        </h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
          {fromMap
            ? `Comparing against ${shortName(to)}${
                isCountry(to) ? "" : `, ${to.name.split(",").pop().trim()}`
              } from the map. Adjust anything below.`
            : "Across a U.S. metro or a country, and across time — from any year to today."}
        </p>
      </header>

      <div className="mt-8">
        <ComparisonForm
          metros={metros}
          countries={countries}
          occupations={WAGES.occupations}
          salary={salary}
          setSalary={setSalary}
          fromScope={fromScope}
          setFromScope={setFromScope}
          from={from}
          setFrom={(m) => setFromId(m?.id ?? null)}
          fromYear={fromYear}
          setFromYear={setFromYear}
          toScope={toScope}
          setToScope={setToScope}
          to={to}
          setTo={(m) => {
            setToId(m?.id ?? null);
            if (params.get("to")) setParams({}, { replace: true });
          }}
          toYear={toYear}
          setToYear={setToYear}
          occ={occ}
          setOcc={setOcc}
          showOccupation={usBoth && sameYearToday}
          onSwap={swap}
        />
      </div>

      {usBoth ? (
        qOpen ? (
          <Questionnaire
            initial={answers ?? {}}
            onComplete={(a) => {
              setAnswers(a);
              setQOpen(false);
              setMode(answeredCount(a) > 0 ? "personal" : "generic");
            }}
            onCancel={() => setQOpen(false)}
          />
        ) : (
          <div className="mx-auto mt-6 flex w-full max-w-[560px] flex-col items-center gap-2 rounded-[20px] bg-card/60 px-6 py-5 text-center">
            {answers && nAnswered > 0 ? (
              <>
                <p className="text-[13.5px] leading-relaxed text-ink-2">
                  Personalized: {profileChips(answers).join(", ")}
                </p>
                <span className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setQOpen(true)}
                    className="text-[13.5px] font-semibold text-accent-strong hover:underline"
                  >
                    Redo questions
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnswers(null);
                      setMode("generic");
                    }}
                    className="text-[13.5px] font-medium text-ink-3 hover:text-ink"
                  >
                    Clear
                  </button>
                </span>
              </>
            ) : (
              <>
                <p className="text-[13.5px] text-ink-2">
                  Want a result tuned to how you actually spend? Eight quick
                  questions, every one skippable.
                </p>
                <button
                  type="button"
                  onClick={() => setQOpen(true)}
                  className="text-[13.5px] font-semibold text-accent-strong hover:underline"
                >
                  Personalize to your lifestyle
                </button>
              </>
            )}
          </div>
        )
      ) : (
        <p className="mx-auto mt-6 w-full max-w-[560px] rounded-[20px] bg-card/60 px-6 py-4 text-center text-[13px] leading-relaxed text-ink-3">
          Lifestyle personalization is built on U.S. spending surveys, so it's
          available when both sides are U.S. metros.
        </p>
      )}

      <div className="mt-8 pb-4 text-center">
        <button
          type="button"
          disabled={!ready}
          onClick={() => setPhase("results")}
          className="rounded-full bg-accent-strong px-8 py-4 text-[15.5px] font-semibold text-white transition-all hover:bg-[#a93016] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          See the results
        </button>
        {samePlace && fromYear === toYear && (
          <p className="mt-3 text-[13px] text-ink-3">
            That's the same place and year on both sides; change the place or a
            year to compare.
          </p>
        )}
      </div>
    </main>
  );
}
