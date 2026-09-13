/**
 * Product repository — stable product identity (`products`) and per-platform
 * listing data (`product_listings`).
 *
 * Product identity is deliberately platform-independent: the same product
 * scraped from Zepto and Blinkit maps to one `products` row with two listings.
 */
import crypto from 'crypto';
import { query } from '../db/pool.js';

function executor(client) {
  return client ? client.query.bind(client) : query;
}

/** Trim and collapse whitespace; treat placeholder values as null. */
export function normaliseText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['n/a', 'na', 'null', 'undefined', 'unknown', '-'].includes(text.toLowerCase())) {
    return null;
  }
  return text;
}

export function toNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/[^0-9.-]/g, '');
  if (!text) return null;
  const num = Number.parseFloat(text);
  return Number.isFinite(num) ? num : null;
}

/**
 * Stable identity for a product across scans and platforms.
 * Based on normalised name + weight (weight is folded in only when known).
 */
export function computeIdentityHash({ name, weight } = {}) {
  const parts = [normaliseText(name) || '', normaliseText(weight) || ''];
  const key = parts.map((p) => p.toLowerCase()).join('|');
  return crypto.createHash('sha1').update(key).digest('hex');
}

/** Stable, platform-specific key for a listing (URL -> platform product id -> name). */
export function buildListingKey({ product_url: productUrl, platform_product_id: platformProductId, name } = {}) {
  const url = normaliseText(productUrl);
  if (url) return url;
  const pid = normaliseText(platformProductId);
  if (pid) return `id:${pid}`;
  return `name:${(normaliseText(name) || 'unknown').toLowerCase()}`;
}

/**
 * Find the product with this identity or create it. Existing rows are refreshed
 * with any newly discovered fields (brand/weight/category/image).
 */
export async function findOrCreateProduct(product, client = null) {
  const name = normaliseText(product.name || product.product_name);
  if (!name) {
    throw new Error('Cannot persist a product without a name');
  }

  const brand = normaliseText(product.brand);
  const weight = normaliseText(product.weight);
  const category = normaliseText(product.category);
  const imageUrl = normaliseText(product.image_url || product.product_image);

  const { rows } = await executor(client)(
    `INSERT INTO products (identity_hash, name, brand, weight, category, image_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (identity_hash) DO UPDATE SET
       name       = EXCLUDED.name,
       brand      = COALESCE(EXCLUDED.brand, products.brand),
       weight     = COALESCE(EXCLUDED.weight, products.weight),
       category   = COALESCE(EXCLUDED.category, products.category),
       image_url  = COALESCE(EXCLUDED.image_url, products.image_url),
       updated_at = now()
     RETURNING *`,
    [computeIdentityHash({ name, weight }), name, brand, weight, category, imageUrl]
  );
  return rows[0];
}

/**
 * Insert or refresh a platform listing. `last_seen_at` moves forward on every
 * scan; richer fields discovered by a deep scrape are merged in.
 */
export async function upsertListing(listing, client = null) {
  const { rows } = await executor(client)(
    `INSERT INTO product_listings (
        product_id, platform_id, listing_key, platform_product_id, product_url,
        price, mrp, discount, availability, weight, store_name, image_url, raw_listing
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (product_id, platform_id, listing_key) DO UPDATE SET
       platform_product_id = COALESCE(EXCLUDED.platform_product_id, product_listings.platform_product_id),
       product_url         = COALESCE(EXCLUDED.product_url, product_listings.product_url),
       price               = COALESCE(EXCLUDED.price, product_listings.price),
       mrp                 = COALESCE(EXCLUDED.mrp, product_listings.mrp),
       discount            = COALESCE(EXCLUDED.discount, product_listings.discount),
       availability        = EXCLUDED.availability,
       weight              = COALESCE(EXCLUDED.weight, product_listings.weight),
       store_name          = COALESCE(EXCLUDED.store_name, product_listings.store_name),
       image_url           = COALESCE(EXCLUDED.image_url, product_listings.image_url),
       raw_listing         = COALESCE(EXCLUDED.raw_listing, product_listings.raw_listing),
       last_seen_at        = now()
     RETURNING *`,
    [
      listing.product_id,
      listing.platform_id,
      listing.listing_key,
      normaliseText(listing.platform_product_id),
      normaliseText(listing.product_url),
      toNumber(listing.price),
      toNumber(listing.mrp),
      toNumber(listing.discount),
      normaliseText(listing.availability) || 'unknown',
      normaliseText(listing.weight),
      normaliseText(listing.store_name),
      normaliseText(listing.image_url),
      listing.raw_listing ? JSON.stringify(listing.raw_listing) : null,
    ]
  );
  return rows[0];
}

/** Fetch a listing joined with its product and platform (used by the importer). */
export async function getListingById(listingId, client = null) {
  const { rows } = await executor(client)(
    `SELECT pl.*, pf.slug AS platform_slug, p.name AS product_name
       FROM product_listings pl
       JOIN platforms pf ON pf.id = pl.platform_id
       JOIN products p ON p.id = pl.product_id
      WHERE pl.id = $1`,
    [listingId]
  );
  return rows[0] || null;
}

export async function countProducts(client = null) {
  const { rows } = await executor(client)('SELECT count(*)::int AS count FROM products');
  return rows[0].count;
}

export default {
  normaliseText,
  toNumber,
  computeIdentityHash,
  buildListingKey,
  findOrCreateProduct,
  upsertListing,
  getListingById,
  countProducts,
};
