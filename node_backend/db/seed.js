/**
 * Seed platforms and the compliance rule catalogue.
 *
 * Usage: node db/seed.js
 */
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { withTransaction, hasDatabase, closePool } from './pool.js';
import { seedPlatforms } from '../repositories/platformRepository.js';
import { seedRules } from '../repositories/ruleRepository.js';
import { PLATFORMS, RULES } from './seedData.js';

const __filename = fileURLToPath(import.meta.url);

export async function seed({ silent = false } = {}) {
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

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export default { seed };
