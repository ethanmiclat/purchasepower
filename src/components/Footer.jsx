import { Link } from "react-router-dom";
import METROS from "../data/metros.json";

export default function Footer() {
  const meta = METROS.meta;
  return (
    <footer className="mx-auto mt-auto w-full max-w-[1080px] px-5 pb-10 pt-16 sm:px-8">
      <div className="flex flex-col gap-2 border-t border-[#dcdce0] pt-6 text-[12.5px] leading-relaxed text-ink-3 sm:flex-row sm:items-baseline sm:justify-between">
        <p>
          Data: BEA Regional Price Parities ({meta.rpp_year}), BLS OEWS (
          {meta.oews_vintage}), BLS Consumer Expenditure Survey. Public
          domain. Retrieved {meta.pulled}.
        </p>
        <p className="shrink-0">
          <Link
            to="/methodology"
            className="font-semibold text-accent-strong underline decoration-accent/40 underline-offset-4 hover:decoration-accent-strong"
          >
            Sources and methodology
          </Link>
        </p>
      </div>
    </footer>
  );
}
