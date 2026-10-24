/**
 * One-time import of the legacy output.json into PostgreSQL.
 *
 * The old file stored `evaluated_products` (full evaluations) and `scan_history`
 * (denormalised scan log). Evaluations are imported as-is; scan history is
 * derived from the imported evaluations, which is how the new schema works.
 *
 * Usage:
 *   node db/importOutputJson.js                       # import ./output.json
 *   node db/importOutputJson.js --file other.json
 *   node db/importOutputJson.js --force               # re-import even if done before
 *   node db/importOutputJson.js --dry-run
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, hasDatabase, closePool } from './pool.js';
import * as scanRunRepository from '../repositories/scanRunRepository.js';
import * as evaluationRepository from '../repositories/evaluationRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMPORT_QUERY = 'import:output.json';

function parseArgs(argv) {
  const args = { file: path.join(__dirname, '..', 'output.json'), force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i];
    else if (arg === '--force') args.force = true;
    else if (arg === '--dry-run') args.dryRun = true;
  }
  return args;
}

export async function importOutputJson({ file, force = false, dryRun = false } = {}) {
  if (!hasDatabase()) {
    throw new Error('DATABASE_URL is not set. Add it to node_backend/.env first.');
  }

  if (!fs.existsSync(file)) {
    throw new Error(`Output file not found: ${file}`);
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const entries = Array.isArray(data.evaluated_products) ? data.evaluated_products : [];
  const legacyScans = Array.isArray(data.scan_history) ? data.scan_history : [];

  const existing = await query('SELECT id FROM scan_runs WHERE query = $1 LIMIT 1', [IMPORT_QUERY]);
  if (existing.rows.length > 0 && !force) {
    console.log(`ℹ️  output.json was already imported (scan_run ${existing.rows[0].id}). Use --force to re-import.`);
    return { imported: 0, skipped: entries.length, alreadyImported: true };
  }

  console.log(`📦 Importing ${entries.length} evaluations from ${file}`);
  if (legacyScans.length !== entries.length) {
    console.log(`   Note: ${legacyScans.length} legacy scan_history rows vs ${entries.length} evaluations — history is derived from evaluations.`);
  }

  if (dryRun) {
    console.log('   --dry-run: no rows written.');
    return { imported: 0, skipped: 0, dryRun: true };
  }

  const scanRun = await scanRunRepository.startScanRun({ query: IMPORT_QUERY });

  let imported = 0;
  let skipped = 0;

  // Oldest first so evaluation ids follow chronological order.
  for (const entry of entries) {
    const product = entry.product || {};
    const compliance = entry.compliance || {};

    if (!product.name && !product.product_name) {
      skipped++;
      continue;
    }
    if (compliance.score === undefined || compliance.score === null) {
      skipped++;
      continue;
    }

    try {
      await evaluationRepository.saveEvaluation({
        scanRunId: scanRun.id,
        product,
        compliance: {
          score: compliance.score,
          rule_score: compliance.rule_score ?? null,
          risk: compliance.risk || 'Medium',
          violations: compliance.violations || [],
          passed_rules: compliance.passed_rules || [],
          total_rules: compliance.total_rules ?? null,
        },
        aiAnalysis: entry.ai_analysis || null,
        platform: entry.platform || product.platform || 'unknown',
        deepScrapeAvailable: Boolean(
          entry.ai_analysis && entry.ai_analysis.deep_scrape_available
        ),
        evaluatedAt: entry.evaluated_at || null,
      });
      imported++;
    } catch (err) {
      console.warn(`   ⚠️  Skipped "${product.name}": ${err.message}`);
      skipped++;
    }
  }

  await scanRunRepository.finishScanRun(scanRun.id, {
    status: 'completed',
    duration_ms: 0,
    products_found: entries.length,
    products_evaluated: imported,
  });

  console.log(`✅ Imported ${imported} evaluations (${skipped} skipped) into scan_run ${scanRun.id}`);
  return { imported, skipped, scanRunId: scanRun.id };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    await importOutputJson(args);
  } catch (err) {
    console.error(`❌ Import failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export default { importOutputJson };
