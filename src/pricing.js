// Price calculations. The formulas are the ones the quote form used in the
// browser. The server is now the only place that decides a price.

// Hours between two "HH:MM" times. An end time before the start time means
// the event ends on the next day.
function eventHours(startTime, endTime) {
  const minutes = (time) => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  };
  let difference = minutes(endTime) - minutes(startTime);
  if (difference < 0) difference += 24 * 60;
  return difference / 60;
}

// oneWayMiles is null when the distance is not known. The travel cost is then 0.
function priceLive({ startTime, endTime, oneWayMiles }, settings) {
  const hours = eventHours(startTime, endTime);
  const eventCost = settings.live_hourly_rate * hours;
  const roundTripMiles = oneWayMiles === null ? null : oneWayMiles * 2;
  const travelCost =
    roundTripMiles === null
      ? 0
      : Math.floor((roundTripMiles / settings.miles_per_gallon) * settings.price_per_gallon);
  return {
    amount: eventCost + travelCost,
    unit: 'total',
    breakdown: { hours, eventCost, roundTripMiles, travelCost },
  };
}

function personPrice(personCount, settings) {
  if (personCount === 1) return settings.custom_person_1_price;
  if (personCount === 2) return settings.custom_person_2_price;
  if (personCount === 3) return settings.custom_person_3_price;
  return settings.custom_person_3_price + (personCount - 3) * settings.custom_person_extra_price;
}

function priceCustom({ personCount, background, text }, settings) {
  const basePrice = settings.custom_base_price;
  const peoplePrice = personPrice(personCount, settings);
  const backgroundPrice =
    background === 'simple'
      ? settings.custom_background_simple
      : background === 'complex'
        ? settings.custom_background_complex
        : 0;
  const textPrice = text ? settings.custom_text_price : 0;
  return {
    amount: basePrice + peoplePrice + backgroundPrice + textPrice,
    unit: 'total',
    breakdown: { basePrice, peoplePrice, backgroundPrice, textPrice },
  };
}

// A logo has a price for each hour. An illustration has one fixed price.
function priceOther({ selection }, settings) {
  if (selection === 'logo') {
    return { amount: settings.logo_hourly_rate, unit: 'hour', breakdown: {} };
  }
  return { amount: settings.illustration_price, unit: 'total', breakdown: {} };
}

function formatPrice(price) {
  const amount = Number.isInteger(price.amount) ? String(price.amount) : price.amount.toFixed(2);
  return price.unit === 'hour' ? `$${amount}/hr` : `$${amount}`;
}

module.exports = { eventHours, priceLive, priceCustom, priceOther, formatPrice };
