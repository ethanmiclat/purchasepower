// Personalized reweighting of the cost comparison.
//
// The generic result uses BEA's all-items RPP, which embeds average
// U.S. spending patterns. Personalization rebuilds the weights from
// BLS Consumer Expenditure Survey cuts that match the user's answers,
// then prices each spending bucket with the matching BEA index, and
// transportation (which BEA does not price) with a CES spending-based
// intensity index per metro.
//
// Two kinds of numbers appear here:
//  - published CES ratios (tenure and kids cuts, vehicles per household)
//  - multipliers marked ASSUMPTION: stated judgments, kept round and
//    documented in the in-app methodology note. They are not measured.

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
    key: "cars",
    title: "How many cars in your household?",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "One" },
      { value: 2, label: "Two" },
      { value: 3, label: "Three+" },
    ],
  },
  {
    key: "kids",
    title: "Do you have kids at home?",
    options: [
      { value: false, label: "No kids" },
      { value: true, label: "Kids at home" },
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
];

// ASSUMPTION: scaling of the food-away-from-home budget share relative
// to the national average ("about weekly" is treated as average).
const DINING_MULT = { rarely: 0.6, weekly: 1.0, often: 1.4, daily: 1.8 };

// ASSUMPTION: transit riders' public-transportation share doubles;
// walk/bike/home commuters spend 10% less on vehicles.
const TRANSIT_PUBLIC_MULT = 2.0;
const NO_COMMUTE_PRIVATE_MULT = 0.9;

export function buildWeights(ces, answers) {
  const { shares, meta } = ces;
  const w = { ...(answers.tenure === "rent" ? shares.renter : shares.owner) };

  if (answers.kids) {
    for (const k of Object.keys(w)) {
      w[k] *= shares.couple_kids[k] / shares.all[k]; // published CES ratio
    }
  }

  w.transport_private *= answers.cars / meta.vehicles_per_cu;
  if (answers.commute === "transit") {
    w.transport_public *= TRANSIT_PUBLIC_MULT;
  } else if (answers.commute === "active" || answers.commute === "wfh") {
    w.transport_private *= NO_COMMUTE_PRIVATE_MULT;
  }
  w.food_away *= DINING_MULT[answers.dining];

  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(w)) w[k] /= sum;
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
