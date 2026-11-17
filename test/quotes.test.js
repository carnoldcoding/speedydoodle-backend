const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp, fakeMailer, fakeMaps, customQuote, liveQuote } = require('./helpers');

const quoteRows = (db) => db.prepare('SELECT * FROM quotes ORDER BY id').all();

test('a valid quote is stored and answers 201 with the price', async () => {
  const app = await startApp();
  const response = await app.post('/api/quotes', customQuote());
  assert.equal(response.status, 201);
  // Base 150 + 2 people 150 + simple background 50 + text 25.
  assert.deepEqual((await response.json()).price.amount, 375);

  const [row] = quoteRows(app.db);
  assert.equal(row.email, 'ada@example.test');
  assert.equal(row.price_amount, 375);
  assert.equal(JSON.parse(row.details).textContent, 'Happy Birthday!');
  await app.close();
});

test('the artist and the customer each get one separate email', async () => {
  const app = await startApp();
  await app.post('/api/quotes', customQuote());

  const recipient = app.db.prepare("SELECT value FROM settings WHERE key = 'quote_recipient'").get().value;
  assert.deepEqual(
    app.mailer.sent.map((message) => message.to),
    [recipient, 'ada@example.test'],
  );
  assert.equal(app.mailer.sent[0].replyTo, 'ada@example.test');
  const [row] = quoteRows(app.db);
  assert.equal(row.artist_email_status, 'sent');
  assert.equal(row.customer_email_status, 'sent');
  await app.close();
});

test('a recipient, a subject, and a body from the request are not used', async () => {
  const app = await startApp();
  const response = await app.post(
    '/api/quotes',
    customQuote({
      to: 'victim@example.test',
      subject: 'Attacker subject',
      html: '<p>attacker body</p>',
      text: 'attacker body',
    }),
  );
  assert.equal(response.status, 201);
  for (const message of app.mailer.sent) {
    assert.notEqual(message.to, 'victim@example.test');
    assert.doesNotMatch(message.subject, /Attacker subject/);
    assert.doesNotMatch(message.html, /attacker body/);
    assert.doesNotMatch(message.text, /attacker body/);
  }
  await app.close();
});

test('the quote row exists before the first email goes out', async () => {
  let rowsAtFirstSend = null;
  const mailer = fakeMailer({
    onSend: () => {
      if (rowsAtFirstSend === null) rowsAtFirstSend = quoteRows(app.db).length;
    },
  });
  const app = await startApp({ mailer });
  await app.post('/api/quotes', customQuote());
  assert.equal(rowsAtFirstSend, 1);
  await app.close();
});

test('markup in a form value shows as text in the email', async () => {
  const app = await startApp();
  await app.post('/api/quotes', customQuote({ additionalInfo: '<b>x</b> <script>alert(1)</script>' }));
  for (const message of app.mailer.sent) {
    assert.match(message.html, /&lt;b&gt;x&lt;\/b&gt; &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(message.html, /<b>x<\/b>/);
    assert.doesNotMatch(message.html, /<script>/);
  }
  await app.close();
});

test('a price from the browser is ignored', async () => {
  const app = await startApp();
  const response = await app.post(
    '/api/quotes',
    customQuote({ customCost: 1, price: 1, price_amount: 1, totalCost: 1 }),
  );
  assert.equal((await response.json()).price.amount, 375);
  assert.equal(quoteRows(app.db)[0].price_amount, 375);
  assert.match(app.mailer.sent[0].text, /Estimated Price: \$375/);
  await app.close();
});

test('a live quote gets its distance from the server, not from the browser', async () => {
  const maps = fakeMaps({ miles: 20 });
  const app = await startApp({ maps });
  const response = await app.post('/api/quotes', liveQuote({ distance: '0.1 mi', totalDistance: 0, gasCost: 0 }));
  // 3 hours at 150 is 450. 40 miles of travel is 5.
  assert.equal((await response.json()).price.amount, 455);
  assert.deepEqual(maps.calls, ['1 Main Street, Camden, NJ, USA']);
  await app.close();
});

test('a live quote is still stored when the distance lookup fails', async () => {
  const app = await startApp({ maps: fakeMaps({ fail: true }) });
  const response = await app.post('/api/quotes', liveQuote());
  assert.equal(response.status, 201);
  // 3 hours at 150, with no travel cost.
  assert.equal(quoteRows(app.db)[0].price_amount, 450);
  assert.match(app.mailer.sent[0].text, /travel cost is not in the estimate/);
  await app.close();
});

test('a failed email does not fail the request, and the row records the failure', async () => {
  const app = await startApp({ mailer: fakeMailer({ fail: true }) });
  const response = await app.post('/api/quotes', customQuote());
  assert.equal(response.status, 201);
  const [row] = quoteRows(app.db);
  assert.equal(row.artist_email_status, 'failed');
  assert.equal(row.customer_email_status, 'failed');
  assert.match(row.artist_email_error, /535 Authentication failed/);
  assert.match(row.customer_email_error, /535 Authentication failed/);
  await app.close();
});

test('the fourth quote from one address in 24 hours sends no confirmation', async () => {
  const app = await startApp();
  for (let count = 0; count < 4; count += 1) {
    // The same address in a different letter case is the same address.
    const response = await app.post('/api/quotes', customQuote({ email: count % 2 ? 'ADA@example.test' : 'ada@example.test' }));
    assert.equal(response.status, 201);
  }
  const rows = quoteRows(app.db);
  assert.deepEqual(
    rows.map((row) => row.customer_email_status),
    ['sent', 'sent', 'sent', 'skipped'],
  );
  // The artist still gets each one.
  assert.deepEqual(
    rows.map((row) => row.artist_email_status),
    ['sent', 'sent', 'sent', 'sent'],
  );
  assert.equal(app.mailer.sent.filter((message) => message.to === 'ada@example.test').length, 3);
  await app.close();
});

test('a quote older than 24 hours does not count toward the confirmation limit', async () => {
  let clock = new Date('2027-01-01T12:00:00Z');
  const app = await startApp({ now: () => clock });
  for (let count = 0; count < 3; count += 1) await app.post('/api/quotes', customQuote());
  clock = new Date('2027-01-02T12:00:01Z');
  await app.post('/api/quotes', customQuote());
  assert.equal(quoteRows(app.db)[3].customer_email_status, 'sent');
  await app.close();
});

const invalidCases = [
  ['a missing type', { type: undefined }, 'type'],
  ['an unknown type', { type: 'free' }, 'type'],
  ['an empty first name', { firstName: '  ' }, 'firstName'],
  ['markup in a last name', { lastName: '<script>' }, 'lastName'],
  ['a line break in a first name', { firstName: 'Ada\r\nBcc: x@example.test' }, 'firstName'],
  ['an email with no domain', { email: 'ada@' }, 'email'],
  ['two addresses in the email field', { email: 'a@example.test, b@example.test' }, 'email'],
  ['an unknown background', { background: '75' }, 'background'],
  ['zero people', { personCount: 0 }, 'personCount'],
  ['a person count that is not a number', { personCount: 'abc' }, 'personCount'],
  ['text chosen with no text content', { includeText: true, textContent: '' }, 'textContent'],
  ['a text choice that is not yes or no', { includeText: 'yes' }, 'includeText'],
  ['a description that is too long', { description: 'x'.repeat(2001) }, 'description'],
  ['empty additional information', { additionalInfo: '' }, 'additionalInfo'],
];

for (const [label, overrides, field] of invalidCases) {
  test(`${label} answers 400 and names the field ${field}`, async () => {
    const app = await startApp();
    const response = await app.post('/api/quotes', customQuote(overrides));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).field, field);
    assert.equal(quoteRows(app.db).length, 0);
    assert.equal(app.mailer.sent.length, 0);
    await app.close();
  });
}

const invalidLiveCases = [
  ['a date that does not exist', { date: '02/30/2027' }, 'date'],
  ['a date in the wrong format', { date: '2027-06-20' }, 'date'],
  ['a time that does not exist', { startTime: '25:00' }, 'startTime'],
  ['a missing end time', { endTime: undefined }, 'endTime'],
  ['a headcount that is not a number', { headcount: 'many' }, 'headcount'],
  ['a missing location', { location: '' }, 'location'],
];

for (const [label, overrides, field] of invalidLiveCases) {
  test(`live quote: ${label} answers 400 and names the field ${field}`, async () => {
    const app = await startApp();
    const response = await app.post('/api/quotes', liveQuote(overrides));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).field, field);
    assert.equal(quoteRows(app.db).length, 0);
    await app.close();
  });
}

test('an unknown selection for a logo or illustration quote names the field selection', async () => {
  const app = await startApp();
  const response = await app.post('/api/quotes', {
    type: 'lni',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    selection: 'mural',
    additionalInfo: 'x',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).field, 'selection');
  await app.close();
});

test('a logo quote stores the hourly rate', async () => {
  const app = await startApp();
  const response = await app.post('/api/quotes', {
    type: 'lni',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    selection: 'logo',
    additionalInfo: 'A logo for a bakery.',
  });
  assert.equal(response.status, 201);
  const [row] = quoteRows(app.db);
  assert.equal(row.price_amount, 75);
  assert.equal(row.price_unit, 'hour');
  assert.match(app.mailer.sent[0].text, /Estimated Price: \$75\/hr/);
  await app.close();
});

test('a name with an apostrophe, a hyphen, and an accent is accepted', async () => {
  const app = await startApp();
  const response = await app.post('/api/quotes', customQuote({ firstName: 'Zoë', lastName: "O'Brien-Smith" }));
  assert.equal(response.status, 201);
  await app.close();
});

test('a body that is not JSON answers 400', async () => {
  const app = await startApp();
  const response = await app.post('/api/quotes', '{not json');
  assert.equal(response.status, 400);
  await app.close();
});

test('a short autocomplete query does not go to Google', async () => {
  const maps = fakeMaps();
  const app = await startApp({ maps });
  const response = await app.get('/api/autocomplete?query=ab');
  assert.deepEqual(await response.json(), { suggestions: [] });
  assert.equal(maps.calls.length, 0);
  await app.close();
});

test('an autocomplete query of 3 characters goes to Google', async () => {
  const maps = fakeMaps();
  const app = await startApp({ maps });
  const response = await app.get('/api/autocomplete?query=Elm');
  assert.equal((await response.json()).suggestions.length, 1);
  assert.deepEqual(maps.calls, ['Elm']);
  await app.close();
});

test('an unknown route answers 404', async () => {
  const app = await startApp();
  assert.equal((await app.get('/api/does-not-exist')).status, 404);
  await app.close();
});
