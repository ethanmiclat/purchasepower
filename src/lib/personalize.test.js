import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildWeights,
  costIndex,
  personalizedComparison,
  priceComponents,
} from "./personalize.js";

const ces = JSON.parse(readFileSync("public/data/ces.json", "utf-8"));
const metros = JSON.parse(
  readFileSync("public/data/metros.json", "utf-8")
).metros;
const byId = Object.fromEntries(metros.map((m) => [m.id, m]));
const SF = byId["41860"];
const AUSTIN = byId["12420"];

const AVG = { tenure: "own", cars: 2, kids: false, dining: "weekly", commute: "drive" };

describe("buildWeights", () => {
  it("weights always sum to 1", () => {
    for (const answers of [
      AVG,
      { tenure: "rent", cars: 0, kids: true, dining: "daily", commute: "transit" },
      { tenure: "own", cars: 3, kids: true, dining: "rarely", commute: "wfh" },
    ]) {
      const sum = Object.values(buildWeights(ces, answers)).reduce((a, b) => a + b);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("renters carry more housing weight than owners", () => {
    const rent = buildWeights(ces, { ...AVG, tenure: "rent" });
    const own = buildWeights(ces, { ...AVG, tenure: "own" });
    expect(rent.housing).toBeGreaterThan(own.housing);
  });

  it("zero cars removes private-vehicle weight entirely", () => {
    const w = buildWeights(ces, { ...AVG, cars: 0 });
    expect(w.transport_private).toBe(0);
    expect(w.transport_public).toBeGreaterThan(0);
  });

  it("dining daily shifts weight from the goods index to services", () => {
    const daily = priceComponents(buildWeights(ces, { ...AVG, dining: "daily" }));
    const rarely = priceComponents(buildWeights(ces, { ...AVG, dining: "rarely" }));
    expect(daily.other_services).toBeGreaterThan(rarely.other_services);
  });
});

describe("personalizedComparison", () => {
  it("matches a hand-computed renter case, SF to Austin", () => {
    const answers = { tenure: "rent", cars: 1, kids: false, dining: "weekly", commute: "drive" };
    const w = { ...ces.shares.renter };
    w.transport_private *= 1 / ces.meta.vehicles_per_cu;
    const sum = Object.values(w).reduce((a, b) => a + b);
    for (const k of Object.keys(w)) w[k] /= sum;
    const comp = {
      housing: w.housing,
      utilities: w.utilities,
      goods: w.food_home + w.goods_other,
      other_services: w.food_away + w.services_other,
      transport: w.transport_private + w.transport_public,
    };
    const cost = (m) =>
      comp.housing * m.rpp.housing +
      comp.utilities * m.rpp.utilities +
      comp.goods * m.rpp.goods +
      comp.other_services * m.rpp.other_services +
      comp.transport * ces.transport_idx[m.id];
    const expected = 85000 * (cost(AUSTIN) / cost(SF));

    const got = personalizedComparison(85000, SF, AUSTIN, ces, answers);
    expect(got.equivalent).toBeCloseTo(expected, 6);
    // A renter should feel SF -> Austin more than the generic number
    // does, because the housing gap dominates a renter's budget.
    expect(got.equivalent).toBeLessThan(85000 * (AUSTIN.rpp.all / SF.rpp.all));
  });

  it("is symmetric: A->B and B->A round-trip", () => {
    const there = personalizedComparison(100000, SF, AUSTIN, ces, AVG);
    const back = personalizedComparison(there.equivalent, AUSTIN, SF, ces, AVG);
    expect(back.equivalent).toBeCloseTo(100000, 6);
  });

  it("every metro has a transport index", () => {
    for (const m of metros) {
      expect(ces.transport_idx[m.id], m.name).toBeGreaterThan(0);
    }
  });

  it("identical metros give a 1.0 ratio regardless of profile", () => {
    const r = personalizedComparison(70000, SF, SF, ces, {
      tenure: "rent", cars: 0, kids: true, dining: "daily", commute: "transit",
    });
    expect(r.equivalent).toBeCloseTo(70000, 8);
  });
});

describe("costIndex", () => {
  it("stays near the metro's official all-items RPP for average weights", () => {
    // Sanity bound, not equality: our CES weighting differs from BEA's
    // internal weights (CES shelter ~25% vs BEA's smaller rents weight),
    // so extreme-housing metros like SF sit ~14% high. The bound is a
    // regression tripwire against the mapping drifting further.
    const comp = priceComponents(buildWeights(ces, AVG));
    for (const m of [SF, AUSTIN, byId["35620"]]) {
      const c = costIndex(m, comp, ces.transport_idx);
      expect(Math.abs(c - m.rpp.all) / m.rpp.all, m.name).toBeLessThan(0.16);
    }
  });
});
