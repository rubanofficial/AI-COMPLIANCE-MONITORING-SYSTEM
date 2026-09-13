/**
 * Evaluation repository — append-only product evaluations, joined reads, and
 * transactional writes covering product -> listing -> evaluation.
 */
import { withTransaction, query } from '../db/pool.js';
import * as platformRepository from './platformRepository.js';
import * as productRepository from './productRepository.js';

function executor(client) {
  return client ? client.query.bind(client) : query;
}

/**
 * Persist one evaluation.
 *
 * @param {object}  input
 * @param {number}  [input.scanRunId]
 * @param {object}  input.product            Product snapshot returned to the frontend.
 * @param {object}  [input.deepProduct]      Full deep-scrape payload (stored as listing.raw_listing).
 * @param {object}  input.compliance         { score, rule_score, risk, violations, passed_rules, total_rules }
 * @param {object}  [input.aiAnalysis]       Full AI payload.
 * @param {string}  input.platform           Platform slug (blinkit/zepto).
 * @param {boolean} [input.deepScrapeAvailable]
 * @param {Date|string} [input.evaluatedAt]
 */
export async function saveEvaluation(input) {
  const {
    scanRunId = null,
    product,
    deepProduct = null,
    compliance,
    aiAnalysis = null,
    platform,
    deepScrapeAvailable = false,
    evaluatedAt = null,
  } = input;

  if (!product || !compliance) {
    throw new Error('saveEvaluation requires both product and compliance payloads');
  }

  return withTransaction(async (client) => {
    const platformRow = await platformRepository.ensurePlatform(platform, null, client);

    const productRow = await productRepository.findOrCreateProduct(
      {
        name: product.name || product.product_name,
        brand: deepProduct && deepProduct.brand,
        weight: product.weight || (deepProduct && deepProduct.weight),
        category: deepProduct && deepProduct.category,
        image_url: product.product_image,
      },
      client
    );

    const listingRow = await productRepository.upsertListing(
      {
        product_id: productRow.id,
        platform_id: platformRow.id,
        listing_key: productRepository.buildListingKey({
          product_url: product.product_url,
          platform_product_id: deepProduct && deepProduct.product_id,
          name: product.name || product.product_name,
        }),
        platform_product_id: deepProduct && deepProduct.product_id,
        product_url: product.product_url,
        price: product.price,
        mrp: product.mrp,
        discount: product.discount,
        availability: product.availability,
        weight: product.weight || (deepProduct && deepProduct.weight),
        store_name: product.store_name,
        image_url: product.product_image,
        raw_listing: deepProduct || product,
      },
      client
    );

    const { rows } = await executor(client)(
      `INSERT INTO product_evaluations (
          scan_run_id, product_listing_id, rule_score, ai_score, final_score, risk,
          deep_scrape_available, raw_product, violations, passed_rules, total_rules,
          ai_analysis, evaluated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, now()))
       RETURNING *`,
      [
        scanRunId,
        listingRow.id,
        compliance.rule_score ?? null,
        aiAnalysis && aiAnalysis.ai_score != null ? aiAnalysis.ai_score : null,
        compliance.score,
        compliance.risk,
        Boolean(deepScrapeAvailable),
        JSON.stringify(product),
        JSON.stringify(compliance.violations || []),
        JSON.stringify(compliance.passed_rules || []),
        compliance.total_rules ?? null,
        aiAnalysis ? JSON.stringify(aiAnalysis) : null,
        evaluatedAt,
      ]
    );

    return { evaluation: rows[0], product: productRow, listing: listingRow, platform: platformRow };
  });
}

/** Shared SELECT used by evaluated-product reads. */
export const EVALUATION_SELECT = `
  SELECT e.id,
         e.final_score,
         e.rule_score,
         e.ai_score,
         e.risk,
         e.deep_scrape_available,
         e.raw_product,
         e.violations,
         e.passed_rules,
         e.total_rules,
         e.ai_analysis,
         e.evaluated_at,
         pf.slug AS platform_slug,
         p.name  AS product_name,
         p.brand AS product_brand,
         p.weight AS product_weight
    FROM product_evaluations e
    JOIN product_listings pl ON pl.id = e.product_listing_id
    JOIN platforms pf       ON pf.id = pl.platform_id
    JOIN products p         ON p.id = pl.product_id`;

/** Convert a database row into the API shape the React frontend expects. */
export function rowToEvaluatedProduct(row) {
  return {
    product: row.raw_product,
    compliance: {
      score: row.final_score,
      rule_score: row.rule_score,
      risk: row.risk,
      violations: row.violations || [],
      passed_rules: row.passed_rules || [],
      total_rules: row.total_rules,
    },
    ai_analysis: row.ai_analysis,
    platform: (row.raw_product && row.raw_product.platform) || row.platform_slug,
    evaluated_at: row.evaluated_at instanceof Date ? row.evaluated_at.toISOString() : row.evaluated_at,
  };
}

export async function getEvaluatedProducts({ limit = null, offset = 0 } = {}, client = null) {
  const params = [];
  let sql = EVALUATION_SELECT;
  if (limit !== null) {
    sql += ' ORDER BY e.evaluated_at DESC, e.id DESC LIMIT $1 OFFSET $2';
    params.push(limit, offset);
  } else {
    sql += ' ORDER BY e.evaluated_at DESC, e.id DESC';
  }
  const { rows } = await executor(client)(sql, params);
  return rows.map(rowToEvaluatedProduct);
}

export async function countEvaluations(client = null) {
  const { rows } = await executor(client)('SELECT count(*)::int AS count FROM product_evaluations');
  return rows[0].count;
}

/** Scores per evaluation in the last `days` days — used to build the trend series. */
export async function getEvaluationRowsForRange(days, client = null) {
  const { rows } = await executor(client)(
    `SELECT e.final_score, e.evaluated_at
       FROM product_evaluations e
      WHERE e.evaluated_at >= (now() - ($1::text || ' days')::interval)
      ORDER BY e.evaluated_at ASC`,
    [days]
  );
  return rows;
}

export default {
  saveEvaluation,
  getEvaluatedProducts,
  countEvaluations,
  getEvaluationRowsForRange,
  rowToEvaluatedProduct,
  EVALUATION_SELECT,
};
