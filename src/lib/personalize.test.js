import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  answeredCount,
  buildWeights,
  costIndex,
  personalizedComparison,
  priceComponents,
  visibleQuestions,
} from "./personalize.js";

const ces = JSON.parse(readFileSync("src/data/ces.json", "utf-8"));
const metros = JSON.parse(readFileSync("src/data/metros.json", "utf-8")).metros;
const byId = Object.fromEntries(metros.map((m) => [m.id, m]));
const SF = byId["41860"];
const AUSTIN = byId["12420"];

const AVG = { tenure: "own", cars: 2, kids: 0, dining: "weekly", commute: "drive" };

describe("buildWeights", () => {
  it("weights always sum to 1, including partial and empty answer sets", () => {
    for (const answers of [
      {},
      AVG,
      { tenure: "rent" },
      { housing_share: 0.45 },
      { tenure: "rent", cars: 0, kids: 2, kid_ages: "young", dining: "daily",
        commute: "transit", commute_len: "long", housing_share: 0.35 },
    ]) {
      const sum = Object.values(buildWeights(ces, answers)).reduce((a, b) => a + b);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("skipping everything falls back to the all-consumer-units weights", () => {
    const w = buildWeights(ces, {});
    for (const k of Object.keys(ces.shares.all)) {
      expect(w[k]).toBeCloseTo(ces.shares.all[k], 10);
    }
  });

  it("renters carry more housing weight than owners", () => {
    const rent = buildWeights(ces, { tenure: "rent" });
    const own = buildWeights(ces, { tenure: "own" });
    expect(rent.housing).toBeGreaterThan(own.housing);
  });

  it("a stated housing share overrides the survey weight exactly", () => {
    const w = buildWeights(ces, { tenure: "rent", housing_share: 0.45 });
    expect(w.housing).toBeCloseTo(0.45, 10);
    const sum = Object.values(w).reduce((a, b) => a + b);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("more kids moves weights further toward the with-children profile", () => {
    const none = buildWeights(ces, { kids: 0 });
    const one = buildWeights(ces, { kids: 1 });
    const three = buildWeights(ces, { kids: 3 });
    const dir = ces.shares.couple_kids.transport_private - ces.shares.all.transport_private;
    expect(Math.sign(one.transport_private - none.transport_private)).toBe(Math.sign(dir));
    expect(Math.abs(three.transport_private - none.transport_private))
      .toBeGreaterThan(Math.abs(one.transport_private - none.transport_private));
  });

  it("daycare-age kids weight household services harder than teens", () => {
    const young = buildWeights(ces, { kids: 2, kid_ages: "young" });
    const teens = buildWeights(ces, { kids: 2, kid_ages: "teens" });
    expect(young.services_other).toBeGreaterThan(teens.services_other);
    expect(teens.food_home).toBeGreaterThan(young.food_home);
  });

  it("zero cars removes private-vehicle weight entirely", () => {
    const w = buildWeights(ces, { cars: 0 });
    expect(w.transport_private).toBe(0);
    expect(w.transport_public).toBeGreaterThan(0);
  });

  it("a long drive weights vehicles harder than a short one", () => {
    const short = buildWeights(ces, { commute: "drive", commute_len: "short" });
    const long = buildWeights(ces, { commute: "drive", commute_len: "long" });
    expect(long.transport_private).toBeGreaterThan(short.transport_private);
  });

  it("dining daily shifts weight from the goods index to services", () => {
    const daily = priceComponents(buildWeights(ces, { dining: "daily" }));
    const rarely = priceComponents(buildWeights(ces, { dining: "rarely" }));
    expect(daily.other_services).toBeGreaterThan(rarely.other_services);
  });
});

describe("question flow", () => {
  it("follow-ups appear only when their parent answer warrants", () => {
    expect(visibleQuestions({}).map((q) => q.key)).not.toContain("kid_ages");
    expect(visibleQuestions({ kids: 2 }).map((q) => q.key)).toContain("kid_ages");
    expect(visibleQuestions({ commute: "wfh" }).map((q) => q.key)).not.toContain("commute_len");
    expect(visibleQuestions({ commute: "drive" }).map((q) => q.key)).toContain("commute_len");
  });

  it("answeredCount ignores skipped (null) answers", () => {
    expect(answeredCount({ tenure: "rent", cars: null, dining: "weekly" })).toBe(2);
  });
});

describe("personalizedComparison", () => {
  it("matches a hand-computed renter case, SF to Austin", () => {
    const answers = { tenure: "rent", cars: 1 };
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
      tenure: "rent", cars: 0, kids: 2, kid_ages: "young", dining: "daily",
      commute: "transit", commute_len: "long", housing_share: 0.45,
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
