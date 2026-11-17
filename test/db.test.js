const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../src/db');
const { DEFINITIONS, getSettings } = require('../src/settings');

test('a new database gets each table and the migration number', () => {
  const db = openDatabase(':memory:');
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name);
  assert.deepEqual(tables, ['quotes', 'settings']);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
});

test('the first migration gives each defined setting the value from the frontend source', () => {
  const settings = getSettings(openDatabase(':memory:'));
  assert.deepEqual(Object.keys(settings).sort(), Object.keys(DEFINITIONS).sort());
  // The values in the spec table, requirement M1-4.
  assert.equal(settings.live_hourly_rate, 150);
  assert.equal(settings.miles_per_gallon, 27);
  assert.equal(settings.price_per_gallon, 3.7);
  assert.equal(settings.custom_base_price, 150);
  assert.equal(settings.custom_person_1_price, 75);
  assert.equal(settings.custom_person_2_price, 150);
  assert.equal(settings.custom_person_3_price, 190);
  assert.equal(settings.custom_person_extra_price, 50);
  assert.equal(settings.custom_text_price, 25);
  assert.equal(settings.custom_background_simple, 50);
  assert.equal(settings.custom_background_complex, 75);
  assert.equal(settings.illustration_price, 500);
  assert.equal(settings.logo_hourly_rate, 75);
  assert.match(settings.quote_recipient, /@speedydoodle\.com$/);
});

test('a second start applies only the migrations that are new', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speedydoodle-test-'));
  const migrations = path.join(dir, 'migrations');
  fs.mkdirSync(migrations);
  fs.writeFileSync(
    path.join(migrations, '001_first.sql'),
    "CREATE TABLE notes (body TEXT); INSERT INTO notes VALUES ('one');",
  );
  const file = path.join(dir, 'test.db');

  openDatabase(file, { migrationsDir: migrations }).close();
  fs.writeFileSync(path.join(migrations, '002_second.sql'), "INSERT INTO notes VALUES ('two');");
  const db = openDatabase(file, { migrationsDir: migrations });

  // Migration 1 ran one time, so its row exists one time.
  assert.deepEqual(
    db.prepare('SELECT body FROM notes ORDER BY rowid').all().map((row) => row.body),
    ['one', 'two'],
  );
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a failed migration changes nothing and keeps the old number', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speedydoodle-test-'));
  const migrations = path.join(dir, 'migrations');
  fs.mkdirSync(migrations);
  fs.writeFileSync(path.join(migrations, '001_first.sql'), 'CREATE TABLE notes (body TEXT);');
  fs.writeFileSync(
    path.join(migrations, '002_bad.sql'),
    "INSERT INTO notes VALUES ('kept?'); INSERT INTO missing_table VALUES (1);",
  );
  const file = path.join(dir, 'test.db');

  assert.throws(() => openDatabase(file, { migrationsDir: migrations }), /002_bad\.sql failed/);

  fs.rmSync(path.join(migrations, '002_bad.sql'));
  const db = openDatabase(file, { migrationsDir: migrations });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM notes').get().count, 0);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
