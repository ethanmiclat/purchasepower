import { Link } from "react-router-dom";
import { usePageMeta } from "../lib/meta.js";
import METROS from "../data/metros.json";
import STATES from "../data/states.json";
import CES from "../data/ces.json";
import COUNTRIES from "../data/countries.json";
import { TAX_YEAR } from "../lib/tax.js";
import {
  COHORTS,
  CPI_FIRST_YEAR,
  CPI_LAST_YEAR,
  GEN_META,
} from "../lib/historical.js";
import { ICP_CATEGORIES, ICP_META } from "../lib/icp.js";

function Section({ title, children }) {
  return (
    <section className="rounded-[24px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-9">
      <h2 className="text-[19px] font-bold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-3 text-[14.5px] leading-relaxed text-ink-2">
        {children}
      </div>
    </section>
  );
}

function Ext({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-accent-strong underline decoration-accent/40 underline-offset-4 hover:decoration-accent-strong"
    >
      {children}
    </a>
  );
}

export default function Methodology() {
  usePageMeta(
    "Methodology and sources - Purchasing Power",
    "Every dataset, formula, and assumption behind the purchasing power comparisons: BEA price parities, BLS wages and spending, and 2026 tax tables."
  );
  const m = METROS.meta;

  return (
    <main className="mx-auto w-full max-w-[820px] px-5 pt-12 sm:px-8 sm:pt-14">
      <header className="max-w-[560px]">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-ink sm:text-[36px]">
          How the numbers are made
        </h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
          Everything on this site comes from official statistical sources —
          U.S. government data for metros and taxes, the World Bank for
          countries — processed into static files when the site is built.
          Nothing is estimated live, and every assumption we add on top is
          listed here.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-5 pb-4">
        <Section title="The core comparison">
          <p>
            The headline number converts a salary with the ratio of BEA
            Regional Price Parities: an all-items price index for each
            metro where the U.S. average is 100. Earning $85,000 in a metro
            priced at 115.6 and moving to one priced at 98.1 gives an
            equivalent salary of $85,000 x 98.1 / 115.6.
          </p>
          <p>
            Prices: <Ext href="https://apps.bea.gov/regional/">BEA Regional
            Price Parities</Ext>, {m.rpp_year} vintage, covering {METROS.metros.length} metro
            areas (retrieved {m.pulled}). The state map uses the matching
            state-level series ({STATES.meta.rpp_year}). The category
            breakdown shows BEA's published components: housing (rents),
            goods, utilities, and other services. BEA publishes no combined
            "services" index and no transportation index, so components are
            shown as published, never blended.
          </p>
          <p>
            Typical pay: <Ext href="https://www.bls.gov/oes/">BLS
            Occupational Employment and Wage Statistics</Ext> ({m.oews_vintage}),
            median annual wages for 22 major occupation groups per metro.
          </p>
        </Section>

        <Section title="Comparing to a country">
          <p>
            Switching a side to a country prices it with the World Bank's{" "}
            <Ext href="https://data.worldbank.org/indicator/PA.NUS.PPP">
            price level index</Ext>, covering{" "}
            {COUNTRIES.countries.length} countries ({COUNTRIES.meta.value_years}
            {" "}vintages, retrieved {COUNTRIES.meta.pulled}). We compute it
            from two live World Bank series — the PPP conversion factor
            (PA.NUS.PPP) divided by the official exchange rate (PA.NUS.FCRF)
            — which reproduces the Bank's own now-archived price-level ratio.
            The result is 1.0 for the United States by construction, so we
            re-base it to U.S. = 100, the same scale BEA uses for metros. A
            country then slots into the exact same ratio math. The{" "}
            <Link
              to="/explore"
              className="font-semibold text-accent-strong underline decoration-accent/40 underline-offset-4"
            >
              Explore map
            </Link>{" "}
            shades every country on this same scale.
          </p>
          <p>
            We drop a handful of countries whose computed price level falls
            outside a sane band ({COUNTRIES.meta.plausible_band[0]}–
            {COUNTRIES.meta.plausible_band[1]} on the U.S. = 100 scale): those
            values come from a distorted official exchange rate — a dollarized
            economy, or a pegged or multiple-rate regime — not a real price
            level, and would drive nonsense comparisons. They show as grey
            "no data" on the map.
          </p>
          <p>
            The headline number uses a single all-items price level. For a
            category breakdown, a comparison between two countries adds one
            from the <Ext href="https://www.worldbank.org/en/programs/icp">
            World Bank International Comparison Program</Ext> ({ICP_META.round}):
            price level indices for {ICP_CATEGORIES.length} expenditure
            categories (food, housing &amp; utilities, health, transport,
            and so on), each re-based to U.S. = 100. ICP publishes this
            category detail for benchmark years only ({ICP_META.year}) and
            under its own groupings, so it appears only for
            country-versus-country comparisons at today's dollars — not for a
            U.S. metro paired with a country, whose price taxonomies differ.
          </p>
          <p>
            Other deliberate limits: the after-tax and typical-pay panels,
            built on U.S. tax tables and U.S. wage surveys, do not appear for
            countries. Figures stay in U.S. dollars throughout: a country
            result is the USD you would need there for equal purchasing power,
            not a live currency conversion.
          </p>
        </Section>

        <Section title="Comparing across time & generations">
          <p>
            Each side also has a year. Change it and the salary is adjusted
            for inflation with the{" "}
            <Ext href="https://www.bls.gov/cpi/">BLS Consumer Price Index for
            All Urban Consumers</Ext> (CPI-U, U.S. city average, all items),
            annual averages from {CPI_FIRST_YEAR} to {CPI_LAST_YEAR}. Two
            years' index values form a ratio — dollars in the earlier year
            times CPI(later) / CPI(earlier) — that multiplies the place ratio.
            When both years are {CPI_LAST_YEAR} (the default, "today") the
            ratio is exactly 1 and nothing changes.
          </p>
          <p>
            A historical comparison also breaks inflation down by category —
            how much food, housing, apparel, transport, medical care, and the
            other CPI-U major groups each rose between the two years. This is
            national (U.S. city average): there is no price history broken out
            by metro, so the category bars are the same regardless of which
            cities you pick. Coverage varies by group (apparel back to 1913,
            medical and transport to the 1930s, food and housing to 1967,
            recreation and education only to 1993), and a group is shown only
            when both years are within its range.
          </p>
          <p>
            The generation buttons (Silent through Gen Z, using{" "}
            <Ext href="https://www.pewresearch.org/short-reads/2019/01/17/where-millennials-end-and-generation-z-begins/">
            Pew Research Center</Ext> birth-year boundaries) are only a
            convenience: each jumps the year to a representative calendar year
            for that cohort — roughly when they were coming of age, about age
            25. We do not model a generation "at a fixed age"; you are always
            picking an actual calendar year that CPI adjusts between.
          </p>
          <p>
            Two honest limits. First, we hold <em>relative</em> place price
            differences constant across time: we have current BEA parities,
            not a metro-by-metro price history, so a historical comparison
            adjusts only for national inflation, not for how a specific city's
            relative expensiveness has shifted. Second, the median household
            income shown next to a historical result (
            <Ext href="https://fred.stlouisfed.org/series/MEHOINUSA646N">
            {GEN_META.income_source_name}</Ext>, {GEN_META.income_years}) is
            nominal context only — never part of the equivalence math — and
            is unavailable before its series begins.
          </p>
        </Section>

        <Section title="Personalization">
          <p>
            The generic result assumes average U.S. spending. Answering the
            optional questions rebuilds the budget weights from the{" "}
            <Ext href="https://www.bls.gov/cex/">BLS Consumer Expenditure
            Survey</Ext> ({CES.meta.cx_year}), then prices each slice of
            that budget with the matching BEA index. Every question can be
            skipped; a skipped question leaves that part of the budget at
            the survey average rather than guessing.
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong className="font-semibold text-ink">Rent or own</strong>:
              published renter or homeowner spending shares (renters put
              ~34% of spending into housing vs ~22% for owners).
            </li>
            <li>
              <strong className="font-semibold text-ink">Housing share</strong>:
              your stated share replaces the survey's housing weight
              outright; the rest of the budget rescales. Treating a share
              of take-home pay as a share of spending is an approximation.
            </li>
            <li>
              <strong className="font-semibold text-ink">Kids and ages</strong>:
              published with-children spending ratios, applied at 70% for
              one child, 100% for two, 115% for three or more. Age tweaks
              (daycare-age boosting household services, teenagers boosting
              groceries) are our assumptions, kept small and round.
            </li>
            <li>
              <strong className="font-semibold text-ink">Cars</strong>:
              vehicle spending scales with your car count against the
              published {CES.meta.vehicles_per_cu}-vehicle household
              average. Proportional scaling is our assumption.
            </li>
            <li>
              <strong className="font-semibold text-ink">Getting around +
              commute length</strong>: transit doubles the public-transit
              share; walking, biking, or staying home trims vehicle
              spending by 10%; commute length adjusts the relevant share by
              roughly plus or minus 10 to 20%. All assumptions.
            </li>
            <li>
              <strong className="font-semibold text-ink">Dining out</strong>:
              scales the restaurant share between 0.6x and 1.8x of average.
              The scale points are assumptions, not survey data.
            </li>
          </ul>
          <p>
            <strong className="font-semibold text-ink">The transportation
            gap</strong>: BEA publishes no transportation price index, so
            personalized results compare metros on household transportation
            spending intensity from the Consumer Expenditure Survey,
            measured directly for {CES.meta.msa_direct_count} large metros
            and estimated from region and city size elsewhere. It reflects
            how car-dependent a metro is, not pure prices, and is labeled
            "spending-based" wherever it appears.
          </p>
        </Section>

        <Section title={`Taxes (${TAX_YEAR})`}>
          <p>
            The after-tax view estimates take-home pay in both metros:
            federal income tax (IRS Rev. Proc. 2025-32 brackets, standard
            deduction, single or married filing jointly), state income tax
            from the <Ext href="https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/">Tax
            Foundation's {TAX_YEAR} tables</Ext>, employee-side FICA
            including the Social Security wage base and additional
            Medicare tax, and New York City's resident income tax as the
            one modeled local tax.
          </p>
          <p>
            Deliberate limits: standard deductions only, no itemizing,
            exemptions, or credits; multi-state metros use their primary
            state; Washington counts as no-income-tax because its
            capital-gains excise does not apply to wages. Sales tax rates
            are shown for reference but never added to the math, because
            BEA's price levels already include them.
          </p>
          <p className="rounded-[14px] bg-field px-4 py-3">
            These are estimates for a simple W-2 situation. Real tax
            situations vary substantially. Nothing here is tax or financial
            advice; consult a professional about your own.
          </p>
        </Section>

        <Section title="Data freshness">
          <p>
            All datasets are pulled by scripts in the project's ETL folder,
            validated, and committed as static JSON that ships with the
            site; the live site makes no API calls. Current vintages: BEA
            RPP {m.rpp_year}, BLS OEWS {m.oews_vintage}, CES{" "}
            {CES.meta.cx_year}, tax year {TAX_YEAR}, World Bank price levels{" "}
            {COUNTRIES.meta.value_years}, CPI-U through {CPI_LAST_YEAR}, all
            retrieved {m.pulled}. Refreshing means re-running the scripts when
            new vintages publish (BEA in December, OEWS in spring, CES in
            fall, CPI monthly, World Bank periodically).
          </p>
        </Section>
      </div>
    </main>
  );
}
