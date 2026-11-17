const axios = require('axios');

const STUDIO_ADDRESS = '11 N Lincoln Avenue, Wenonah, NJ, USA';
const METERS_PER_MILE = 1609.344;
const TIMEOUT_MS = 8000;

// The two calls to Google. The key stays on the server.
function createMaps({ apiKey }) {
  // The distance by road from a customer location to the studio.
  // Returns { text, miles }. Throws when Google has no route.
  async function distance(location) {
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: { origins: location, destinations: STUDIO_ADDRESS, key: apiKey, units: 'imperial' },
      timeout: TIMEOUT_MS,
    });
    const element = response.data?.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      throw new Error(`No route for this location (${element?.status ?? response.data?.status})`);
    }
    // Google gives the text in miles for a long distance and in feet for a
    // short one. The value is always in meters.
    const text = element.distance.text;
    const miles = / mi$/.test(text)
      ? Number(text.replace(/,/g, '').replace(/ mi$/, ''))
      : Math.round((element.distance.value / METERS_PER_MILE) * 10) / 10;
    return { text, miles };
  }

  async function autocomplete(query) {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
      params: { input: query, key: apiKey },
      timeout: TIMEOUT_MS,
    });
    return (response.data.predictions ?? []).map((prediction) => ({
      description: prediction.description,
    }));
  }

  return { distance, autocomplete };
}

module.exports = { createMaps, STUDIO_ADDRESS };
