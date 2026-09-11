/**
 * Seed platforms and the compliance rule catalogue.
 *
 * Usage: node db/seed.js
 */
require('dotenv').config();

const { withTransaction, hasDatabase, closePool } = require('./pool');
const { seedPlatforms } = require('../repositories/platformRepository');
const { seedRules } = require('../repositories/ruleRepository');
const { PLATFORMS, RULES } = require('./seedData');

async function seed({ silent = false } = {}) {
  if (!hasDatabase()) {
    throw new Error('DATABASE_URL is not set. Add it to node_backend/.env first.');
  }

  await withTransaction(async (client) => {
    await seedPlatforms(PLATFORMS, client);
    await seedRules(RULES, client);
  });

  if (!silent) {
    console.log(`✅ Seeded ${PLATFORMS.length} platforms and ${RULES.length} rules`);
  }
}

async function main() {
  try {
    await seed();
  } catch (err) {
    console.error(`❌ Seed failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main();
}

module.exports = { seed };
