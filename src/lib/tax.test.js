import { describe, expect, it } from "vitest";
import {
  bracketTax,
  federalTax,
  ficaTax,
  metroState,
  nycTax,
  stateTax,
  takeHome,
} from "./tax.js";

// Expected values were computed independently (separate implementation
// over the same published tables), with pure-arithmetic spot checks:
//   federal single $85k: 12,400x10% + 38,000x12% + 18,500x22% = $9,870
//   Colorado flat:      (85,000 - 16,100) x 4.4%             = $3,031.60
//   FICA under cap:      85,000 x (6.2% + 1.45%)             = $6,502.50

describe("takeHome, hand-verified paychecks (2026)", () => {
  it("Texas, single, $85,000 (no state income tax)", () => {
    const r = takeHome(85000, "TX", "single");
    expect(r.federal).toBeCloseTo(9870, 2);
    expect(r.state).toBe(0);
    expect(r.fica).toBeCloseTo(6502.5, 2);
    expect(r.net).toBeCloseTo(68627.5, 2);
  });

  it("California, single, $85,000 (10-bracket progressive)", () => {
    const r = takeHome(85000, "CA", "single");
    expect(r.state).toBeCloseTo(3828.42, 2);
    expect(r.net).toBeCloseTo(64799.08, 2);
  });

  it("New York + NYC resident, single, $120,000", () => {
    const r = takeHome(120000, "NY", "single", { nyc: true });
    expect(r.federal).toBeCloseTo(17570, 2);
    expect(r.state).toBeCloseTo(6039.75, 2);
    expect(r.local).toBeCloseTo(4216.29, 2);
    expect(r.net).toBeCloseTo(82993.96, 2);
  });

  it("married filing jointly lowers federal tax (TX, $85,000)", () => {
    const r = takeHome(85000, "TX", "married");
    expect(r.federal).toBeCloseTo(5840, 2);
    expect(r.net).toBeCloseTo(72657.5, 2);
  });

  it("Colorado flat 4.4% on income above the federal-coupled deduction", () => {
    const r = takeHome(85000, "CO", "single");
    expect(r.state).toBeCloseTo(3031.6, 2);
  });

  it("income below the federal deduction owes no federal tax", () => {
    const r = takeHome(10000, "CA", "single");
    expect(r.federal).toBe(0);
    expect(r.state).toBeCloseTo(44.6, 2); // CA's $5,540 deduction is smaller
    expect(r.fica).toBeCloseTo(765, 2);
  });

  it("$250,000: Social Security caps at the wage base, additional Medicare kicks in", () => {
    const r = takeHome(250000, "CA", "single");
    // 184,500 x 6.2% + 250,000 x 1.45% + 50,000 x 0.9% = 15,514
    expect(r.fica).toBeCloseTo(15514, 2);
    expect(r.federal).toBeCloseTo(51304, 2);
    expect(r.net).toBeCloseTo(164008.58, 2);
  });
});

describe("component behaviors", () => {
  it("bracketTax leaves income below a nonzero first threshold untaxed (Ohio-style)", () => {
    expect(bracketTax([[26050, 0.0275]], 20000)).toBe(0);
    expect(bracketTax([[26050, 0.0275]], 30000)).toBeCloseTo(3950 * 0.0275, 6);
  });

  it("all nine no-income-tax states return zero state tax", () => {
    for (const s of ["AK", "FL", "NH", "NV", "SD", "TN", "TX", "WA", "WY"]) {
      expect(stateTax(200000, s, "single"), s).toBe(0);
    }
  });

  it("Washington wage income is untaxed (capital-gains excise ignored)", () => {
    expect(stateTax(500000, "WA", "single")).toBe(0);
  });

  it("federal tax is monotonic in income", () => {
    let prev = 0;
    for (let g = 0; g <= 400000; g += 5000) {
      const t = federalTax(g, "single");
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it("NYC tax uses the NY deduction base", () => {
    expect(nycTax(8000, "single")).toBe(0); // fully under NY's $8,000
    expect(nycTax(20000, "single")).toBeCloseTo(12000 * 0.03078, 2);
  });

  it("ficaTax applies married additional-Medicare threshold", () => {
    const single = ficaTax(240000, "single");
    const married = ficaTax(240000, "married");
    expect(single - married).toBeCloseTo(40000 * 0.009, 6);
  });

  it("metroState picks the primary state of multi-state metros", () => {
    expect(metroState({ name: "New York-Newark-Jersey City, NY-NJ" })).toBe("NY");
    expect(metroState({ name: "Austin-Round Rock-San Marcos, TX" })).toBe("TX");
    expect(metroState({ name: "St. Louis, MO-IL" })).toBe("MO");
  });
});
