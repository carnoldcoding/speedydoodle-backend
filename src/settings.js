// The complete list of settings. A row in the `settings` table is valid only
// when its key is in this list and its value has the type given here.
//
// scope 'content':   the admin user can change it in the admin panel.
// scope 'technical': only the technical page on the tailnet path can change it.
const DEFINITIONS = {
  live_hourly_rate: { type: 'number', scope: 'content' },
  price_per_gallon: { type: 'number', scope: 'content' },
  custom_base_price: { type: 'number', scope: 'content' },
  custom_person_1_price: { type: 'number', scope: 'content' },
  custom_person_2_price: { type: 'number', scope: 'content' },
  custom_person_3_price: { type: 'number', scope: 'content' },
  custom_person_extra_price: { type: 'number', scope: 'content' },
  custom_text_price: { type: 'number', scope: 'content' },
  custom_background_simple: { type: 'number', scope: 'content' },
  custom_background_complex: { type: 'number', scope: 'content' },
  illustration_price: { type: 'number', scope: 'content' },
  logo_hourly_rate: { type: 'number', scope: 'content' },
  miles_per_gallon: { type: 'number', scope: 'technical' },
  quote_recipient: { type: 'email', scope: 'technical' },
};

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

function parseValue(key, raw) {
  const definition = DEFINITIONS[key];
  if (!definition) throw new Error(`Unknown setting: ${key}`);
  if (definition.type === 'number') {
    const number = Number(raw);
    if (raw === '' || !Number.isFinite(number) || number < 0) {
      throw new Error(`Setting ${key} must be a number of 0 or more`);
    }
    return number;
  }
  if (definition.type === 'email') {
    if (!EMAIL_PATTERN.test(raw)) throw new Error(`Setting ${key} must be an email address`);
    return raw;
  }
  return raw;
}

// Read each setting as a typed value. A missing row is an error, because a
// price calculation with a missing value gives a wrong price.
function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const settings = {};
  for (const key of Object.keys(DEFINITIONS)) {
    if (!stored.has(key)) throw new Error(`Setting ${key} has no row`);
    settings[key] = parseValue(key, stored.get(key));
  }
  return settings;
}

module.exports = { DEFINITIONS, EMAIL_PATTERN, getSettings, parseValue };
