const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// A migration file name starts with its number: 001_init.sql is migration 1.
function listMigrations(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .map((name) => ({ number: Number.parseInt(name, 10), file: path.join(dir, name) }))
    .sort((a, b) => a.number - b.number);
}

// Apply each migration that is newer than the number in PRAGMA user_version.
// Each migration runs in one transaction with its version update.
function migrate(db, dir = MIGRATIONS_DIR) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (const { number, file } of listMigrations(dir)) {
    if (number <= current) continue;
    const sql = fs.readFileSync(file, 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${number}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${path.basename(file)} failed: ${error.message}`);
    }
  }
}

function openDatabase(file, { migrationsDir = MIGRATIONS_DIR } = {}) {
  const db = new DatabaseSync(file);
  // Write-ahead logging lets a read continue while a write is in progress.
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db, migrationsDir);
  return db;
}

module.exports = { openDatabase, migrate };
