/**
 * Platform repository — persistence for marketplace platforms (Blinkit, Zepto).
 */
import { query } from '../db/pool.js';

function executor(client) {
  return client ? client.query.bind(client) : query;
}

export function titleCase(slug) {
  return String(slug || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export async function getAll(client = null) {
  const { rows } = await executor(client)('SELECT id, slug, name FROM platforms ORDER BY id');
  return rows;
}

export async function getBySlug(slug, client = null) {
  const { rows } = await executor(client)(
    'SELECT id, slug, name FROM platforms WHERE slug = $1',
    [String(slug || '').toLowerCase()]
  );
  return rows[0] || null;
}

export async function ensurePlatform(slug, name = null, client = null) {
  const cleanSlug = String(slug || '').toLowerCase().trim();
  const cleanName = name || titleCase(cleanSlug);
  const { rows } = await executor(client)(
    `INSERT INTO platforms (slug, name)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [cleanSlug, cleanName]
  );
  return rows[0];
}

export async function seedPlatforms(platforms, client = null) {
  const seeded = [];
  for (const platform of platforms) {
    seeded.push(await ensurePlatform(platform.slug, platform.name, client));
  }
  return seeded;
}

export default { getAll, getBySlug, ensurePlatform, seedPlatforms, titleCase };
