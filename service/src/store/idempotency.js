/**
 * Idempotency Store Module
 * File: service/src/store/idempotency.js
 * Description: Data access layer for server-side idempotency persistence (Session 3: A.8).
 * Stored in PostgreSQL to survive process restarts.
 */

const crypto = require('crypto');
const db = require('./db');

/**
 * Compute SHA-256 hash string for an incoming request body object.
 * Uses sorted keys / deterministic stringification to avoid order discrepancy.
 * @param {Object|string} body - Request body
 * @returns {string} SHA-256 hexadecimal string
 */
function computeBodyHash(body) {
  const content = typeof body === 'string' ? body : JSON.stringify(body || {});
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Fetch an existing idempotency record by key from the database.
 * @param {string} key - The idempotency key (UUID)
 * @returns {Promise<Object|null>} Found record or null
 */
async function getIdempotencyRecord(key) {
  if (!key) {
    return null;
  }

  try {
    const sql = `
      SELECT key, request_hash, response_status, response_body, created_at
      FROM idempotency_keys
      WHERE key = $1
      LIMIT 1
    `;
    const result = await db.query(sql, [key]);
    return result.rows[0] || null;
  } catch (err) {
    console.error(`[STORE IDEMPOTENCY] Error fetching record for key ${key}: ${err.message}`);
    throw err;
  }
}

/**
 * Save a newly processed response against its idempotency key and request body hash.
 * @param {Object} params
 * @param {string} params.key - Idempotency key
 * @param {string} params.requestHash - SHA-256 hash of the request body
 * @param {number} params.responseStatus - HTTP status code (e.g. 201)
 * @param {Object} params.responseBody - Serialized response payload
 * @returns {Promise<Object>} The saved database record
 */
async function saveIdempotencyRecord({ key, requestHash, responseStatus, responseBody }) {
  if (!key || !requestHash || !responseStatus) {
    throw new Error('Key, requestHash, and responseStatus are required to save idempotency record');
  }

  try {
    const sql = `
      INSERT INTO idempotency_keys (key, request_hash, response_status, response_body, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING key, request_hash, response_status, response_body, created_at
    `;
    const params = [
      key,
      requestHash,
      responseStatus,
      JSON.stringify(responseBody),
    ];
    const result = await db.query(sql, params);
    console.log(`[STORE IDEMPOTENCY] Successfully recorded key: ${key}`);
    return result.rows[0];
  } catch (err) {
    console.error(`[STORE IDEMPOTENCY] Error saving idempotency record: ${err.message}`);
    throw err;
  }
}

module.exports = {
  computeBodyHash,
  getIdempotencyRecord,
  saveIdempotencyRecord,
};
