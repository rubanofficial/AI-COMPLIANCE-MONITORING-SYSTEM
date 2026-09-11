/**
 * Rule repository — persistence for the compliance rule catalogue.
 */
const { query } = require('../db/pool');

function executor(client) {
  return client ? client.query.bind(client) : query;
}

async function getAll({ enabledOnly = false } = {}, client = null) {
  const where = enabledOnly ? 'WHERE enabled = true' : '';
  const { rows } = await executor(client)(
    `SELECT id, code, name, category, severity, penalty, regulatory_ref AS "regulatory_ref",
            enabled, created_at AS "created_at", updated_at AS "updated_at"
       FROM rules ${where}
      ORDER BY code`
  );
  return rows;
}

async function getByCode(code, client = null) {
  const { rows } = await executor(client)('SELECT * FROM rules WHERE code = $1', [code]);
  return rows[0] || null;
}

async function upsertRule(rule, client = null) {
  const { rows } = await executor(client)(
    `INSERT INTO rules (code, name, category, severity, penalty, regulatory_ref, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (code) DO UPDATE SET
       name           = EXCLUDED.name,
       category       = EXCLUDED.category,
       severity       = EXCLUDED.severity,
       penalty        = EXCLUDED.penalty,
       regulatory_ref = EXCLUDED.regulatory_ref,
       enabled        = EXCLUDED.enabled,
       updated_at     = now()
     RETURNING *`,
    [
      rule.code,
      rule.name,
      rule.category || null,
      rule.severity || null,
      rule.penalty ?? 0,
      rule.regulatory_ref || rule.regulatoryRef || null,
      rule.enabled !== false,
    ]
  );
  return rows[0];
}

async function seedRules(rules, client = null) {
  const seeded = [];
  for (const rule of rules) {
    seeded.push(await upsertRule(rule, client));
  }
  return seeded;
}

module.exports = { getAll, getByCode, upsertRule, seedRules };
