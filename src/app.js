const express = require('express');
const cors = require('cors');
const { createQuoteService, FieldError } = require('./quotes');

const GALLERY_FOLDERS = {
  custom: 'custom_caricatures',
  illustrations: 'illustrations',
  party: 'party_caricatures',
  logos: 'logos',
};

// Build the Express application. Each outside service comes in as an argument,
// so a test can give a substitute for the mailer, Google, and ImageKit.
function createApp({ db, mailer, maps, imagekit, sender, trustProxy, log = console, now }) {
  const app = express();
  // The address of the proxy that Express trusts for the visitor address.
  if (trustProxy) app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '20kb' }));

  const quotes = createQuoteService({ db, mailer, maps, sender, log, now });

  app.post('/api/quotes', async (req, res) => {
    try {
      const { id, price } = await quotes.create(req.body);
      res.status(201).json({ id, price });
    } catch (error) {
      if (error instanceof FieldError) {
        res.status(400).json({ error: 'invalid_field', field: error.field, message: error.message });
        return;
      }
      log.error('Quote failed:', error);
      res.status(500).json({ error: 'server_error', message: 'The quote was not saved.' });
    }
  });

  app.get('/api/calculate-distance', async (req, res) => {
    const location = req.query.userLocation;
    if (typeof location !== 'string' || location.trim().length < 3 || location.length > 200) {
      res.status(400).json({ error: 'invalid_field', field: 'userLocation' });
      return;
    }
    try {
      const { text } = await maps.distance(location.trim());
      res.json({ distance: text });
    } catch (error) {
      log.error('Distance lookup failed:', error.message);
      res.status(500).json({ error: 'An error occurred' });
    }
  });

  app.get('/api/autocomplete', async (req, res) => {
    const query = req.query.query;
    // A short query gives no useful result, so it does not go to Google.
    if (typeof query !== 'string' || query.trim().length < 3 || query.length > 200) {
      res.json({ suggestions: [] });
      return;
    }
    try {
      res.json({ suggestions: await maps.autocomplete(query.trim()) });
    } catch (error) {
      log.error('Autocomplete failed:', error.message);
      res.status(500).json({ error: 'An error occurred' });
    }
  });

  for (const [route, folder] of Object.entries(GALLERY_FOLDERS)) {
    app.get(`/api/${route}`, (req, res) => {
      imagekit.listFiles({ path: folder }, (error, result) => {
        if (error) res.status(500).json({ error: 'Error' });
        else res.json(result);
      });
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // A body that is not valid JSON, or is too large, arrives here.
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      res.status(400).json({ error: 'invalid_body' });
      return;
    }
    log.error('Request failed:', error);
    res.status(500).json({ error: 'server_error' });
  });

  return app;
}

module.exports = { createApp };
