const { getSettings } = require('./settings');
const { validateQuote, FieldError } = require('./validation');
const { priceLive, priceCustom, priceOther } = require('./pricing');
const { artistEmail, customerEmail } = require('./email');

// One customer address gets a confirmation for 3 quotes in 24 hours. A fourth
// quote is stored and goes to the artist, but sends no confirmation. This
// stops the form from filling the mailbox of a person who did not use it.
const CONFIRMATION_LIMIT = 3;
const CONFIRMATION_WINDOW_MS = 24 * 60 * 60 * 1000;

function createQuoteService({ db, mailer, maps, sender, now = () => new Date(), log = console }) {
  const insertQuote = db.prepare(`
    INSERT INTO quotes (created_at, type, first_name, last_name, email, details,
                        additional_info, price_amount, price_unit, price_breakdown)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const countRecent = db.prepare(
    'SELECT COUNT(*) AS count FROM quotes WHERE email = ? AND created_at > ?',
  );
  const setArtistResult = db.prepare(
    'UPDATE quotes SET artist_email_status = ?, artist_email_error = ? WHERE id = ?',
  );
  const setCustomerResult = db.prepare(
    'UPDATE quotes SET customer_email_status = ?, customer_email_error = ? WHERE id = ?',
  );

  async function calculatePrice(quote, settings) {
    if (quote.type === 'custom') return priceCustom(quote.details, settings);
    if (quote.type === 'lni') return priceOther(quote.details, settings);

    // The server gets the distance itself. A distance from the browser is not used.
    let oneWayMiles = null;
    try {
      oneWayMiles = (await maps.distance(quote.details.location)).miles;
    } catch (error) {
      // A quote without a travel cost is better than a lost quote.
      log.error('Distance lookup failed:', error.message);
    }
    return priceLive({ ...quote.details, oneWayMiles }, settings);
  }

  // Send one email and record the result in the quote row. Never throws.
  async function send(setResult, quoteId, message) {
    try {
      await mailer.sendMail({ from: sender, ...message });
      setResult.run('sent', null, quoteId);
    } catch (error) {
      log.error(`Email for quote ${quoteId} failed:`, error.message);
      setResult.run('failed', String(error.message).slice(0, 500), quoteId);
    }
  }

  // Validate, price, store, then send. Throws FieldError for a bad field.
  async function create(body) {
    const quote = validateQuote(body);
    const settings = getSettings(db);
    const price = await calculatePrice(quote, settings);

    const createdAt = now();
    const windowStart = new Date(createdAt.getTime() - CONFIRMATION_WINDOW_MS).toISOString();
    const recentCount = countRecent.get(quote.email, windowStart).count;

    // The row exists before any email goes out.
    const { lastInsertRowid } = insertQuote.run(
      createdAt.toISOString(),
      quote.type,
      quote.firstName,
      quote.lastName,
      quote.email,
      JSON.stringify(quote.details),
      quote.additionalInfo,
      price.amount,
      price.unit,
      JSON.stringify(price.breakdown),
    );
    const quoteId = Number(lastInsertRowid);

    await send(setArtistResult, quoteId, {
      to: settings.quote_recipient,
      ...artistEmail(quote, price, { quoteId }),
    });

    if (recentCount >= CONFIRMATION_LIMIT) {
      setCustomerResult.run('skipped', 'Confirmation limit for this address', quoteId);
    } else {
      await send(setCustomerResult, quoteId, {
        to: quote.email,
        ...customerEmail(quote, price, { contactAddress: settings.quote_recipient }),
      });
    }

    return { id: quoteId, price };
  }

  return { create };
}

module.exports = { createQuoteService, FieldError };
