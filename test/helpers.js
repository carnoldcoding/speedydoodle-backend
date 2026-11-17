const { openDatabase } = require('../src/db');
const { createApp } = require('../src/app');

const silentLog = { error() {}, log() {} };

// A mailer that records each message. Give `fail: true` to make each send throw.
function fakeMailer({ fail = false, onSend } = {}) {
  const sent = [];
  return {
    sent,
    async sendMail(message) {
      if (onSend) onSend(message);
      if (fail) throw new Error('535 Authentication failed');
      sent.push(message);
      return { messageId: `test-${sent.length}` };
    },
  };
}

// Google answers "20.0 mi" for each location unless a test says otherwise.
function fakeMaps({ miles = 20, fail = false } = {}) {
  const calls = [];
  return {
    calls,
    async distance(location) {
      calls.push(location);
      if (fail) throw new Error('No route for this location (NOT_FOUND)');
      return { text: `${miles.toFixed(1)} mi`, miles };
    },
    async autocomplete(query) {
      calls.push(query);
      return [{ description: `${query} Street, Wenonah, NJ, USA` }];
    },
  };
}

// Start the application on a free port with an empty in-memory database.
async function startApp(options = {}) {
  const db = openDatabase(':memory:');
  const mailer = options.mailer ?? fakeMailer();
  const maps = options.maps ?? fakeMaps();
  const app = createApp({
    db,
    mailer,
    maps,
    imagekit: { listFiles: (query, callback) => callback(null, []) },
    sender: 'noreply@mail.example.test',
    log: silentLog,
    now: options.now,
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  // A test that fails before it closes the server must not keep the process open.
  server.unref();
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const get = (path) => fetch(base + path);
  const close = () => new Promise((resolve) => server.close(resolve));
  return { db, mailer, maps, post, get, close };
}

const customQuote = (overrides = {}) => ({
  type: 'custom',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.test',
  description: 'Two people at a desk.',
  background: 'simple',
  personCount: 2,
  includeText: true,
  textContent: 'Happy Birthday!',
  additionalInfo: 'Needed by June.',
  ...overrides,
});

const liveQuote = (overrides = {}) => ({
  type: 'live',
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@example.test',
  event: 'Wedding',
  headcount: '80',
  location: '1 Main Street, Camden, NJ, USA',
  date: '06/20/2027',
  startTime: '18:00',
  endTime: '21:00',
  additionalInfo: 'Outdoor event.',
  ...overrides,
});

module.exports = { startApp, fakeMailer, fakeMaps, customQuote, liveQuote };
