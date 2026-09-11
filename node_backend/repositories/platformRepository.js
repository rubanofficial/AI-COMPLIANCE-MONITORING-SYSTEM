/**
 * Platform repository — persistence for marketplace platforms (Blinkit, Zepto).
 */
const { query } = require('../db/pool');

function executor(client) {
  return client ? client.query.bind(client) : query;
}

function titleCase(slug) {
  return String(slug || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

async function getAll(client = null) {
  const { rows } = await executor(client)('SELECT id, slug, name FROM platforms ORDER BY id');
  return rows;
}

async function getBySlug(slug, client = null) {
  const { rows } = await executor(client)(
    'SELECT id, slug, name FROM platforms WHERE slug = $1',
    [String(slug || '').toLowerCase()]
  );
  return rows[0] || null;
}

/**
 * Insert the platform if it does not exist yet, otherwise refresh its name.
 * Returns the platform row (id, slug, name).
 */
async function ensurePlatform(slug, name = null, client = null) {
  const normalised = String(slug || '').trim().toLowerCase();
  if (!normalised) {
    throw new Error('platformRepository.ensurePlatform requires a slug');
  }

  const { rows } = await executor(client)(
    `INSERT INTO platforms (slug, name)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, slug, name`,
    [normalised, name || titleCase(normalised)]
  );
  return rows[0];
}

async function seedPlatforms(platforms, client = null) {
  const seeded = [];
  for (const platform of platforms) {
    seeded.push(await ensurePlatform(platform.slug, platform.name, client));
  }
  return seeded;
}

module.exports = { getAll, getBySlug, ensurePlatform, seedPlatforms, titleCase };
