/**
 * Dashboard repository — aggregate reads derived from product_evaluations.
 *
 * No scan_history table is required: recent scans, stats and trends are all
 * derived from the append-only evaluations, which keeps a single source of
 * truth for what was scanned and how it scored.
 */
import { query } from '../db/pool.js';

export async function getStats(client = null) {
  const exec = client ? client.query.bind(client) : query;
  const { rows } = await exec(
    `SELECT
        count(*)::int                                        AS products_scanned,
        COALESCE(floor(avg(e.final_score)), 0)::int          AS avg_score,
        COALESCE(sum(jsonb_array_length(e.violations)), 0)::int      AS total_violations,
        COALESCE(sum(jsonb_array_length(e.passed_rules)), 0)::int    AS passed_rules_count,
        COALESCE(sum(COALESCE(e.total_rules, 0)), 0)::int    AS total_rules,
        COALESCE(sum((
          SELECT count(*) FROM jsonb_array_elements(e.violations) v
           WHERE upper(coalesce(v->>'severity', 'MEDIUM')) = 'CRITICAL'
        )), 0)::int                                          AS total_critical,
        COALESCE(sum((
          SELECT count(*) FROM jsonb_array_elements(e.violations) v
           WHERE upper(coalesce(v->>'severity', 'MEDIUM')) = 'HIGH'
        )), 0)::int                                          AS total_high
       FROM product_evaluations e`
  );
  return rows[0];
}

export async function getRecentScans(limit = 10, client = null) {
  const exec = client ? client.query.bind(client) : query;
  const { rows } = await exec(
    `SELECT e.final_score, e.evaluated_at, p.name, pf.slug AS platform
       FROM product_evaluations e
       JOIN product_listings pl ON pl.id = e.product_listing_id
       JOIN platforms pf        ON pf.id = pl.platform_id
       JOIN products p          ON p.id = pl.product_id
      ORDER BY e.evaluated_at DESC, e.id DESC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

export default { getStats, getRecentScans };
