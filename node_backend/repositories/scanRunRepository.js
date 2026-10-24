/**
 * Scan run repository — one row per /evaluate/stream request.
 *
 * Scan runs give evaluations a query context (what was searched, when, how long
 * it took, how many products were found) without duplicating evaluation data.
 */
import { query } from '../db/pool.js';

function executor(client) {
  return client ? client.query.bind(client) : query;
}

export async function startScanRun({ query: scanQuery }, client = null) {
  const { rows } = await executor(client)(
    `INSERT INTO scan_runs (query, status) VALUES ($1, 'running') RETURNING *`,
    [String(scanQuery || '').trim()]
  );
  return rows[0];
}

export async function updateScanRunProgress(id, { products_found: productsFound, products_evaluated: productsEvaluated }, client = null) {
  const { rows } = await executor(client)(
    `UPDATE scan_runs SET
       products_found     = COALESCE($2, products_found),
       products_evaluated = COALESCE($3, products_evaluated)
     WHERE id = $1
     RETURNING *`,
    [id, productsFound ?? null, productsEvaluated ?? null]
  );
  return rows[0] || null;
}

export async function finishScanRun(id, { status = 'completed', duration_ms: durationMs, products_found: productsFound, products_evaluated: productsEvaluated, error = null }, client = null) {
  const { rows } = await executor(client)(
    `UPDATE scan_runs SET
       status             = $2,
       finished_at        = now(),
       duration_ms        = COALESCE($3, duration_ms),
       products_found     = COALESCE($4, products_found),
       products_evaluated = COALESCE($5, products_evaluated),
       error              = $6
     WHERE id = $1
     RETURNING *`,
    [id, status, durationMs ?? null, productsFound ?? null, productsEvaluated ?? null, error]
  );
  return rows[0] || null;
}

export async function getById(id, client = null) {
  const { rows } = await executor(client)('SELECT * FROM scan_runs WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getRecent(limit = 10, client = null) {
  const { rows } = await executor(client)(
    `SELECT * FROM scan_runs ORDER BY started_at DESC, id DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export default { startScanRun, updateScanRunProgress, finishScanRun, getById, getRecent };
