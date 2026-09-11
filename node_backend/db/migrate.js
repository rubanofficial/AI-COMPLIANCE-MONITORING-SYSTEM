/**
 * Migration runner — applies db/schema.sql.
 *
 * The schema file is idempotent (CREATE TABLE/INDEX IF NOT EXISTS) and is also
 * recorded in schema_migrations so the applied version is visible.
 *
 * Usage: node db/migrate.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { query, withTransaction, hasDatabase, closePool } = require('./pool');

const SCHEMA_VERSION = '001_initial_schema';
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

async function migrate({ silent = false } = {}) {
  if (!hasDatabase()) {
    throw new Error('DATABASE_URL is not set. Add it to node_backend/.env first.');
  }

  const sql = fs.readFileSync(SCHEMA_FILE, 'utf-8');

  await withTransaction(async (client) => {
    await client.query(sql);
    await client.query(
      `INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING`,
      [SCHEMA_VERSION]
    );
  });

  const { rows } = await query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`
  );

  if (!silent) {
    console.log(`✅ Schema applied (${SCHEMA_VERSION})`);
    console.log(`   Tables: ${rows.map((r) => r.table_name).join(', ')}`);
  }

  return rows.map((r) => r.table_name);
}

async function main() {
  try {
    await migrate();
  } catch (err) {
    console.error(`❌ Migration failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrate, SCHEMA_VERSION };
