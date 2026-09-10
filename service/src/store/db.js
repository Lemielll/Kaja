/**
 * Database Connection Pool Module
 * File: service/src/store/db.js
 * Description: Manages PostgreSQL connection pool using pg.Pool.
 * All SQL execution passes through parameterized queries (prepared statements).
 */

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[DB FATAL] DATABASE_URL environment variable is not defined.');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB ERROR] Unexpected error on idle database client', err);
});

/**
 * Execute a parameterized query against the PostgreSQL pool.
 * @param {string} text - SQL query string with positional placeholders ($1, $2, ...)
 * @param {Array} [params] - Array of query parameters
 * @returns {Promise<import('pg').QueryResult>} Query result object
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[DB QUERY] Executed query in ${duration}ms | Rows: ${res.rowCount}`);
    }
    return res;
  } catch (err) {
    console.error(`[DB QUERY ERROR] Query failed: ${err.message}`);
    throw err;
  }
}

/**
 * Close the pool gracefully during process termination.
 * @returns {Promise<void>}
 */
async function close() {
  await pool.end();
  console.log('[DB POOL] PostgreSQL connection pool closed.');
}

module.exports = {
  query,
  pool,
  close,
};
