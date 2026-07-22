"use strict";
// Canonical chemistry data pack for the CHEM 111 toolkit — the single source of
// truth every widget reads from. Ships as a JS module (not fetched JSON) so it
// works from file://, GitHub Pages, and inside a Canvas iframe. Sources and
// citations: data/SOURCES.md. Bump `version` whenever a value changes.

var CHEM_DATA = {
  version: "1.0.0",

  // [Z, symbol, name, atomicMass (u, IUPAC 2021), electronegativity (Pauling|null),
  //  electronConfiguration, atomicRadius (pm|null)]
  elements: [
    [1, "H", "Hydrogen", 1.008, 2.20, "1s1", 53],
    [2, "He", "Helium", 4.0026, null, "1s2", 31],
    [3, "Li", "Lithium", 6.94, 0.98, "[He]2s1", 167],
    [4, "Be", "Beryllium", 9.0122, 1.57, "[He]2s2", 112],
    [5, "B", "Boron", 10.81, 2.04, "[He]2s2 2p1", 87],
    [6, "C", "Carbon", 12.011, 2.55, "[He]2s2 2p2", 67],
    [7, "N", "Nitrogen", 14.007, 3.04, "[He]2s2 2p3", 56],
    [8, "O", "Oxygen", 15.999, 3.44, "[He]2s2 2p4", 48],
    [9, "F", "Fluorine", 18.998, 3.98, "[He]2s2 2p5", 42],
    [10, "Ne", "Neon", 20.180, null, "[He]2s2 2p6", 38],
    [11, "Na", "Sodium", 22.990, 0.93, "[Ne]3s1", 190],
    [12, "Mg", "Magnesium", 24.305, 1.31, "[Ne]3s2", 145],
    [13, "Al", "Aluminium", 26.982, 1.61, "[Ne]3s2 3p1", 118],
    [14, "Si", "Silicon", 28.085, 1.90, "[Ne]3s2 3p2", 111],
    [15, "P", "Phosphorus", 30.974, 2.19, "[Ne]3s2 3p3", 98],
    [16, "S", "Sulfur", 32.06, 2.58, "[Ne]3s2 3p4", 88],
    [17, "Cl", "Chlorine", 35.45, 3.16, "[Ne]3s2 3p5", 79],
    [18, "Ar", "Argon", 39.948, null, "[Ne]3s2 3p6", 71],
    [19, "K", "Potassium", 39.098, 0.82, "[Ar]4s1", 243],
    [20, "Ca", "Calcium", 40.078, 1.00, "[Ar]4s2", 194],
    [21, "Sc", "Scandium", 44.956, 1.36, "[Ar]3d1 4s2", 184],
    [22, "Ti", "Titanium", 47.867, 1.54, "[Ar]3d2 4s2", 176],
    [23, "V", "Vanadium", 50.942, 1.63, "[Ar]3d3 4s2", 171],
    [24, "Cr", "Chromium", 51.996, 1.66, "[Ar]3d5 4s1", 166],
    [25, "Mn", "Manganese", 54.938, 1.55, "[Ar]3d5 4s2", 161],
    [26, "Fe", "Iron", 55.845, 1.83, "[Ar]3d6 4s2", 156],
    [27, "Co", "Cobalt", 58.933, 1.88, "[Ar]3d7 4s2", 152],
    [28, "Ni", "Nickel", 58.693, 1.91, "[Ar]3d8 4s2", 149],
    [29, "Cu", "Copper", 63.546, 1.90, "[Ar]3d10 4s1", 145],
    [30, "Zn", "Zinc", 65.38, 1.65, "[Ar]3d10 4s2", 142],
    [31, "Ga", "Gallium", 69.723, 1.81, "[Ar]3d10 4s2 4p1", 136],
    [32, "Ge", "Germanium", 72.630, 2.01, "[Ar]3d10 4s2 4p2", 125],
    [33, "As", "Arsenic", 74.922, 2.18, "[Ar]3d10 4s2 4p3", 114],
    [34, "Se", "Selenium", 78.971, 2.55, "[Ar]3d10 4s2 4p4", 103],
    [35, "Br", "Bromine", 79.904, 2.96, "[Ar]3d10 4s2 4p5", 94],
    [36, "Kr", "Krypton", 83.798, 3.00, "[Ar]3d10 4s2 4p6", 88],
    [47, "Ag", "Silver", 107.87, 1.93, "[Kr]4d10 5s1", 165],
    [53, "I", "Iodine", 126.90, 2.66, "[Kr]4d10 5s2 5p5", 115],
    [56, "Ba", "Barium", 137.33, 0.89, "[Xe]6s2", 253],
    [78, "Pt", "Platinum", 195.08, 2.28, "[Xe]4f14 5d9 6s1", 177],
    [79, "Au", "Gold", 196.97, 2.54, "[Xe]4f14 5d10 6s1", 174],
    [80, "Hg", "Mercury", 200.59, 2.00, "[Xe]4f14 5d10 6s2", 171],
    [82, "Pb", "Lead", 207.2, 2.33, "[Xe]4f14 5d10 6s2 6p2", 154],
  ],

  // {name, formula, charge}
  polyatomicIons: [
    { name: "ammonium", formula: "NH4", charge: 1 },
    { name: "hydronium", formula: "H3O", charge: 1 },
    { name: "hydroxide", formula: "OH", charge: -1 },
    { name: "nitrate", formula: "NO3", charge: -1 },
    { name: "nitrite", formula: "NO2", charge: -1 },
    { name: "acetate", formula: "C2H3O2", charge: -1 },
    { name: "cyanide", formula: "CN", charge: -1 },
    { name: "permanganate", formula: "MnO4", charge: -1 },
    { name: "hydrogen carbonate", formula: "HCO3", charge: -1 },
    { name: "chlorate", formula: "ClO3", charge: -1 },
    { name: "perchlorate", formula: "ClO4", charge: -1 },
    { name: "carbonate", formula: "CO3", charge: -2 },
    { name: "sulfate", formula: "SO4", charge: -2 },
    { name: "sulfite", formula: "SO3", charge: -2 },
    { name: "chromate", formula: "CrO4", charge: -2 },
    { name: "dichromate", formula: "Cr2O7", charge: -2 },
    { name: "phosphate", formula: "PO4", charge: -3 },
    { name: "peroxide", formula: "O2", charge: -2 },
  ],

  // Curated cations for nomenclature. `roman: true` marks variable-charge metals
  // whose name carries a Roman numeral (the stated charge). NH4+ is a polyatomic
  // cation and lives in polyatomicIons.
  cations: [
    { name: "lithium", symbol: "Li", charge: 1 },
    { name: "sodium", symbol: "Na", charge: 1 },
    { name: "potassium", symbol: "K", charge: 1 },
    { name: "silver", symbol: "Ag", charge: 1 },
    { name: "magnesium", symbol: "Mg", charge: 2 },
    { name: "calcium", symbol: "Ca", charge: 2 },
    { name: "barium", symbol: "Ba", charge: 2 },
    { name: "zinc", symbol: "Zn", charge: 2 },
    { name: "aluminum", symbol: "Al", charge: 3 },
    { name: "iron", symbol: "Fe", charge: 2, roman: true },
    { name: "iron", symbol: "Fe", charge: 3, roman: true },
    { name: "copper", symbol: "Cu", charge: 1, roman: true },
    { name: "copper", symbol: "Cu", charge: 2, roman: true },
    { name: "lead", symbol: "Pb", charge: 2, roman: true },
    { name: "mercury", symbol: "Hg", charge: 2, roman: true },
  ],

  // Monatomic anions: element root + "-ide".
  monatomicAnions: [
    { name: "fluoride", symbol: "F", charge: -1 },
    { name: "chloride", symbol: "Cl", charge: -1 },
    { name: "bromide", symbol: "Br", charge: -1 },
    { name: "iodide", symbol: "I", charge: -1 },
    { name: "oxide", symbol: "O", charge: -2 },
    { name: "sulfide", symbol: "S", charge: -2 },
    { name: "nitride", symbol: "N", charge: -3 },
    { name: "phosphide", symbol: "P", charge: -3 },
  ],

  // Simplified general-chemistry solubility rules for aqueous ionic compounds.
  solubilityRules: [
    { ions: ["Li", "Na", "K", "NH4"], soluble: true, exceptions: [] },
    { ions: ["NO3", "C2H3O2", "ClO3", "ClO4"], soluble: true, exceptions: [] },
    { ions: ["Cl", "Br", "I"], soluble: true, exceptions: ["Ag", "Pb", "Hg"] },
    { ions: ["SO4"], soluble: true, exceptions: ["Ba", "Pb", "Ca", "Sr", "Ag"] },
    { ions: ["CO3", "PO4", "OH", "S"], soluble: false, exceptions: ["Li", "Na", "K", "NH4"] },
  ],

  // Standard enthalpies of formation, kJ/mol at 298 K (OpenStax Chemistry 2e, Appendix G).
  enthalpiesOfFormation: {
    "H2O(l)": -285.8,
    "H2O(g)": -241.8,
    "CO2(g)": -393.5,
    "CO(g)": -110.5,
    "CH4(g)": -74.6,
    "C2H6(g)": -84.0,
    "C2H4(g)": 52.4,
    "NH3(g)": -45.9,
    "NO(g)": 91.3,
    "NO2(g)": 33.2,
    "SO2(g)": -296.8,
    "NaCl(s)": -411.2,
    "CaCO3(s)": -1207.6,
    "C6H12O6(s)": -1273.3,
    "O2(g)": 0.0,
    "N2(g)": 0.0,
  },

  // Specific heats, J/(g·°C) (OpenStax Chemistry 2e, Table 5.1 and Appendix).
  specificHeats: {
    "H2O(l)": 4.184,
    "H2O(s)": 2.09,
    "H2O(g)": 1.86,
    "Al(s)": 0.897,
    "Fe(s)": 0.449,
    "Cu(s)": 0.385,
    "Au(s)": 0.129,
    "C(s,graphite)": 0.709,
    "ethanol(l)": 2.44,
  },
};

// Convenience map: symbol -> element record object. Built once at load.
CHEM_DATA.bySymbol = (function () {
  var map = {};
  CHEM_DATA.elements.forEach(function (e) {
    map[e[1]] = {
      number: e[0],
      symbol: e[1],
      name: e[2],
      mass: e[3],
      electronegativity: e[4],
      configuration: e[5],
      atomicRadius: e[6],
    };
  });
  return map;
})();

// Convenience map: polyatomic-ion formula -> {name, charge}.
CHEM_DATA.polyatomicByFormula = (function () {
  var map = {};
  CHEM_DATA.polyatomicIons.forEach(function (ion) {
    map[ion.formula] = { name: ion.name, charge: ion.charge };
  });
  return map;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = CHEM_DATA;
}
if (typeof window !== "undefined") {
  window.CHEM_DATA = CHEM_DATA;
}
