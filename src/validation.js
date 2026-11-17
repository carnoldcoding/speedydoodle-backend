const { EMAIL_PATTERN } = require('./settings');

// A failed check throws this. The route answers 400 with the field name.
class FieldError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

// Control characters are never valid. A text area can hold line breaks and tabs.
const CONTROL_SINGLE_LINE = /[\u0000-\u001f\u007f]/;
const CONTROL_MULTI_LINE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M} .'-]*$/u;

function text(body, field, { max, multiLine = false }) {
  const value = body[field];
  if (typeof value !== 'string') throw new FieldError(field, 'This field is required.');
  const trimmed = value.trim();
  if (trimmed === '') throw new FieldError(field, 'This field is required.');
  if (trimmed.length > max) {
    throw new FieldError(field, `This field allows ${max} characters at most.`);
  }
  if ((multiLine ? CONTROL_MULTI_LINE : CONTROL_SINGLE_LINE).test(trimmed)) {
    throw new FieldError(field, 'This field contains a character that is not allowed.');
  }
  return trimmed;
}

function name(body, field) {
  const value = text(body, field, { max: 60 });
  if (!NAME_PATTERN.test(value)) {
    throw new FieldError(field, 'Use letters, spaces, apostrophes, periods, and hyphens only.');
  }
  return value;
}

// Accept a whole number as a number or as a string of digits.
function integer(body, field, { min, max }) {
  const raw = body[field];
  const isDigits = typeof raw === 'string' && /^\d{1,9}$/.test(raw.trim());
  const value = isDigits ? Number(raw.trim()) : raw;
  if (!Number.isInteger(value)) throw new FieldError(field, 'Enter a whole number.');
  if (value < min || value > max) {
    throw new FieldError(field, `Enter a number from ${min} to ${max}.`);
  }
  return value;
}

function oneOf(body, field, allowed) {
  const value = body[field];
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new FieldError(field, `Choose one of: ${allowed.join(', ')}.`);
  }
  return value;
}

// MM/DD/YYYY, and the day must exist in that month.
function date(body, field) {
  const value = text(body, field, { max: 10 });
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new FieldError(field, 'Enter a date as MM/DD/YYYY.');
  const [month, day, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const exists =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!exists || year < 2000 || year > 2100) {
    throw new FieldError(field, 'Enter a date that exists.');
  }
  return value;
}

// HH:MM on a 24-hour clock.
function time(body, field) {
  const value = text(body, field, { max: 5 });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new FieldError(field, 'Enter a time as HH:MM.');
  }
  return value;
}

function validateLive(body) {
  return {
    event: text(body, 'event', { max: 100 }),
    headcount: integer(body, 'headcount', { min: 1, max: 100000 }),
    location: text(body, 'location', { max: 200 }),
    date: date(body, 'date'),
    startTime: time(body, 'startTime'),
    endTime: time(body, 'endTime'),
  };
}

function validateCustom(body) {
  const details = {
    description: text(body, 'description', { max: 2000, multiLine: true }),
    background: oneOf(body, 'background', ['none', 'simple', 'complex']),
    personCount: integer(body, 'personCount', { min: 1, max: 50 }),
  };
  if (typeof body.includeText !== 'boolean') {
    throw new FieldError('includeText', 'Choose yes or no.');
  }
  details.text = body.includeText;
  if (details.text) details.textContent = text(body, 'textContent', { max: 200 });
  return details;
}

function validateOther(body) {
  return { selection: oneOf(body, 'selection', ['logo', 'illustration']) };
}

// Read the allowed fields from a request body and check each one.
// The result holds only those fields. Any other key in the body is ignored.
function validateQuote(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new FieldError('type', 'Send the quote as a JSON object.');
  }
  const type = oneOf(body, 'type', ['live', 'custom', 'lni']);
  const firstName = name(body, 'firstName');
  const lastName = name(body, 'lastName');
  const email = text(body, 'email', { max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new FieldError('email', 'Enter an email address.');

  const details =
    type === 'live'
      ? validateLive(body)
      : type === 'custom'
        ? validateCustom(body)
        : validateOther(body);

  const additionalInfo = text(body, 'additionalInfo', { max: 2000, multiLine: true });
  return { type, firstName, lastName, email, details, additionalInfo };
}

module.exports = { FieldError, validateQuote };
