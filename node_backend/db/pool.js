/**
 * PostgreSQL connection pool.
 *
 * All database access in the Node backend goes through this module so that
 * connection handling, SSL, pooling and error reporting stay in one place.
 * SQL must never be written inside Express controllers — use the repositories.
 */
const { Pool } = require('pg');

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const HAS_DATABASE_URL = CONNECTION_STRING.trim().length > 0;

/**
 * Thrown whenever the database is missing or unreachable. Controllers and the
 * Express error middleware translate this into a 503 response so failures are
 * loud instead of silently returning stale/empty data.
 */
class DatabaseUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DatabaseUnavailableError';
    this.code = 'DB_UNAVAILABLE';
    this.cause = cause;
  }
}

function isLocalHost(connectionString) {
  return /@(localhost|127\.0\.0\.1|::1)[:/]/.test(connectionString);
}

/**
 * Hosted providers (Neon, Supabase, RDS, ...) require SSL. Honour an explicit
 * `sslmode=disable`, otherwise enable SSL for any non-local host.
 */
function resolveSsl(connectionString) {
  if (/sslmode=disable/i.test(connectionString)) return false;
  if (/sslmode=(require|prefer|verify-ca|verify-full)/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  if (isLocalHost(connectionString)) return false;
  return { rejectUnauthorized: false };
}

let pool = null;

if (HAS_DATABASE_URL) {
  pool = new Pool({
    connectionString: CONNECTION_STRING,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 15_000),
    ssl: resolveSsl(CONNECTION_STRING),
  });

  // Idle clients can be dropped by the server/proxy; log instead of crashing.
  pool.on('error', (err) => {
    console.error(`[db] Unexpected idle client error: ${err.message}`);
  });
}

function hasDatabase() {
  return pool !== null;
}

function assertDatabase() {
  if (!pool) {
    throw new DatabaseUnavailableError(
      'DATABASE_URL is not configured. Add it to node_backend/.env before starting the server.'
    );
  }
}

/**
 * Run a parameterized query. Always pass values through `params` — never
 * interpolate user input into the SQL string.
 */
async function query(text, params = []) {
  assertDatabase();
  try {
    return await pool.query(text, params);
  } catch (err) {
    // Connection-level failures are surfaced as a typed error so the HTTP layer
    // can respond with 503 rather than a generic 500.
    if (isConnectionError(err)) {
      throw new DatabaseUnavailableError(`Database query failed: ${err.message}`, err);
    }
    throw err;
  }
}

/**
 * Run a set of statements inside a transaction. The callback receives a
 * dedicated client so every statement shares the same connection.
 */
async function withTransaction(fn) {
  assertDatabase();
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    throw new DatabaseUnavailableError(`Could not acquire database connection: ${err.message}`, err);
  }

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error(`[db] ROLLBACK failed: ${rollbackErr.message}`);
    }
    if (isConnectionError(err)) {
      throw new DatabaseUnavailableError(`Database transaction failed: ${err.message}`, err);
    }
    throw err;
  } finally {
    client.release();
  }
}

function isConnectionError(err) {
  if (!err) return false;
  const code = String(err.code || '');
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'EPIPE'].includes(code)) {
    return true;
  }
  // 57P01 admin shutdown, 53300 too many connections, 3D000 db missing, 28P01 bad auth
  if (['57P01', '53300', '3D000', '28P01', '28000'].includes(code)) return true;
  return /terminat|connection|timeout|password authentication|does not exist/i.test(err.message || '');
}

/**
 * Verify connectivity. Returns a status object instead of throwing so callers
 * can decide how loudly to fail (server startup logs it prominently).
 */
async function testConnection() {
  if (!pool) {
    return {
      connected: false,
      configured: false,
      error: 'DATABASE_URL is not set',
    };
  }

  const startedAt = Date.now();
  try {
    const result = await query('SELECT current_database() AS database, version() AS version');
    return {
      connected: true,
      configured: true,
      database: result.rows[0].database,
      version: String(result.rows[0].version).split(' ').slice(0, 2).join(' '),
      latency_ms: Date.now() - startedAt,
    };
  } catch (err) {
    return { connected: false, configured: true, error: err.message };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  hasDatabase,
  query,
  withTransaction,
  testConnection,
  closePool,
  DatabaseUnavailableError,
  isConnectionError,
  getPool: () => pool,
};
