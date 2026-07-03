// Take-home pay estimation. Deliberately simplified and labeled as such
// in the UI: standard deductions only (no itemizing, exemptions, or
// credits), state brackets applied to gross minus the state's standard
// deduction, plus employee-side FICA. NYC is the one modeled local tax.
// Data: src/lib/taxdata.json (Tax Foundation 2026 tables, IRS Rev. Proc.
// 2025-32, SSA 2026 wage base) - see data/README.md.

import DATA from "./taxdata.json";

export const TAX_YEAR = DATA.meta.year;

// brackets: sorted [threshold, rate][]; rate applies to income between
// its threshold and the next. A first threshold above 0 leaves income
// below it untaxed (e.g. Ohio, Mississippi).
export function bracketTax(brackets, taxable) {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [floor, rate] = brackets[i];
    const ceil = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (taxable <= floor) break;
    tax += (Math.min(taxable, ceil) - floor) * rate;
  }
  return tax;
}

export function federalTax(gross, filing) {
  const taxable = Math.max(0, gross - DATA.federal.deduction[filing]);
  return bracketTax(DATA.federal.brackets[filing], taxable);
}

export function stateTax(gross, state, filing) {
  const s = DATA.states[state];
  if (!s) throw new Error(`unknown state: ${state}`);
  if (s.none) return 0;
  const taxable = Math.max(0, gross - s.deduction[filing]);
  return bracketTax(s.brackets[filing], taxable);
}

export function nycTax(gross, filing) {
  // NYC taxes New York taxable income; approximate with the NY state
  // standard deduction as the base reduction.
  const taxable = Math.max(0, gross - DATA.states.NY.deduction[filing]);
  return bracketTax(DATA.nyc.brackets[filing], taxable);
}

export function ficaTax(gross, filing) {
  const f = DATA.fica;
  const ss = Math.min(gross, f.ss_wage_base) * f.ss_rate;
  const medicare =
    gross * f.medicare_rate +
    Math.max(0, gross - f.medicare_addl_threshold[filing]) *
      f.medicare_addl_rate;
  return ss + medicare;
}

export function takeHome(gross, state, filing, { nyc = false } = {}) {
  const federal = federalTax(gross, filing);
  const st = stateTax(gross, state, filing);
  const local = nyc ? nycTax(gross, filing) : 0;
  const fica = ficaTax(gross, filing);
  const net = gross - federal - st - local - fica;
  return { gross, federal, state: st, local, fica, net };
}

export function salesTaxInfo(state) {
  return DATA.sales[state];
}

export function stateHasIncomeTax(state) {
  return !DATA.states[state].none;
}

// "Austin-Round Rock-San Marcos, TX" -> "TX";
// multi-state metros ("NY-NJ") use the first-listed (primary) state.
export function metroState(metro) {
  return metro.name.split(",").pop().trim().split("-")[0];
}
