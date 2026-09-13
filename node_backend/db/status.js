/**
 * Read-only database status report.
 *
 * Usage: npm run db:status
 */
require('dotenv').config();

const { query, testConnection, closePool } = require('./pool');

async function status() {
  const conn = await testConnection();
  if (!conn.connected) {
    console.error(`❌ Cannot reach PostgreSQL: ${conn.error}`);
    return 1;
  }

  console.log(`✅ PostgreSQL ${conn.version} — database "${conn.database}" (${conn.latency_ms}ms)\n`);

  const counts = await query(
    `SELECT
       (SELECT count(*)::int FROM platforms)           AS platforms,
       (SELECT count(*)::int FROM rules)               AS rules,
       (SELECT count(*)::int FROM products)            AS products,
       (SELECT count(*)::int FROM product_listings)    AS listings,
       (SELECT count(*)::int FROM scan_runs)           AS scan_runs,
       (SELECT count(*)::int FROM product_evaluations) AS evaluations`
  );
  console.log('Row counts:', JSON.stringify(counts.rows[0]));

  const runs = await query(
    `SELECT id, query, status, products_found, products_evaluated, duration_ms, started_at
       FROM scan_runs ORDER BY id DESC LIMIT 5`
  );
  console.log('\nLatest scan runs:');
  if (runs.rowCount === 0) {
    console.log('  (none)');
  } else {
    for (const r of runs.rows) {
      console.log(
        `  #${r.id} "${r.query}" ${r.status} found=${r.products_found} evaluated=${r.products_evaluated}` +
        ` ${r.duration_ms != null ? r.duration_ms + 'ms' : ''}`
      );
    }
  }

  const latestRun = runs.rows[0];
  if (latestRun) {
    const evals = await query(
      `SELECT e.id, e.final_score, e.rule_score, e.ai_score, e.risk,
              e.deep_scrape_available,
              jsonb_array_length(e.violations) AS violations,
              jsonb_array_length(e.passed_rules) AS passed,
              p.name AS product_name, pf.slug AS platform
         FROM product_evaluations e
         JOIN product_listings pl ON pl.id = e.product_listing_id
         JOIN platforms pf        ON pf.id = pl.platform_id
         JOIN products p          ON p.id = pl.product_id
        WHERE e.scan_run_id = $1
        ORDER BY e.id`,
      [latestRun.id]
    );
    console.log(`\nEvaluations from scan run #${latestRun.id}:`);
    if (evals.rowCount === 0) {
      console.log('  (none)');
    } else {
      for (const e of evals.rows) {
        console.log(
          `  #${e.id} [${e.platform}] ${e.product_name}` +
          ` — final=${e.final_score} rule=${e.rule_score} ai=${e.ai_score} risk=${e.risk}` +
          ` violations=${e.violations} passed=${e.passed} deep=${e.deep_scrape_available}`
        );
      }
    }
  }

  const dupes = await query(
    'SELECT identity_hash, count(*)::int AS c FROM products GROUP BY identity_hash HAVING count(*) > 1'
  );
  console.log('\nDuplicate product identities:', dupes.rowCount === 0 ? 'none ✅' : JSON.stringify(dupes.rows));

  const multi = await query(
    `SELECT p.name, count(*)::int AS listings
       FROM product_listings pl JOIN products p ON p.id = pl.product_id
      GROUP BY p.name HAVING count(*) > 1`
  );
  console.log(
    'Products with listings on multiple platforms:',
    multi.rowCount === 0 ? 'none' : multi.rows.map((r) => `${r.name} (${r.listings})`).join(', ')
  );

  return 0;
}

async function main() {
  let code = 1;
  try {
    code = await status();
  } catch (err) {
    console.error(`❌ Status failed: ${err.message}`);
  } finally {
    await closePool();
  }
  process.exitCode = code;
}

if (require.main === module) {
  main();
}

module.exports = { status };
