// Personalized reweighting of the cost comparison.
//
// The generic result uses BEA's all-items RPP, which embeds average
// U.S. spending. Personalization rebuilds the weights from BLS Consumer
// Expenditure Survey cuts matching the user's answers, prices each
// spending bucket with the matching BEA index, and prices
// transportation (which BEA does not publish) with a CES spending-based
// intensity index per metro.
//
// EVERY question is optional. A skipped answer is null/undefined and
// leaves that dimension at the generic (all-consumer-units) weighting;
// nothing is guessed. Two kinds of numbers appear below:
//   - published CES ratios (tenure and with-kids cuts, vehicles per
//     household)
//   - multipliers marked ASSUMPTION: stated round judgments, documented
//     on the Methodology page. They are not measured survey data.

export const QUESTIONS = [
  {
    key: "tenure",
    title: "Do you rent or own your home?",
    options: [
      { value: "rent", label: "Rent" },
      { value: "own", label: "Own" },
    ],
  },
  {
    key: "housing_share",
    title: "Roughly what share of your take-home pay goes to housing?",
    options: [
      { value: 0.15, label: "Under 20%" },
      { value: 0.25, label: "20 to 30%" },
      { value: 0.35, label: "30 to 40%" },
      { value: 0.45, label: "More than 40%" },
    ],
  },
  {
    key: "kids",
    title: "How many kids at home?",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "One" },
      { value: 2, label: "Two" },
      { value: 3, label: "Three or more" },
    ],
  },
  {
    key: "kid_ages",
    when: (a) => a.kids > 0,
    title: "How old are they?",
    options: [
      { value: "young", label: "Under 5" },
      { value: "school", label: "5 to 12" },
      { value: "teens", label: "Teenagers" },
      { value: "mixed", label: "A mix" },
    ],
  },
  {
    key: "cars",
    title: "How many cars in your household?",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "One" },
      { value: 2, label: "Two" },
      { value: 3, label: "Three or more" },
    ],
  },
  {
    key: "commute",
    title: "How do you usually get around?",
    options: [
      { value: "drive", label: "Drive" },
      { value: "transit", label: "Public transit" },
      { value: "active", label: "Walk or bike" },
      { value: "wfh", label: "Mostly home" },
    ],
  },
  {
    key: "commute_len",
    when: (a) => a.commute === "drive" || a.commute === "transit",
    title: "How long is your typical commute?",
    options: [
      { value: "short", label: "Under 15 minutes" },
      { value: "medium", label: "15 to 45 minutes" },
      { value: "long", label: "Over 45 minutes" },
    ],
  },
  {
    key: "dining",
    title: "How often do you dine out?",
    options: [
      { value: "rarely", label: "Rarely" },
      { value: "weekly", label: "About weekly" },
      { value: "often", label: "A few times a week" },
      { value: "daily", label: "Almost daily" },
    ],
  },
];

export function visibleQuestions(answers) {
  return QUESTIONS.filter((q) => !q.when || q.when(answers));
}

export function answeredCount(answers) {
  return visibleQuestions(answers).filter(
    (q) => answers[q.key] !== null && answers[q.key] !== undefined
  ).length;
}

// ASSUMPTION multipliers (round, disclosed on the Methodology page).
const DINING_MULT = { rarely: 0.6, weekly: 1.0, often: 1.4, daily: 1.8 };
const KIDS_BLEND = { 1: 0.7, 2: 1.0, 3: 1.15 };
const KID_AGE_MULT = {
  young: { services_other: 1.2 }, // childcare lives in household services
  school: { food_home: 1.05 },
  teens: { food_home: 1.12, goods_other: 1.06 },
  mixed: { services_other: 1.1, food_home: 1.06 },
};
const TRANSIT_PUBLIC_MULT = 2.0;
const NO_COMMUTE_PRIVATE_MULT = 0.9;
const COMMUTE_LEN_MULT = {
  drive: { short: 0.94, medium: 1.0, long: 1.12 }, // on private vehicles
  transit: { short: 0.9, medium: 1.0, long: 1.2 }, // on public transit
};

export function buildWeights(ces, answers = {}) {
  const { shares, meta } = ces;
  const a = answers;

  const base =
    a.tenure === "rent"
      ? shares.renter
      : a.tenure === "own"
        ? shares.owner
        : shares.all;
  const w = { ...base };

  if (a.kids > 0) {
    const t = KIDS_BLEND[Math.min(a.kids, 3)];
    for (const k of Object.keys(w)) {
      const ratio = shares.couple_kids[k] / shares.all[k]; // published
      w[k] *= 1 + (ratio - 1) * t;
    }
    for (const [k, m] of Object.entries(KID_AGE_MULT[a.kid_ages] ?? {})) {
      w[k] *= m;
    }
  }

  if (a.cars !== null && a.cars !== undefined) {
    w.transport_private *= a.cars / meta.vehicles_per_cu; // published avg
  }
  if (a.commute === "transit") {
    w.transport_public *= TRANSIT_PUBLIC_MULT;
  } else if (a.commute === "active" || a.commute === "wfh") {
    w.transport_private *= NO_COMMUTE_PRIVATE_MULT;
  }
  const lenMult = COMMUTE_LEN_MULT[a.commute]?.[a.commute_len];
  if (lenMult) {
    if (a.commute === "drive") w.transport_private *= lenMult;
    else w.transport_public *= lenMult;
  }
  if (a.dining) w.food_away *= DINING_MULT[a.dining];

  let sum = Object.values(w).reduce((x, y) => x + y, 0);
  for (const k of Object.keys(w)) w[k] /= sum;

  // Stated housing share overrides the survey-derived housing weight;
  // everything else rescales proportionally. (Take-home-pay share is
  // treated as a spending share - an approximation, disclosed.)
  if (a.housing_share !== null && a.housing_share !== undefined) {
    const scale = (1 - a.housing_share) / (1 - w.housing);
    for (const k of Object.keys(w)) w[k] *= scale;
    w.housing = a.housing_share;
  }
  return w;
}

// Collapse the 8 CES spending buckets onto the indices that price them.
export function priceComponents(w) {
  return {
    housing: w.housing,
    utilities: w.utilities,
    goods: w.food_home + w.goods_other,
    other_services: w.food_away + w.services_other,
    transport: w.transport_private + w.transport_public,
  };
}

export function costIndex(metro, comp, transportIdx) {
  return (
    comp.housing * metro.rpp.housing +
    comp.utilities * metro.rpp.utilities +
    comp.goods * metro.rpp.goods +
    comp.other_services * metro.rpp.other_services +
    comp.transport * transportIdx[metro.id]
  );
}

export function personalizedComparison(salary, from, to, ces, answers) {
  const comp = priceComponents(buildWeights(ces, answers));
  const idxFrom = costIndex(from, comp, ces.transport_idx);
  const idxTo = costIndex(to, comp, ces.transport_idx);
  return {
    equivalent: salary * (idxTo / idxFrom),
    diff: idxTo / idxFrom - 1,
    components: comp,
  };
}
