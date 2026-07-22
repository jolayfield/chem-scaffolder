"use strict";
// Shared chemistry core for the CHEM 111 toolkit. One implementation, run in the
// browser at runtime and via Node at build time. Reads all constants from the
// data pack (lib/chem-data.js). Deterministic; no network, no runtime AI.

// Resolve the data pack in both execution contexts: Node (require) and browser
// (the generated app loads chem-data.js first, exposing window.CHEM_DATA).
var DATA =
  (typeof module !== "undefined" && module.exports)
    ? require("./chem-data.js")
    : (typeof window !== "undefined" ? window.CHEM_DATA : null);

var R_GAS = 0.0820573; // L·atm/(mol·K)
var SIG_DEFAULT = 3;

// ---------------------------------------------------------------------------
// Significant figures
// ---------------------------------------------------------------------------
function sigFig(x, n) {
  n = n || SIG_DEFAULT;
  x = Number(x);
  if (!isFinite(x)) return "—";
  return Number(x).toPrecision(n);
}

// Count significant figures in a numeric string (respects the rules students learn).
function countSigFigs(str) {
  var s = String(str).trim().replace(/^[+-]/, "");
  var sci = s.match(/^(\d*\.?\d+)[eE][+-]?\d+$/);
  if (sci) s = sci[1];
  if (s.indexOf(".") >= 0) {
    var digits = s.replace(".", "").replace(/^0+/, "");
    return digits.length === 0 ? 1 : digits.length;
  }
  var d = s.replace(/^0+/, "").replace(/0+$/, "");
  return d.length === 0 ? 1 : d.length;
}

// Minimum sig-fig count across inputs — the count a product/quotient carries.
function minSigFigs() {
  var counts = [];
  for (var i = 0; i < arguments.length; i++) {
    var a = arguments[i];
    counts.push(typeof a === "number" ? a : countSigFigs(a));
  }
  return Math.min.apply(null, counts);
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------
// base(value) = value * factor + offset;  offset only used by temperature.
var UNITS = {
  atm: { dim: "pressure", factor: 1 },
  torr: { dim: "pressure", factor: 1 / 760 },
  mmHg: { dim: "pressure", factor: 1 / 760 },
  kPa: { dim: "pressure", factor: 1 / 101.325 },
  Pa: { dim: "pressure", factor: 1 / 101325 },
  L: { dim: "volume", factor: 1 },
  mL: { dim: "volume", factor: 0.001 },
  J: { dim: "energy", factor: 1 },
  kJ: { dim: "energy", factor: 1000 },
  cal: { dim: "energy", factor: 4.184 },
  mol: { dim: "amount", factor: 1 },
  g: { dim: "mass", factor: 1 },
  M: { dim: "concentration", factor: 1 },
  K: { dim: "temperature", factor: 1, offset: 0 },
  "°C": { dim: "temperature", factor: 1, offset: 273.15 },
  C: { dim: "temperature", factor: 1, offset: 273.15 },
};

function unitDef(u) {
  if (!(u in UNITS)) throw new Error("unknown unit: " + u);
  return UNITS[u];
}

// Convert a bare numeric value between two units of the same dimension.
function convert(value, fromUnit, toUnit) {
  var from = unitDef(fromUnit), to = unitDef(toUnit);
  if (from.dim !== to.dim) {
    throw new Error(
      "cannot convert " + fromUnit + " (" + from.dim + ") to " + toUnit + " (" + to.dim + ")"
    );
  }
  var base = Number(value) * from.factor + (from.offset || 0);
  return (base - (to.offset || 0)) / to.factor;
}

// Parse "1.0 atm" -> { value, unit, sigFigs }.
function parseQuantity(str) {
  var m = String(str).trim().match(/^([+-]?[\d.eE+-]+)\s*([^\s]+)$/);
  if (!m) throw new Error("cannot parse quantity: " + str);
  var valueStr = m[1], unit = m[2];
  if (!(unit in UNITS)) throw new Error("unknown unit: " + unit);
  return { value: Number(valueStr), unit: unit, sigFigs: countSigFigs(valueStr) };
}

// Add two {value, unit} quantities; throws if dimensions differ (R4 guard).
function addQuantities(a, b) {
  var da = unitDef(a.unit).dim, db = unitDef(b.unit).dim;
  if (da !== db) throw new Error("cannot add " + da + " to " + db);
  var bInA = convert(b.value, b.unit, a.unit);
  return { value: a.value + bInA, unit: a.unit };
}

// Solve PV = nRT for the ONE field left null/blank. Returns { name, value }.
function idealGas(v) {
  var missing = ["P", "V", "n", "T"].filter(function (k) {
    return v[k] === null || v[k] === undefined || v[k] === "";
  });
  if (missing.length !== 1) throw new Error("leave exactly one of P,V,n,T blank");
  var P = Number(v.P), V = Number(v.V), n = Number(v.n), T = Number(v.T);
  var name = missing[0], value;
  if (name === "P") value = (n * R_GAS * T) / V;
  else if (name === "V") value = (n * R_GAS * T) / P;
  else if (name === "n") value = (P * V) / (R_GAS * T);
  else value = (P * V) / (n * R_GAS);
  return { name: name, value: value };
}

// ---------------------------------------------------------------------------
// Formula & equation parsing
// ---------------------------------------------------------------------------
// Parse a formula (parentheses + subscripts) into per-element counts.
function parseFormula(formula) {
  if (!formula || !/^[A-Za-z0-9()]+$/.test(formula)) {
    throw new Error("empty or invalid formula: " + formula);
  }
  var pos = 0;
  function parse(mult, inParen) {
    var counts = {};
    function addTo(target, key, n) { target[key] = (target[key] || 0) + n; }
    while (pos < formula.length) {
      var ch = formula[pos];
      if (ch === "(") {
        pos++;
        var inner = parse(1, true);
        var num = "";
        while (pos < formula.length && /[0-9]/.test(formula[pos])) num += formula[pos++];
        var k = num ? parseInt(num, 10) : 1;
        for (var el in inner) addTo(counts, el, inner[el] * k);
      } else if (ch === ")") {
        if (!inParen) throw new Error("unmatched ) in formula: " + formula);
        pos++;
        for (var e in counts) counts[e] *= mult;
        return counts;
      } else if (/[A-Z]/.test(ch)) {
        var sym = ch; pos++;
        while (pos < formula.length && /[a-z]/.test(formula[pos])) sym += formula[pos++];
        if (!DATA || !DATA.bySymbol[sym]) throw new Error("unknown element: " + sym);
        var num2 = "";
        while (pos < formula.length && /[0-9]/.test(formula[pos])) num2 += formula[pos++];
        addTo(counts, sym, (num2 ? parseInt(num2, 10) : 1));
      } else {
        throw new Error("unexpected character: " + ch);
      }
    }
    if (inParen) throw new Error("unclosed ( in formula: " + formula);
    for (var e2 in counts) counts[e2] *= mult;
    return counts;
  }
  pos = 0;
  return parse(1, false);
}

// Molar mass (g/mol) of a formula, using the data pack.
function molarMass(formula) {
  var counts = parseFormula(formula);
  var total = 0;
  for (var sym in counts) total += DATA.bySymbol[sym].mass * counts[sym];
  return total;
}

// Net charge of a formula: a known polyatomic, or an explicit trailing charge
// (e.g. "Na+", "Ca2+", "SO4 2-"). Returns null when no charge is expressed.
function chargeOf(formula) {
  var f = String(formula).trim();
  var core = f.replace(/\s*[0-9]*[+-]$/, "");
  if (DATA && DATA.polyatomicByFormula[core]) return DATA.polyatomicByFormula[core].charge;
  var m = f.match(/([0-9]*)([+-])$/);
  if (m && m[2]) {
    var mag = m[1] ? parseInt(m[1], 10) : 1;
    return m[2] === "+" ? mag : -mag;
  }
  return null;
}

// Parse a chemical equation into per-side atom tallies and a balanced flag.
function parseEquation(eqn) {
  var parts = String(eqn).split(/->|=>|→|=/);
  if (parts.length !== 2) throw new Error("equation needs exactly one arrow: " + eqn);
  function side(str) {
    var totals = {};
    str.split("+").forEach(function (term) {
      term = term.trim();
      if (!term) return;
      var m = term.match(/^(\d+)?\s*([A-Za-z0-9()]+)$/);
      if (!m) throw new Error("cannot parse term: " + term);
      var coeff = m[1] ? parseInt(m[1], 10) : 1;
      var counts = parseFormula(m[2]);
      for (var el in counts) totals[el] = (totals[el] || 0) + counts[el] * coeff;
    });
    return totals;
  }
  var left = side(parts[0]), right = side(parts[1]);
  var elements = {};
  Object.keys(left).forEach(function (e) { elements[e] = true; });
  Object.keys(right).forEach(function (e) { elements[e] = true; });
  var balanced = Object.keys(elements).every(function (e) {
    return (left[e] || 0) === (right[e] || 0);
  });
  return { left: left, right: right, balanced: balanced };
}

// ---------------------------------------------------------------------------
// Nomenclature (ionic naming/formula, item bank, answer checking, error typing)
// ---------------------------------------------------------------------------
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }

var ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };
function roman(n) { return ROMAN[n] || String(n); }

// Is an ion's formula token polyatomic (needs parentheses when its subscript > 1)?
function isPolyatomicUnit(unit) { return !(DATA && DATA.bySymbol[unit]); }

function wrapUnit(unit, sub) {
  if (sub === 1) return unit;
  return isPolyatomicUnit(unit) ? "(" + unit + ")" + sub : unit + sub;
}

// cation/anion: { name, symbol|formula, charge, roman? }. Returns the charge-balanced formula.
function ionicFormula(cation, anion) {
  var cu = cation.formula || cation.symbol;
  var au = anion.formula || anion.symbol;
  var a = Math.abs(anion.charge), b = Math.abs(cation.charge);
  var g = gcd(a, b) || 1;
  return wrapUnit(cu, a / g) + wrapUnit(au, b / g);
}

function ionicName(cation, anion) {
  var cn = cation.name + (cation.roman ? "(" + roman(cation.charge) + ")" : "");
  return cn + " " + anion.name;
}

function normName(s) { return String(s).toLowerCase().replace(/\s+/g, " ").trim(); }
function normFormula(s) { return String(s).replace(/\s+/g, ""); }

// Compare a student answer to an item's answer. answerType is "name" or "formula".
function checkAnswer(given, item) {
  if (item.answerType === "formula") return normFormula(given) === normFormula(item.answer);
  return normName(given) === normName(item.answer);
}

// Name the kind of mistake, deterministically. Returns a short label.
function classifyError(given, item) {
  var correct = item.answer;
  if (item.answerType === "name") {
    var g = normName(given), c = normName(correct);
    var end = function (s, suf) { return s.slice(-suf.length) === suf; };
    var lastWord = function (s) { return s.split(" ").pop(); };
    var gl = lastWord(g), cl = lastWord(c);
    if ((end(cl, "ate") && end(gl, "ite")) || (end(cl, "ite") && end(gl, "ate")))
      return "-ate / -ite ending confusion";
    if (c.indexOf("(") >= 0 && g.indexOf("(") < 0) return "missing Roman numeral (metal charge)";
    if ((end(cl, "ide") && (end(gl, "ate") || end(gl, "ite"))) ||
        ((end(cl, "ate") || end(cl, "ite")) && end(gl, "ide")))
      return "wrong ending (-ide vs -ate/-ite)";
    return "not quite — review this name";
  }
  // formula answer
  try {
    var gc = parseFormula(normFormula(given)), cc = parseFormula(normFormula(correct));
    var elemsMatch = Object.keys(cc).every(function (e) { return gc[e] !== undefined; }) &&
      Object.keys(gc).every(function (e) { return cc[e] !== undefined; });
    if (elemsMatch) return "wrong subscript / charge balance";
    return "wrong element(s) in the formula";
  } catch (e) {
    return "check the formula";
  }
}

// Build the drill item bank from the data pack + a curated recall set.
function buildItemBank() {
  var items = [];
  function push(id, direction, question, answer, answerType, category) {
    items.push({ id: id, direction: direction, question: question, answer: answer, answerType: answerType, category: category });
  }
  var cations = (DATA.cations || []).slice();
  // ammonium is a polyatomic cation
  cations.push({ name: "ammonium", formula: "NH4", charge: 1 });
  var anions = (DATA.monatomicAnions || []).concat(
    (DATA.polyatomicIons || []).filter(function (ion) { return ion.charge < 0; })
  );
  // Strided sample of cation×anion so the bank stays a manageable size.
  var made = 0, cap = 40;
  for (var ci = 0; ci < cations.length && made < cap; ci++) {
    for (var k = 0; k < 2 && made < cap; k++) {
      var anion = anions[(ci * 2 + k) % anions.length];
      var c = cations[ci];
      var formula = ionicFormula(c, anion);
      var name = ionicName(c, anion);
      var slug = formula.replace(/[()]/g, "");
      push("ionic:" + slug + ":n2f", "name_to_formula", "Write the formula for: " + name, formula, "formula", "ionic");
      push("ionic:" + slug + ":f2n", "formula_to_name", "Name this compound: " + formula, name, "name", "ionic");
      made++;
    }
  }
  // Curated recall: polyatomic ion name<->formula
  (DATA.polyatomicIons || []).forEach(function (ion) {
    push("poly:" + ion.formula + ":n2f", "name_to_formula", "Formula of the " + ion.name + " ion:", ion.formula, "formula", "polyatomic-recall");
    push("poly:" + ion.formula + ":f2n", "formula_to_name", "Name this ion: " + ion.formula + " (" + (ion.charge > 0 ? "+" : "") + ion.charge + ")", ion.name, "name", "polyatomic-recall");
  });
  // Curated recall: strong acids and common molecular compounds
  var molecular = [
    ["HCl", "hydrochloric acid"], ["HNO3", "nitric acid"], ["H2SO4", "sulfuric acid"],
    ["CO2", "carbon dioxide"], ["CO", "carbon monoxide"], ["N2O", "dinitrogen monoxide"],
    ["NO2", "nitrogen dioxide"], ["SO3", "sulfur trioxide"], ["PCl5", "phosphorus pentachloride"],
  ];
  molecular.forEach(function (pair) {
    push("mol:" + pair[0] + ":n2f", "name_to_formula", "Write the formula for: " + pair[1], pair[0], "formula", "molecular");
    push("mol:" + pair[0] + ":f2n", "formula_to_name", "Name this compound: " + pair[0], pair[1], "name", "molecular");
  });
  return items;
}

// ---------------------------------------------------------------------------
// Dimensional-analysis railroad (grade the setup; reveal the number only when
// units cancel to the target)
// ---------------------------------------------------------------------------
var AVOGADRO = 6.022e23;

// start: {value, unit}. factors: ordered [{num:{value,unit}, den:{value,unit}}]
// (the caller applies any flip before passing them in). Returns running value +
// net unit-exponent map (zero-exponent units dropped).
function railroadSolve(start, factors) {
  var units = {};
  units[start.unit] = (units[start.unit] || 0) + 1;
  var value = start.value;
  (factors || []).forEach(function (f) {
    value *= f.num.value / f.den.value;
    units[f.num.unit] = (units[f.num.unit] || 0) + 1;
    units[f.den.unit] = (units[f.den.unit] || 0) - 1;
  });
  var net = {};
  for (var u in units) { if (Math.round(units[u]) !== 0) net[u] = units[u]; }
  return { value: value, units: net };
}

// True iff the chain has cancelled down to exactly one of the target unit.
function railroadResolved(net, target) {
  var keys = Object.keys(net);
  return keys.length === 1 && keys[0] === target && net[target] === 1;
}

// Render a net unit-exponent map as "a·b / c".
function unitString(net) {
  var num = [], den = [];
  for (var u in net) {
    var e = net[u];
    for (var i = 0; i < Math.abs(e); i++) (e > 0 ? num : den).push(u);
  }
  if (num.length === 0) num.push("1");
  return num.join("·") + (den.length ? " / " + den.join("·") : "");
}

function _factor(id, nv, nu, dv, du) {
  return { id: id, num: { value: nv, unit: nu }, den: { value: dv, unit: du } };
}

// Include an item when no chapter is requested, or the item is tagged with it.
function _inChapter(item, chapter) {
  return !chapter || !item.chapters || item.chapters.indexOf(chapter) >= 0;
}

// Deterministic problem bank. Each: {id, chapters, prompt, start, target, palette, answer}.
// Metric conversions -> Ch 1; mole/particle conversions -> Ch 3.
function buildRailroadProblems(chapter) {
  var mmH2O = molarMass("H2O"), mmCO2 = molarMass("CO2"), mmNaCl = molarMass("NaCl");
  var all = [
    { id: "ml2l", chapters: [1], prompt: "Convert 250 mL to liters.",
      start: { value: 250, unit: "mL" }, target: "L",
      palette: [_factor("mlL", 1, "L", 1000, "mL"), _factor("d-gmg", 1, "g", 1000, "mg")],
      answer: 250 / 1000 },
    { id: "mg2g", chapters: [1], prompt: "Convert 500 mg to grams.",
      start: { value: 500, unit: "mg" }, target: "g",
      palette: [_factor("gmg", 1, "g", 1000, "mg"), _factor("d-mlL", 1000, "mL", 1, "L")],
      answer: 500 / 1000 },
    { id: "km2m", chapters: [1], prompt: "Convert 3.2 km to meters.",
      start: { value: 3.2, unit: "km" }, target: "m",
      palette: [_factor("kmm", 1000, "m", 1, "km"), _factor("d-gmg", 1, "g", 1000, "mg")],
      answer: 3200 },
    { id: "g2mol-h2o", chapters: [3], prompt: "Convert 25.0 g of H2O to moles.",
      start: { value: 25.0, unit: "g" }, target: "mol",
      palette: [_factor("mm-h2o", mmH2O, "g", 1, "mol"), _factor("d-mlL", 1000, "mL", 1, "L")],
      answer: 25.0 / mmH2O },
    { id: "mol2g-co2", chapters: [3], prompt: "Convert 2.00 mol of CO2 to grams.",
      start: { value: 2.00, unit: "mol" }, target: "g",
      palette: [_factor("mm-co2", mmCO2, "g", 1, "mol"), _factor("d-gmg", 1, "g", 1000, "mg")],
      answer: 2.00 * mmCO2 },
    { id: "mol2part", chapters: [3], prompt: "Convert 0.50 mol to particles.",
      start: { value: 0.50, unit: "mol" }, target: "particles",
      palette: [_factor("avo", AVOGADRO, "particles", 1, "mol"), _factor("d-mlL", 1000, "mL", 1, "L")],
      answer: 0.50 * AVOGADRO },
    { id: "g2part-nacl", chapters: [3], prompt: "Convert 11.7 g of NaCl to particles (formula units).",
      start: { value: 11.7, unit: "g" }, target: "particles",
      palette: [_factor("mm-nacl", mmNaCl, "g", 1, "mol"), _factor("avo", AVOGADRO, "particles", 1, "mol"),
                _factor("d-mlL", 1000, "mL", 1, "L")],
      answer: 11.7 / mmNaCl * AVOGADRO },
  ];
  return all.filter(function (p) { return _inChapter(p, chapter); });
}

// --- infinite randomized railroad problems (clickable dimensional analysis) ---
var METRIC = {
  length: { base: "m", units: { km: 1000, m: 1, cm: 0.01, mm: 0.001 } },
  mass: { base: "g", units: { kg: 1000, g: 1, mg: 0.001 } },
  volume: { base: "L", units: { L: 1, mL: 0.001 } },
};
// A factor expressed as the integer equivalence "1 big = N small" between two
// units of one metric dimension. The student flips it to cancel.
function _metricFactor(dim, u1, u2, id) {
  var us = METRIC[dim].units, v1 = us[u1], v2 = us[u2];
  var big = v1 > v2 ? u1 : u2, small = v1 > v2 ? u2 : u1;
  var N = Math.round(Math.max(v1, v2) / Math.min(v1, v2));
  return _factor(id, 1, big, N, small);
}
function _shuffle(rng, a) {
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function _nextMetricProblem(rng) {
  var dims = Object.keys(METRIC), dim = _pick(rng, dims);
  var units = Object.keys(METRIC[dim].units);
  var S = _pick(rng, units), T = _pick(rng, units);
  while (T === S) T = _pick(rng, units);
  var base = METRIC[dim].base, vS = METRIC[dim].units[S], vT = METRIC[dim].units[T];
  var startVal = _pick(rng, [1.5, 2.0, 2.5, 3.5, 5.0, 7.5, 12, 15, 25, 40, 50, 120, 250, 500, 750]);
  var palette = [];
  var twoStep = (S !== base && T !== base && rng() < 0.5);
  if (twoStep) { palette.push(_metricFactor(dim, S, base, "f1")); palette.push(_metricFactor(dim, base, T, "f2")); }
  else { palette.push(_metricFactor(dim, S, T, "f1")); }
  var od = _pick(rng, dims.filter(function (d) { return d !== dim; }));
  var ou = Object.keys(METRIC[od].units), d1 = _pick(rng, ou), d2 = _pick(rng, ou);
  while (d2 === d1) d2 = _pick(rng, ou);
  palette.push(_metricFactor(od, d1, d2, "distractor"));
  return { id: "metric", chapters: [1], prompt: "Convert " + startVal + " " + S + " to " + T + ".",
    start: { value: startVal, unit: S }, target: T, palette: _shuffle(rng, palette), answer: startVal * vS / vT };
}
function _nextMoleProblem(rng) {
  var f = _pick(rng, ["H2O", "CO2", "NaCl", "C6H12O6", "CaCO3", "O2"]), M = molarMass(f);
  var kind = _pick(rng, ["g2mol", "mol2g", "g2part"]);
  var dstr = _factor("distractor", 1000, "mL", 1, "L");
  if (kind === "g2mol") {
    var g = _pick(rng, [12, 18, 25, 36, 44, 58, 90, 120]);
    return { id: "g2mol", chapters: [3], prompt: "Convert " + g + " g of " + f + " to moles.",
      start: { value: g, unit: "g" }, target: "mol", palette: _shuffle(rng, [_factor("mm", M, "g", 1, "mol"), dstr]), answer: g / M };
  }
  if (kind === "mol2g") {
    var mol = _pick(rng, [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]);
    return { id: "mol2g", chapters: [3], prompt: "Convert " + mol + " mol of " + f + " to grams.",
      start: { value: mol, unit: "mol" }, target: "g", palette: _shuffle(rng, [_factor("mm", M, "g", 1, "mol"), _factor("distractor", 1, "g", 1000, "mg")]), answer: mol * M };
  }
  var g2 = _pick(rng, [5, 9, 12, 18, 25]);
  return { id: "g2part", chapters: [3], prompt: "Convert " + g2 + " g of " + f + " to particles.",
    start: { value: g2, unit: "g" }, target: "particles",
    palette: _shuffle(rng, [_factor("mm", M, "g", 1, "mol"), _factor("avo", AVOGADRO, "particles", 1, "mol"), dstr]), answer: g2 / M * AVOGADRO };
}
// One fresh randomized problem for a chapter (Ch 3 -> mole conversions, else metric).
function nextRailroadProblem(chapter, seed) {
  var rng = mulberry32(seed == null ? Math.floor(Math.random() * 1e9) : (seed | 0));
  return chapter === 3 ? _nextMoleProblem(rng) : _nextMetricProblem(rng);
}

// ---------------------------------------------------------------------------
// Practice engine: seeded parametric problems, computed misconceptions, auto
// worked solutions. Scaffold fading is the widget's job.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _round(x, dp) { var m = Math.pow(10, dp); return Math.round(x * m) / m; }
function _pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Common substance densities (g/cm³, ~g/mL) for the density problems.
var DENSITIES = [["aluminum", 2.70], ["iron", 7.87], ["copper", 8.96], ["gold", 19.3],
                 ["lead", 11.3], ["silver", 10.5], ["ethanol", 0.789], ["glycerin", 1.26]];

// --- significant-figure arithmetic problem generators -------------------------
function _decimals(str) { var s = String(str), i = s.indexOf("."); return i < 0 ? 0 : s.length - i - 1; }
// A numeric string with exactly `sig` significant figures and a decimal point
// (no trailing-zero ambiguity), e.g. sig=3 -> "4.56" / "45.6" / "0.456".
function _numStr(rng, sig) {
  var lo = Math.pow(10, sig - 1), hi = Math.pow(10, sig), mant = Math.floor(rng() * (hi - lo)) + lo;
  while (mant % 10 === 0) mant += 1;
  var d = String(mant), pos = Math.floor(rng() * sig);
  return (pos === 0 ? "0" : d.slice(0, pos)) + "." + d.slice(pos);
}
// A numeric string with exactly `dp` decimal places (last digit nonzero).
function _dpStr(rng, dp) {
  var ip = Math.floor(rng() * 90) + 5, frac = "";
  for (var i = 0; i < dp - 1; i++) frac += String(Math.floor(rng() * 10));
  frac += String(Math.floor(rng() * 9) + 1);
  return ip + "." + frac;
}
function _fmt(x) { return String(parseFloat(x.toPrecision(6))); }

// ×/÷: result keeps the fewest significant figures of the operands.
function _mkMulDiv(rng, op) {
  var last = null;
  for (var t = 0; t < 40; t++) {
    var s1 = _pick(rng, [2, 3]), s2 = _pick(rng, [2, 3, 4]);
    if (s1 === s2) continue;
    var aStr = _numStr(rng, s1), bStr = _numStr(rng, s2), a = Number(aStr), b = Number(bStr);
    var exact = op === "×" ? a * b : a / b, sig = Math.min(s1, s2), answerStr = exact.toPrecision(sig);
    if (answerStr.indexOf("e") >= 0 || countSigFigs(answerStr) !== sig) continue;
    last = { sigfig: true,
      question: "Calculate and report to the correct number of significant figures:  " + aStr + " " + op + " " + bStr,
      answer: Number(answerStr), exact: exact, answerStr: answerStr, sigFigs: sig,
      rule: sig + " significant figures (the fewer of the two values)",
      steps: [aStr + " " + op + " " + bStr + " = " + _fmt(exact) + "   (full precision)",
              aStr + " has " + s1 + " sig figs; " + bStr + " has " + s2 + " — for × and ÷, keep the fewer (" + sig + ")",
              "answer = " + answerStr], distractors: [] };
    return last;
  }
  return last;
}
// +/−: result keeps the fewest decimal places of the operands.
function _mkAddSub(rng, op) {
  for (var t = 0; t < 40; t++) {
    var d1 = _pick(rng, [2, 3]), d2 = _pick(rng, [1, 2]);
    if (d1 === d2) continue;
    var aStr = _dpStr(rng, d1), bStr = _dpStr(rng, d2), a = Number(aStr), b = Number(bStr);
    if (op === "−" && a < b) { var ts = aStr; aStr = bStr; bStr = ts; }
    a = Number(aStr); b = Number(bStr);
    var exact = op === "+" ? a + b : a - b, dp = Math.min(_decimals(aStr), _decimals(bStr));
    var answerStr = exact.toFixed(dp), sig = countSigFigs(answerStr);
    return { sigfig: true,
      question: "Calculate and report to the correct number of significant figures:  " + aStr + " " + op + " " + bStr,
      answer: Number(answerStr), exact: exact, answerStr: answerStr, sigFigs: sig,
      rule: dp + " decimal place" + (dp === 1 ? "" : "s") + " (the fewer of the two values)",
      steps: [aStr + " " + op + " " + bStr + " = " + _fmt(exact) + "   (full precision)",
              aStr + " has " + _decimals(aStr) + " decimal place(s); " + bStr + " has " + _decimals(bStr) + " — for + and −, keep the fewer (" + dp + ")",
              "answer = " + answerStr], distractors: [] };
  }
  return null;
}
// Multi-step: (a + b) then × or ÷ c. Round each step per its rule.
function _mkMultistep(rng) {
  var last = null;
  for (var t = 0; t < 50; t++) {
    var d1 = _pick(rng, [2, 3]), d2 = _pick(rng, [1, 2]);
    if (d1 === d2) continue;
    var aStr = _dpStr(rng, d1), bStr = _dpStr(rng, d2), a = Number(aStr), b = Number(bStr);
    var sumExact = a + b, sumDp = Math.min(_decimals(aStr), _decimals(bStr));
    var sumStr = sumExact.toFixed(sumDp), sumRounded = Number(sumStr), sumSig = countSigFigs(sumStr);
    var cSig = _pick(rng, [2, 3]), cStr = _numStr(rng, cSig), c = Number(cStr), op = _pick(rng, ["×", "÷"]);
    var fExact = op === "×" ? sumRounded * c : sumRounded / c, sig = Math.min(sumSig, cSig), answerStr = fExact.toPrecision(sig);
    if (answerStr.indexOf("e") >= 0 || countSigFigs(answerStr) !== sig) continue;
    last = { sigfig: true,
      question: "Calculate and report to the correct number of significant figures:  (" + aStr + " + " + bStr + ") " + op + " " + cStr,
      answer: Number(answerStr), exact: fExact, answerStr: answerStr, sigFigs: sig,
      rule: sig + " significant figures",
      steps: ["Step 1 — add: " + aStr + " + " + bStr + " = " + _fmt(sumExact) + " → round to " + sumDp + " dp = " + sumStr + "  (" + sumSig + " sig figs)",
              "Step 2 — " + (op === "×" ? "multiply" : "divide") + ": " + sumStr + " " + op + " " + cStr + ", keep min(" + sumSig + ", " + cSig + ") = " + sig + " sig figs",
              "= " + _fmt(fExact) + " → " + answerStr], distractors: [] };
    return last;
  }
  return last;
}

// Each template: {id, chapters, topic, build(rng)->instance}. `chapters` scopes
// which chapter pages serve it — so no page shows problems from material it hasn't reached.
var PRACTICE_TEMPLATES = [
  // Ch 1 — measurement
  { id: "density", chapters: [1, 12], topic: "measurement", build: function (rng) {
      var m = _round(rng() * 90 + 10, 1), V = _round(rng() * 40 + 5, 1), answer = m / V;
      return { question: "A sample has a mass of " + m + " g and a volume of " + V + " mL. What is its density (g/mL)?",
        answer: answer, unit: "g/mL", sigFigs: 3,
        steps: ["density = mass ÷ volume", "= " + m + " ÷ " + V, "= " + sigFig(answer, 3) + " g/mL"],
        distractors: [{ value: V / m, label: "divided volume by mass (inverted the ratio)" }] };
    } },
  { id: "density-mass", chapters: [1, 12], topic: "measurement", build: function (rng) {
      var sub = _pick(rng, DENSITIES), rho = sub[1], V = _pick(rng, [5, 8, 10, 12, 15, 20, 25, 30, 40, 50]);
      var answer = rho * V;
      return { question: "A sample of " + sub[0] + " (density " + rho + " g/cm³) has a volume of " + V + " cm³. What is its mass (g)?",
        answer: answer, unit: "g", sigFigs: 3,
        steps: ["mass = density × volume", "= " + rho + " × " + V, "= " + sigFig(answer, 3) + " g"],
        distractors: [{ value: V / rho, label: "divided volume by density instead of multiplying" }] };
    } },
  { id: "density-volume", chapters: [1, 12], topic: "measurement", build: function (rng) {
      var sub = _pick(rng, DENSITIES), rho = sub[1], m = _pick(rng, [10, 20, 25, 40, 50, 75, 100, 150, 200]);
      var answer = m / rho;
      return { question: "A sample of " + sub[0] + " (density " + rho + " g/cm³) has a mass of " + m + " g. What is its volume (cm³)?",
        answer: answer, unit: "cm³", sigFigs: 3,
        steps: ["volume = mass ÷ density", "= " + m + " ÷ " + rho, "= " + sigFig(answer, 3) + " cm³"],
        distractors: [{ value: m * rho, label: "multiplied mass by density instead of dividing" }] };
    } },
  { id: "temperature", chapters: [1], topic: "measurement", build: function (rng) {
      var c = Math.round(rng() * 120 - 20), answer = c + 273.15;
      return { question: "Convert " + c + " °C to kelvin.", answer: answer, unit: "K", sigFigs: 4,
        steps: ["K = °C + 273.15", "= " + c + " + 273.15", "= " + sigFig(answer, 4) + " K"],
        distractors: [{ value: c - 273.15, label: "subtracted 273.15 instead of adding" }] };
    } },
  // Ch 1 — significant-figure arithmetic (graded on both value AND sig figs)
  { id: "sigfig-multiply", chapters: [1], topic: "sig-figs", build: function (rng) { return _mkMulDiv(rng, "×"); } },
  { id: "sigfig-divide", chapters: [1], topic: "sig-figs", build: function (rng) { return _mkMulDiv(rng, "÷"); } },
  { id: "sigfig-add", chapters: [1], topic: "sig-figs", build: function (rng) { return _mkAddSub(rng, "+"); } },
  { id: "sigfig-subtract", chapters: [1], topic: "sig-figs", build: function (rng) { return _mkAddSub(rng, "−"); } },
  { id: "sigfig-multistep", chapters: [1], topic: "sig-figs", build: function (rng) { return _mkMultistep(rng); } },
  // Ch 2 — average atomic mass
  { id: "avg-atomic-mass", chapters: [2], topic: "atoms", build: function (rng) {
      var m1 = _round(rng() * 8 + 10, 3), m2 = _round(m1 + rng() * 3 + 1, 3);
      var a1 = Math.round(rng() * 60 + 20), a2 = 100 - a1;
      var answer = m1 * a1 / 100 + m2 * a2 / 100;
      return { question: "An element has two isotopes: " + m1 + " u (" + a1 + "%) and " + m2 + " u (" + a2 + "%). What is its average atomic mass (u)?",
        answer: answer, unit: "u", sigFigs: 4,
        steps: ["average = Σ (isotope mass × fractional abundance)",
                "= " + m1 + "×" + (a1 / 100) + " + " + m2 + "×" + (a2 / 100), "= " + sigFig(answer, 4) + " u"],
        distractors: [{ value: (m1 + m2) / 2, label: "took a simple average instead of weighting by abundance" }] };
    } },
  // Ch 3 — stoichiometry
  { id: "g-to-mol", chapters: [3], topic: "stoichiometry", build: function (rng) {
      var f = _pick(rng, ["H2O", "CO2", "NaCl", "C6H12O6", "CaCO3"]);
      var M = molarMass(f), grams = _round(rng() * 90 + 10, 1), answer = grams / M;
      return { question: "How many moles are in " + grams + " g of " + f + "?", answer: answer, unit: "mol", sigFigs: 3,
        steps: ["Molar mass of " + f + " = " + sigFig(M, 5) + " g/mol",
                "moles = grams ÷ molar mass = " + grams + " ÷ " + sigFig(M, 5), "= " + sigFig(answer, 3) + " mol"],
        distractors: [{ value: grams * M, label: "multiplied by the molar mass instead of dividing" }] };
    } },
  { id: "mol-to-g", chapters: [3], topic: "stoichiometry", build: function (rng) {
      var f = _pick(rng, ["H2O", "CO2", "NaCl", "C6H12O6"]);
      var M = molarMass(f), mol = _round(rng() * 4 + 0.5, 2), answer = mol * M;
      return { question: "What is the mass (g) of " + mol + " mol of " + f + "?", answer: answer, unit: "g", sigFigs: 3,
        steps: ["Molar mass of " + f + " = " + sigFig(M, 5) + " g/mol",
                "mass = moles × molar mass = " + mol + " × " + sigFig(M, 5), "= " + sigFig(answer, 3) + " g"],
        distractors: [{ value: mol / M, label: "divided by the molar mass instead of multiplying" }] };
    } },
  { id: "percent-yield", chapters: [3], topic: "stoichiometry", build: function (rng) {
      var theo = _round(rng() * 40 + 20, 1), act = _round(theo * (rng() * 0.4 + 0.5), 1), answer = 100 * act / theo;
      return { question: "A reaction has a theoretical yield of " + theo + " g and an actual yield of " + act + " g. What is the percent yield (%)?",
        answer: answer, unit: "%", sigFigs: 3,
        steps: ["% yield = (actual ÷ theoretical) × 100", "= (" + act + " ÷ " + theo + ") × 100", "= " + sigFig(answer, 3) + " %"],
        distractors: [{ value: 100 * theo / act, label: "divided theoretical by actual (flipped the ratio)" }] };
    } },
  // Ch 4 — solutions
  { id: "molarity", chapters: [4], topic: "solutions", build: function (rng) {
      var mol = _round(rng() * 2 + 0.2, 2), L = _round(rng() * 1.5 + 0.25, 2), answer = mol / L;
      return { question: "What is the molarity of " + mol + " mol of solute in " + L + " L of solution?", answer: answer, unit: "M", sigFigs: 3,
        steps: ["Molarity = moles solute ÷ liters solution", "= " + mol + " ÷ " + L, "= " + sigFig(answer, 3) + " M"],
        distractors: [{ value: L / mol, label: "divided liters by moles (inverted the ratio)" }] };
    } },
  { id: "dilution", chapters: [4], topic: "solutions", build: function (rng) {
      var M1 = _round(rng() * 5 + 1, 1), V1 = Math.round(rng() * 90 + 10), M2 = _round(rng() * (M1 - 0.6) + 0.2, 1);
      var answer = M1 * V1 / M2;
      return { question: "To what final volume (mL) must " + V1 + " mL of " + M1 + " M solution be diluted to make it " + M2 + " M?", answer: answer, unit: "mL", sigFigs: 3,
        steps: ["M₁V₁ = M₂V₂", "V₂ = M₁·V₁ ÷ M₂ = " + M1 + "·" + V1 + " ÷ " + M2, "= " + sigFig(answer, 3) + " mL"],
        distractors: [{ value: M2 * V1 / M1, label: "solved M₂V₁ ÷ M₁ (inverted the concentrations)" }] };
    } },
  // Ch 5 — gases
  { id: "gas-volume", chapters: [5], topic: "gases", build: function (rng) {
      var n = _round(rng() * 2 + 0.5, 2), T = Math.round(rng() * 200 + 250), P = _round(rng() * 1.5 + 0.5, 1);
      var answer = n * R_GAS * T / P;
      return { question: "What volume (L) does " + n + " mol of gas occupy at " + P + " atm and " + T + " K?", answer: answer, unit: "L", sigFigs: 3,
        steps: ["V = nRT ÷ P   (R = " + R_GAS + ")", "= " + n + "·" + R_GAS + "·" + T + " ÷ " + P, "= " + sigFig(answer, 3) + " L"],
        distractors: [{ value: n * R_GAS * T * P, label: "multiplied by P instead of dividing" }] };
    } },
  { id: "gas-density", chapters: [5], topic: "gases", build: function (rng) {
      var f = _pick(rng, ["CO2", "O2", "N2O", "NH3"]), M = molarMass(f);
      var P = _round(rng() * 1.0 + 0.8, 2), T = Math.round(rng() * 120 + 273), answer = P * M / (R_GAS * T);
      return { question: "What is the density (g/L) of " + f + " gas at " + P + " atm and " + T + " K?", answer: answer, unit: "g/L", sigFigs: 3,
        steps: ["density = PM ÷ RT   (M of " + f + " = " + sigFig(M, 4) + ")",
                "= (" + P + "×" + sigFig(M, 4) + ") ÷ (" + R_GAS + "×" + T + ")", "= " + sigFig(answer, 3) + " g/L"],
        distractors: [{ value: P * M, label: "forgot to divide by RT" }] };
    } },
  { id: "partial-pressure", chapters: [5], topic: "gases", build: function (rng) {
      var a = _round(rng() * 0.8 + 0.2, 2), b = _round(rng() * 0.8 + 0.2, 2), c = _round(rng() * 0.8 + 0.2, 2);
      var answer = a + b + c;
      return { question: "A gas mixture contains three gases at partial pressures " + a + ", " + b + ", and " + c + " atm. What is the total pressure (atm)?",
        answer: answer, unit: "atm", sigFigs: 3,
        steps: ["Dalton's law: P_total = ΣP_i", "= " + a + " + " + b + " + " + c, "= " + sigFig(answer, 3) + " atm"],
        distractors: [{ value: answer / 3, label: "averaged the pressures instead of adding them" }] };
    } },
  // Ch 6 — thermochemistry
  { id: "specific-heat", chapters: [6], topic: "thermochemistry", build: function (rng) {
      var m = _round(rng() * 150 + 25, 0), dT = _round(rng() * 40 + 10, 1), c = 4.184, answer = m * c * dT;
      return { question: "How much heat (J) is needed to raise the temperature of " + m + " g of water by " + dT + " °C? (c = 4.184 J/g·°C)",
        answer: answer, unit: "J", sigFigs: 3,
        steps: ["q = m·c·ΔT", "= " + m + " × 4.184 × " + dT, "= " + sigFig(answer, 3) + " J"],
        distractors: [{ value: m * dT, label: "left out the specific heat (c)" }] };
    } },
  { id: "calorimetry-metal", chapters: [6], topic: "thermochemistry", build: function (rng) {
      var opt = _pick(rng, [["aluminum", 0.897], ["iron", 0.449], ["copper", 0.385]]);
      var m = _round(rng() * 80 + 20, 0), dT = _round(rng() * 50 + 20, 1), answer = m * opt[1] * dT;
      return { question: "How much heat (J) is released when " + m + " g of " + opt[0] + " cools by " + dT + " °C? (c = " + opt[1] + " J/g·°C)",
        answer: answer, unit: "J", sigFigs: 3,
        steps: ["q = m·c·ΔT", "= " + m + " × " + opt[1] + " × " + dT, "= " + sigFig(answer, 3) + " J"],
        distractors: [{ value: m * dT, label: "left out the specific heat (c)" }] };
    } },
  // Ch 7 — quantum
  { id: "photon-energy", chapters: [7], topic: "quantum", build: function (rng) {
      var nu = _round(rng() * 8 + 2, 2) * 1e14, h = 6.626e-34, answer = h * nu;
      return { question: "What is the energy (J) of a photon with a frequency of " + nu.toExponential(2) + " s⁻¹? (h = 6.626×10⁻³⁴ J·s)",
        answer: answer, unit: "J", sigFigs: 3,
        steps: ["E = hν", "= (6.626×10⁻³⁴)(" + nu.toExponential(2) + ")", "= " + answer.toExponential(2) + " J"],
        distractors: [{ value: h / nu, label: "divided by the frequency instead of multiplying" }] };
    } },
  { id: "wavelength-frequency", chapters: [7], topic: "quantum", build: function (rng) {
      var lam = Math.round(rng() * 400 + 300), c = 3.00e8, answer = c / (lam * 1e-9);
      return { question: "What is the frequency (Hz) of light with a wavelength of " + lam + " nm? (c = 3.00×10⁸ m/s)",
        answer: answer, unit: "Hz", sigFigs: 3,
        steps: ["ν = c ÷ λ", "= (3.00×10⁸) ÷ (" + lam + "×10⁻⁹ m)", "= " + answer.toExponential(2) + " Hz"],
        distractors: [{ value: c * lam * 1e-9, label: "multiplied c by λ instead of dividing" }] };
    } },
  // Ch 11 — solutions/colligative
  { id: "molality", chapters: [11], topic: "colligative", build: function (rng) {
      var mol = _round(rng() * 2 + 0.3, 2), kg = _round(rng() * 1.5 + 0.25, 2), answer = mol / kg;
      return { question: "What is the molality of a solution with " + mol + " mol of solute in " + kg + " kg of solvent?", answer: answer, unit: "m", sigFigs: 3,
        steps: ["molality = moles solute ÷ kg solvent", "= " + mol + " ÷ " + kg, "= " + sigFig(answer, 3) + " m"],
        distractors: [{ value: kg / mol, label: "divided kg by moles (inverted the ratio)" }] };
    } },
  { id: "freezing-point", chapters: [11], topic: "colligative", build: function (rng) {
      var mol = _round(rng() * 1.5 + 0.3, 2), kg = _round(rng() * 1.2 + 0.3, 2), Kf = 1.86, answer = Kf * (mol / kg);
      return { question: "By how many °C does the freezing point drop for " + mol + " mol of a nonelectrolyte in " + kg + " kg of water? (Kf = 1.86 °C/m)",
        answer: answer, unit: "°C", sigFigs: 3,
        steps: ["ΔTf = Kf · m", "= 1.86 × (" + mol + " ÷ " + kg + ")", "= " + sigFig(answer, 3) + " °C"],
        distractors: [{ value: Kf * mol * kg, label: "multiplied by kg instead of dividing (used mol·kg)" }] };
    } },
];

function buildPractice(opts) {
  opts = opts || {};
  var seed = (opts.seed == null) ? Math.floor(Math.random() * 1e9) : (opts.seed | 0);
  var rng = mulberry32(seed);
  var pool = PRACTICE_TEMPLATES.filter(function (t) { return _inChapter(t, opts.chapter); });
  if (opts.topic && opts.topic !== "mixed") {
    var f = pool.filter(function (t) { return t.topic === opts.topic; });
    if (f.length) pool = f;
  }
  if (!pool.length) pool = PRACTICE_TEMPLATES;
  var tmpl = pool[Math.floor(rng() * pool.length)];
  var inst = tmpl.build(rng);
  inst.id = tmpl.id; inst.topic = tmpl.topic; inst.chapters = tmpl.chapters; inst.seed = seed;
  return inst;
}

function gradePractice(given, inst) {
  var g = String(given).trim(), x = Number(g);
  if (g === "" || !isFinite(x)) return { correct: false, message: "Enter a number." };
  if (inst.sigfig) return _gradeSigFig(g, inst);
  var tol = function (v) { return Math.max(Math.abs(v) * 0.015, 1e-30); };
  if (Math.abs(x - inst.answer) <= tol(inst.answer)) return { correct: true, message: "Correct ✓" };
  for (var i = 0; i < inst.distractors.length; i++) {
    var d = inst.distractors[i];
    if (Math.abs(x - d.value) <= tol(d.value))
      return { correct: false, misconception: d.label, message: "Not quite — it looks like you " + d.label + "." };
  }
  return { correct: false, message: "Not quite. The answer is " + sigFig(inst.answer, inst.sigFigs) + " " + inst.unit + "." };
}

// Sig-fig arithmetic: the reported value AND the number of sig figs must both be right.
function _gradeSigFig(g, inst) {
  var gv = Number(g), gSig = countSigFigs(g);
  var valueOk = Math.abs(gv - inst.answer) <= Math.max(Math.abs(inst.answer) * 1e-9, 1e-9);
  if (valueOk && gSig === inst.sigFigs) return { correct: true, message: "Correct ✓" };
  if (!valueOk) {
    if (Math.abs(gv - inst.exact) <= Math.max(Math.abs(inst.exact) * 1e-4, 1e-6))
      return { correct: false, misconception: "reported the unrounded value",
        message: "That's the full-precision value — round it to " + inst.rule + "   (" + inst.answerStr + ")." };
    return { correct: false, message: "Not quite. The answer is " + inst.answerStr + "   (" + inst.rule + ")." };
  }
  return { correct: false, misconception: "wrong number of significant figures",
    message: "Right value, but the significant figures are off — the answer is " + inst.answerStr + "   (" + inst.rule + ")." };
}

// Distinct practice topics available for a chapter (or all).
function practiceTopics(chapter) {
  var seen = {}, out = [];
  PRACTICE_TEMPLATES.forEach(function (t) {
    if (_inChapter(t, chapter) && !seen[t.topic]) { seen[t.topic] = 1; out.push(t.topic); }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Lewis-structure bookkeeping (#5): valence electrons, formal charge, octet
// ---------------------------------------------------------------------------
var VALENCE = {
  H: 1, He: 2, Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8,
  Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 8, K: 1, Ca: 2,
  As: 5, Se: 6, Br: 7, I: 7,
};
function valenceElectrons(sym) { return VALENCE[sym] != null ? VALENCE[sym] : null; }

// Formal charge = valence − nonbonding electrons − bonds.
function formalCharge(sym, bonds, lonePairs) {
  return valenceElectrons(sym) - 2 * lonePairs - bonds;
}

// "ok" | "deficient" | "expanded-ok" | "over" | "expanded".
function octetStatus(sym, bonds, lonePairs) {
  var e = 2 * bonds + 2 * lonePairs;
  if (sym === "H" || sym === "He") return e === 2 ? "ok" : (e < 2 ? "deficient" : "over");
  if (sym === "Be") return e <= 4 ? (e === 4 ? "ok" : "deficient") : "over";
  if (sym === "B" || sym === "Al") return e < 6 ? "deficient" : (e <= 8 ? "ok" : "over");
  var period3plus = { P: 1, S: 1, Cl: 1, Br: 1, I: 1, Se: 1, As: 1, Si: 1 };
  if (e === 8) return "ok";
  if (e < 8) return "deficient";
  return period3plus[sym] ? "expanded-ok" : "over";
}

// Curated neutral molecules with per-atom valence and the correct totals.
function buildLewisMolecules() {
  var mols = [["water", "H2O"], ["carbon dioxide", "CO2"], ["ammonia", "NH3"],
              ["methane", "CH4"], ["oxygen", "O2"], ["hydrogen cyanide", "HCN"],
              ["carbon monoxide", "CO"], ["sulfur dioxide", "SO2"]];
  return mols.map(function (m) {
    var counts = parseFormula(m[1]), atoms = [];
    for (var sym in counts) for (var i = 0; i < counts[sym]; i++) atoms.push({ symbol: sym, valence: valenceElectrons(sym) });
    var total = atoms.reduce(function (a, x) { return a + x.valence; }, 0);
    return { id: "lewis:" + m[1], name: m[0], formula: m[1], atoms: atoms, targetCharge: 0, totalValence: total };
  });
}

// ---------------------------------------------------------------------------
// Qualitative rank-and-justify trainer (#6): rankings from data + a reason
// ---------------------------------------------------------------------------
// Items tagged with `chapters`: periodic trends -> Ch 7 (also Ch 8 for
// electronegativity/bond polarity), molecular polarity -> Ch 9, IMF/boiling -> Ch 10.
function buildReasoningItems(chapter) {
  function rad(s) { return DATA.bySymbol[s].atomicRadius; }
  function en(s) { return DATA.bySymbol[s].electronegativity; }
  function byDesc(syms, val) { return syms.slice().sort(function (a, b) { return val(b) - val(a); }); }
  var items = [];
  function radiusItem(syms, reasons) {
    return { id: "rad:" + syms.join(""), chapters: [7], prompt: "Rank by atomic radius, largest first: " + syms.join(", "),
      items: syms, correctOrder: byDesc(syms, rad), reasons: reasons, correctReason: 0 };
  }
  function enItem(syms, reasons) {
    return { id: "en:" + syms.join(""), chapters: [7, 8], prompt: "Rank by electronegativity, highest first: " + syms.join(", "),
      items: syms, correctOrder: byDesc(syms, en), reasons: reasons, correctReason: 0 };
  }
  var acrossRadius = ["Atomic radius decreases across a period as effective nuclear charge increases.",
                      "Atomic radius increases across a period as electrons are added.",
                      "A larger atomic mass always means a larger radius."];
  items.push(radiusItem(["Na", "Mg", "Cl"], acrossRadius));
  items.push(radiusItem(["Li", "B", "F"], acrossRadius));
  items.push({ id: "radgrp", chapters: [7], prompt: "Rank by atomic radius, largest first: Li, Na, K",
    items: ["Li", "Na", "K"], correctOrder: byDesc(["Li", "Na", "K"], rad),
    reasons: ["Atomic radius increases down a group as electrons fill higher energy levels.",
              "Atomic radius decreases down a group.",
              "All alkali metals have the same radius."], correctReason: 0 });
  var acrossEN = ["Electronegativity increases across a period.",
                  "Electronegativity decreases across a period.",
                  "Metals are the most electronegative elements."];
  items.push(enItem(["Na", "Si", "Cl"], acrossEN));
  items.push(enItem(["B", "N", "F"], acrossEN));
  items.push({ id: "bondpol", chapters: [8], prompt: "Rank these bonds by polarity, most polar first: H–F, H–Cl, H–I",
    items: ["H–F", "H–Cl", "H–I"], correctOrder: ["H–F", "H–Cl", "H–I"],
    reasons: ["Bond polarity grows with the electronegativity difference; F > Cl > I.",
              "The heaviest atom makes the most polar bond, so H–I is most polar.",
              "All H–halogen bonds are equally polar."], correctReason: 0 });
  items.push({ id: "molpol", chapters: [9], prompt: "Rank by molecular polarity, most polar first: H2O, NH3, CO2",
    items: ["H2O", "NH3", "CO2"], correctOrder: ["H2O", "NH3", "CO2"],
    reasons: ["Shape decides: bent H2O and pyramidal NH3 are polar; linear CO2's dipoles cancel.",
              "More atoms means more polar, so CO2 is most polar.",
              "All molecules with polar bonds are polar molecules."], correctReason: 0 });
  items.push({ id: "bp-water", chapters: [10], prompt: "Rank by boiling point, highest first: H2O, H2S, CH4",
    items: ["H2O", "H2S", "CH4"], correctOrder: ["H2O", "H2S", "CH4"],
    reasons: ["Water is highest (hydrogen bonding); H2S beats CH4 (dipole-dipole + heavier).",
              "Molar mass alone decides, so H2S is highest.",
              "All three boil at about the same temperature."], correctReason: 0 });
  items.push({ id: "imf", chapters: [10], prompt: "Rank these forces strongest first: hydrogen bonding, dipole-dipole, dispersion",
    items: ["hydrogen bonding", "dipole-dipole", "dispersion"],
    correctOrder: ["hydrogen bonding", "dipole-dipole", "dispersion"],
    reasons: ["Hydrogen bonding is strongest here; dispersion the weakest.",
              "Dispersion forces are always the strongest.",
              "All intermolecular forces are equal in strength."], correctReason: 0 });
  return items.filter(function (it) { return _inChapter(it, chapter); });
}

function gradeReasoning(order, reasonIdx, item) {
  var orderCorrect = order.length === item.correctOrder.length &&
    order.every(function (x, i) { return x === item.correctOrder[i]; });
  return { orderCorrect: orderCorrect, reasonCorrect: reasonIdx === item.correctReason };
}

// ---------------------------------------------------------------------------
var CHEM_CORE = {
  R_GAS: R_GAS,
  AVOGADRO: AVOGADRO,
  sigFig: sigFig,
  countSigFigs: countSigFigs,
  minSigFigs: minSigFigs,
  convert: convert,
  parseQuantity: parseQuantity,
  addQuantities: addQuantities,
  idealGas: idealGas,
  parseFormula: parseFormula,
  molarMass: molarMass,
  chargeOf: chargeOf,
  parseEquation: parseEquation,
  ionicFormula: ionicFormula,
  ionicName: ionicName,
  checkAnswer: checkAnswer,
  classifyError: classifyError,
  buildItemBank: buildItemBank,
  railroadSolve: railroadSolve,
  railroadResolved: railroadResolved,
  unitString: unitString,
  buildRailroadProblems: buildRailroadProblems,
  nextRailroadProblem: nextRailroadProblem,
  buildPractice: buildPractice,
  gradePractice: gradePractice,
  practiceTopics: practiceTopics,
  valenceElectrons: valenceElectrons,
  formalCharge: formalCharge,
  octetStatus: octetStatus,
  buildLewisMolecules: buildLewisMolecules,
  buildReasoningItems: buildReasoningItems,
  gradeReasoning: gradeReasoning,
};

if (typeof module !== "undefined" && module.exports) module.exports = CHEM_CORE;
if (typeof window !== "undefined") window.CHEM_CORE = CHEM_CORE;
