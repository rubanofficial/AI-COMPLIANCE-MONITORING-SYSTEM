/**
 * One-shot database setup: check connection, apply schema, seed data.
 *
 * Usage: npm run db:setup
 */
require('dotenv').config();

const { testConnection, closePool } = require('./pool');
const { migrate } = require('./migrate');
const { seed } = require('./seed');

async function main() {
  const status = await testConnection();

  if (!status.connected) {
    console.error('\n❌ Could not connect to PostgreSQL');
    console.error(`   ${status.configured ? status.error : status.error}`);
    console.error('   Set DATABASE_URL in node_backend/.env and try again.\n');
    process.exitCode = 1;
    await closePool();
    return;
  }

  console.log(`✅ Connected to PostgreSQL (${status.database}, ${status.latency_ms}ms)`);

  try {
    await migrate();
    await seed();
    console.log('\n🎉 Database ready.\n');
  } catch (err) {
    console.error(`\n❌ Setup failed: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main();
}
