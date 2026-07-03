import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { usePageMeta } from "../lib/meta.js";
import { equivalentSalary, money, priceDiff, shortName } from "../lib/compare.js";
import { answeredCount, personalizedComparison } from "../lib/personalize.js";
import ComparisonForm from "../components/ComparisonForm.jsx";
import Questionnaire from "../components/Questionnaire.jsx";
import ResultCard from "../components/ResultCard.jsx";
import Breakdown from "../components/Breakdown.jsx";
import TaxPanel from "../components/TaxPanel.jsx";
import WagePanel from "../components/WagePanel.jsx";
import METROS from "../data/metros.json";
import WAGES from "../data/wages.json";
import CES from "../data/ces.json";

const DEFAULTS = { from: "41860", to: "12420", salary: 85000 }; // SF -> Austin

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

export default function Compare() {
  usePageMeta(
    "Compare salaries between cities - Purchasing Power",
    "Enter a salary and two U.S. metro areas to see the equivalent salary, what drives the gap, and after-tax purchasing power."
  );
  const [params, setParams] = useSearchParams();
  const [phase, setPhase] = useState("setup");
  const [salary, setSalary] = useState(DEFAULTS.salary);
  const [fromId, setFromId] = useState(DEFAULTS.from);
  const [toId, setToId] = useState(params.get("to") ?? DEFAULTS.to);
  const [occ, setOcc] = useState("00-0000");
  const [answers, setAnswers] = useState(null);
  const [qOpen, setQOpen] = useState(false);
  const [mode, setMode] = useState("generic");

  const metros = METROS.metros;
  const byId = useMemo(
    () => Object.fromEntries(metros.map((m) => [m.id, m])),
    [metros]
  );
  const from = byId[fromId] ?? null;
  const to = byId[toId] ?? null;
  const ready = from && to && salary != null && salary > 0 && from.id !== to.id;
  const fromMap = params.get("to") && byId[params.get("to")];

  useEffect(() => {
    if (phase === "results") window.scrollTo({ top: 0 });
  }, [phase]);

  const generic = ready
    ? {
        equivalent: equivalentSalary(salary, from, to),
        diff: priceDiff(from.rpp.all, to.rpp.all),
      }
    : null;
  const personal =
    ready && answers ? personalizedComparison(salary, from, to, CES, answers) : null;
  const nAnswered = answers ? answeredCount(answers) : 0;

  if (phase === "results" && ready) {
    return (
      <main className="mx-auto w-full max-w-[1080px] px-5 pt-10 sm:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-ink-2">
            <span className="font-semibold text-ink">{money.format(salary)}</span>{" "}
            in {shortName(from)}, moving to{" "}
            <span className="font-semibold text-ink">{shortName(to)}</span>
            {answers && nAnswered > 0 && (
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
            mode={mode}
            setMode={setMode}
            generic={generic}
            personal={personal}
          />
          <Breakdown
            from={from}
            to={to}
            transport={
              personal && mode === "personal"
                ? { from: CES.transport_idx[from.id], to: CES.transport_idx[to.id] }
                : null
            }
          />
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
      <header className="mx-auto max-w-[560px] text-center">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink sm:text-[36px]">
          Compare your salary
        </h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
          {fromMap
            ? `Comparing against ${shortName(fromMap)}, ${fromMap.name.split(",").pop().trim()} from the map. Adjust anything below.`
            : "Where you are, where you're looking, and what you earn."}
        </p>
      </header>

      <div className="mt-8">
        <ComparisonForm
          metros={metros}
          occupations={WAGES.occupations}
          salary={salary}
          setSalary={setSalary}
          from={from}
          setFrom={(m) => setFromId(m?.id ?? null)}
          to={to}
          setTo={(m) => {
            setToId(m?.id ?? null);
            if (params.get("to")) setParams({}, { replace: true });
          }}
          occ={occ}
          setOcc={setOcc}
        />
      </div>

      {qOpen ? (
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
        {from && to && from.id === to.id && (
          <p className="mt-3 text-[13px] text-ink-3">
            That's the same metro on both sides; pick a different destination.
          </p>
        )}
      </div>
    </main>
  );
}
