import CityCombobox from "./CityCombobox.jsx";

function SalaryInput({ value, onChange }) {
  const display = value == null ? "" : value.toLocaleString("en-US");
  return (
    <div>
      <label
        htmlFor="salary"
        className="mb-2 block text-[13px] font-semibold text-ink-2"
      >
        Annual salary
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-medium text-ink-3"
        >
          $
        </span>
        <input
          id="salary"
          inputMode="numeric"
          autoComplete="off"
          placeholder="85,000"
          className="w-full rounded-[14px] border-[1.5px] border-transparent bg-field py-3 pl-8 pr-4 text-[15px] font-medium text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-ink"
          value={display}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 8);
            onChange(digits ? Number(digits) : null);
          }}
        />
      </div>
    </div>
  );
}

export default function ComparisonForm({
  metros,
  occupations,
  salary,
  setSalary,
  from,
  setFrom,
  to,
  setTo,
  occ,
  setOcc,
}) {
  return (
    <section
      aria-label="Comparison inputs"
      className="mx-auto w-full max-w-[560px] rounded-[28px] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.08)] sm:p-9"
    >
      <div className="flex flex-col gap-5">
        <SalaryInput value={salary} onChange={setSalary} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <CityCombobox
            label="Where you live"
            metros={metros}
            value={from}
            onChange={setFrom}
          />
          <CityCombobox
            label="Where you're looking"
            metros={metros}
            value={to}
            onChange={setTo}
          />
        </div>

        <div className="grid grid-cols-1 items-end gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <label
              htmlFor="occupation"
              className="mb-2 block text-[13px] font-semibold text-ink-2"
            >
              Occupation <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <select
              id="occupation"
              className="w-full appearance-none rounded-[14px] border-[1.5px] border-transparent bg-field px-4 py-3 text-[15px] font-medium text-ink outline-none transition-colors focus:border-ink"
              value={occ}
              onChange={(e) => setOcc(e.target.value)}
            >
              {occupations.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.code === "00-0000" ? "All occupations" : o.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            className="h-[46px] rounded-[14px] bg-field px-5 text-[14px] font-semibold text-ink transition-transform hover:bg-[#e8e8ec] active:scale-[0.98]"
          >
            Swap cities
          </button>
        </div>
      </div>
    </section>
  );
}
