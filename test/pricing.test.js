const test = require('node:test');
const assert = require('node:assert/strict');
const { priceLive, priceCustom, priceOther, formatPrice } = require('../src/pricing');

// The values from the spec table, requirement M1-4.
const settings = {
  live_hourly_rate: 150,
  miles_per_gallon: 27,
  price_per_gallon: 3.7,
  custom_base_price: 150,
  custom_person_1_price: 75,
  custom_person_2_price: 150,
  custom_person_3_price: 190,
  custom_person_extra_price: 50,
  custom_text_price: 25,
  custom_background_simple: 50,
  custom_background_complex: 75,
  illustration_price: 500,
  logo_hourly_rate: 75,
};

// Each expected value below is worked by hand from the price table.

test('custom: base 150, 1 person 75, no background, no text is 225', () => {
  const price = priceCustom({ personCount: 1, background: 'none', text: false }, settings);
  assert.equal(price.amount, 225);
  assert.equal(price.unit, 'total');
});

test('custom: base 150, 2 people 150, simple 50, text 25 is 375', () => {
  assert.equal(priceCustom({ personCount: 2, background: 'simple', text: true }, settings).amount, 375);
});

test('custom: base 150, 3 people 190, complex 75 is 415', () => {
  assert.equal(priceCustom({ personCount: 3, background: 'complex', text: false }, settings).amount, 415);
});

test('custom: 5 people is 190 plus 2 more at 50, so 150 + 290 is 440', () => {
  assert.equal(priceCustom({ personCount: 5, background: 'none', text: false }, settings).amount, 440);
});

test('live: 3 hours at 150 is 450, and 40 miles of travel is 5, so 455', () => {
  // 40 miles / 27 miles per gallon = 1.481 gallons. 1.481 * 3.7 = 5.48, rounded down to 5.
  const price = priceLive({ startTime: '18:00', endTime: '21:00', oneWayMiles: 20 }, settings);
  assert.equal(price.amount, 455);
  assert.deepEqual(price.breakdown, { hours: 3, eventCost: 450, roundTripMiles: 40, travelCost: 5 });
});

test('live: an event from 22:00 to 01:30 is 3.5 hours, so 525 with no known distance', () => {
  const price = priceLive({ startTime: '22:00', endTime: '01:30', oneWayMiles: null }, settings);
  assert.equal(price.amount, 525);
  assert.equal(price.breakdown.travelCost, 0);
  assert.equal(price.breakdown.roundTripMiles, null);
});

test('other: an illustration is 500 in total, and a logo is 75 for each hour', () => {
  assert.deepEqual(
    [priceOther({ selection: 'illustration' }, settings), priceOther({ selection: 'logo' }, settings)].map(
      (price) => [price.amount, price.unit],
    ),
    [
      [500, 'total'],
      [75, 'hour'],
    ],
  );
});

test('a price shows as dollars, with /hr for an hourly rate', () => {
  assert.equal(formatPrice({ amount: 455, unit: 'total' }), '$455');
  assert.equal(formatPrice({ amount: 75, unit: 'hour' }), '$75/hr');
});
