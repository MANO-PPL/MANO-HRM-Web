import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

// Get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to normalize strings
const upper = v => v ? v.trim().toUpperCase() : "";

const normalizeText = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, '').normalize("NFC") // remove diacritics
    .replace(/\b(emirate|state|province|region|territory|county|district|prefecture|governorate|department|division)\b/gi, '') // remove common geo terms
    .replace(/[^a-z0-9]/g, '') // strip special characters and spaces
    .trim();
};

const countries = JSON.parse(
  fs.readFileSync(path.join(__dirname, "countries.json"), "utf-8")
);

const states = JSON.parse(
  fs.readFileSync(path.join(__dirname, "states.json"), "utf-8")
);

const rawCities = JSON.parse(
  fs.readFileSync(path.join(__dirname, "cities.json"), "utf-8")
);

// Indexes
const countryByCode = new Map();
const countryByNormalizedName = new Map();
const statesByCountry = new Map();
const citiesByState = new Map();
const stateByCountryAndCode = new Map();
const stateByCountryAndNormalizedName = new Map();

// Country overrides mapping from cities.json to countries.json
const countryOverrides = {
  "caboverde": "capeverde",
  "czechia": "czechrepublic",
  "boliviaplurinationalstateof": "bolivia",
  "bruneidarussalam": "brunei",
  "congothedemocraticrepublicofthe": "congo",
  "congotherepublicof": "congo",
  "falklandislandsmalvinas": "falklandislands",
  "koreademocraticpeoplesrepublicof": "koreanorth",
  "korearepublicof": "koreasouth",
  "laopeoplesdemocraticrepublic": "laos",
  "micronesiafederatedstatesof": "micronesia",
  "moldovarepublicof": "moldova",
  "palestine": "palestinianoccupied",
  "palestinestateof": "palestinianoccupied",
  "russianfederation": "russia",
  "syrianarabrepublic": "syria",
  "tanzaniaunitedrepublicof": "tanzania",
  "venezuelabolivarianrepublicof": "venezuela",
  "vietnam": "vietnam",
  "turkiye": "turkey",
  "eswatini": "swaziland",
  "holyseevaticancity": "vaticancitystateholysee",
  "holyseevaticancitystate": "vaticancitystateholysee",
  "macao": "macausar",
  "republicofmacedonia": "macedonia",
  "northmacedonia": "macedonia",
  "saintbarthelemy": "saintbarthelemy",
  "saintmartinfechpart": "saintmartin",
  "saintmartin": "saintmartin",
  "reunion": "reunion",
  "isleofman": "manisleof",
  "timorleste": "easttimor",
  "nocountryfoundforalpha2codexk": "kosovo"
};

// Countries
for (const c of countries) {
  if (!c.iso2) continue;
  countryByCode.set(upper(c.iso2), c);
  countryByNormalizedName.set(normalizeText(c.name), c);
}

// States
for (const s of states) {
  // states by country
  if (!statesByCountry.has(s.country_id)) {
    statesByCountry.set(s.country_id, []);
  }
  statesByCountry.get(s.country_id).push(s);

  // composite key
  if (s.country_code && s.state_code) {
    const key = `${upper(s.country_code)}-${upper(s.state_code)}`;
    stateByCountryAndCode.set(key, s);
  }

  // composite key by name
  if (s.country_code && s.name) {
    const key = `${upper(s.country_code)}-${normalizeText(s.name)}`;
    stateByCountryAndNormalizedName.set(key, s);
  }
}

// Generate fallback states for countries with 0 states
for (const c of countries) {
  const list = statesByCountry.get(c.id) || [];
  if (list.length === 0) {
    const fallbackState = {
      id: c.id * 100000,
      name: c.name,
      country_id: c.id,
      country_code: c.iso2,
      state_code: c.iso2,
      latitude: c.latitude,
      longitude: c.longitude
    };
    statesByCountry.set(c.id, [fallbackState]);
    
    if (c.iso2) {
      stateByCountryAndCode.set(`${upper(c.iso2)}-${upper(c.iso2)}`, fallbackState);
      stateByCountryAndNormalizedName.set(`${upper(c.iso2)}-${normalizeText(c.name)}`, fallbackState);
    }
  }
}

// Helper to look up country objects
const getCountryObject = (name) => {
  if (!name) return null;
  const normalized = normalizeText(name);
  const mapped = countryOverrides[normalized] || normalized;
  
  let found = countryByNormalizedName.get(mapped) || countryByNormalizedName.get(normalized);
  if (found) return found;

  // Substring fallback
  for (const [key, value] of countryByNormalizedName.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return value;
    }
  }
  return null;
};

// Cities - Process new schema and map to corresponding state
for (const c of rawCities) {
  const country = getCountryObject(c.country);
  if (!country) continue;

  const stateName = c.subcountry ? normalizeText(c.subcountry) : '';
  const stateKey = `${upper(country.iso2)}-${stateName}`;
  let state = stateByCountryAndNormalizedName.get(stateKey);

  // Fallback 1: Substring state name matching
  const countryStates = statesByCountry.get(country.id) || [];
  if (!state && stateName && countryStates.length > 0) {
    state = countryStates.find(s => {
      const normalizedState = normalizeText(s.name);
      return normalizedState.includes(stateName) || stateName.includes(normalizedState);
    });
  }

  // Fallback 2: Default to the first state of the country
  if (!state && countryStates.length > 0) {
    state = countryStates[0];
  }

  if (!state) continue;

  // Map to the format that backend expects
  const mappedCity = {
    id: c.geonameid || Math.floor(Math.random() * 1000000), // Fallback unique ID
    name: c.city,
    state_id: state.id,
    state_code: state.state_code,
    country_id: country.id,
    country_code: country.iso2,
    latitude: null,
    longitude: null
  };

  if (!citiesByState.has(state.id)) {
    citiesByState.set(state.id, []);
  }
  citiesByState.get(state.id).push(mappedCity);
}

// Sort all countries, states, and cities arrays alphabetically once during startup
countries.sort((a, b) => a.name.localeCompare(b.name));

for (const [countryId, stateList] of statesByCountry.entries()) {
  stateList.sort((a, b) => a.name.localeCompare(b.name));
}

for (const [stateId, cityList] of citiesByState.entries()) {
  cityList.sort((a, b) => a.name.localeCompare(b.name));
}

// Endpoints

router.get("/countries", (req, res) => {
  res.json({
    ok: true,
    data: countries.map(c => ({
      name: c.name,
      iso2: c.iso2,
      phone_code: c.phone_code,
      emoji: c.emoji,
    })),
  });
});

router.get("/states/:country_code", (req, res) => {
  const countryCode = upper(req.params.country_code);
  const country = countryByCode.get(countryCode);

  if (!country) {
    return res.status(404).json({
      ok: false,
      message: "Country not found",
    });
  }

  res.json({
    ok: true,
    data: (statesByCountry.get(country.id) || []).map(s => ({
      name: s.name,
      state_code: s.state_code,
    })),
  });
});

router.get("/cities/:country_code/:state_code", (req, res) => {
  const countryCode = upper(req.params.country_code);
  const stateCode = upper(req.params.state_code);

  const key = `${countryCode}-${stateCode}`;
  const state = stateByCountryAndCode.get(key);

  if (!state) {
    return res.status(404).json({
      ok: false,
      message: "State not found for this country",
    });
  }

  res.json({
    ok: true,
    data: (citiesByState.get(state.id) || []).map(c => ({
      id: c.id,
      name: c.name,
      latitude: c.latitude,
      longitude: c.longitude,
    })),
  });
});

export default router;
