-- M1 (close the holes): settings and stored quotes.

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

-- The values that the frontend source held when this migration was written.
INSERT INTO settings (key, value) VALUES
  ('live_hourly_rate',          '150'),
  ('miles_per_gallon',          '27'),
  ('price_per_gallon',          '3.7'),
  ('custom_base_price',         '150'),
  ('custom_person_1_price',     '75'),
  ('custom_person_2_price',     '150'),
  ('custom_person_3_price',     '190'),
  ('custom_person_extra_price', '50'),
  ('custom_text_price',         '25'),
  ('custom_background_simple',  '50'),
  ('custom_background_complex', '75'),
  ('illustration_price',        '500'),
  ('logo_hourly_rate',          '75'),
  ('quote_recipient',           'mike@speedydoodle.com');

CREATE TABLE quotes (
  id                    INTEGER PRIMARY KEY,
  created_at            TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('live', 'custom', 'lni')),
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  details               TEXT NOT NULL,
  additional_info       TEXT NOT NULL,
  price_amount          REAL NOT NULL,
  price_unit            TEXT NOT NULL CHECK (price_unit IN ('total', 'hour')),
  price_breakdown       TEXT NOT NULL,
  artist_email_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (artist_email_status IN ('pending', 'sent', 'failed')),
  artist_email_error    TEXT,
  customer_email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (customer_email_status IN ('pending', 'sent', 'failed', 'skipped')),
  customer_email_error  TEXT
) STRICT;

CREATE INDEX quotes_email_created_at ON quotes (email, created_at);
