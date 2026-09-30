/**
 * HTTP Conditional Request Utilities
 * File: service/src/middleware/conditional.js
 * 
 * Session 5 - Step 8 & 9: ETag and If-Match support
 * 
 * Implements:
 * - ETag generation (GUIDE.md 7.5)
 * - If-None-Match → 304 (conditional read)
 * - If-Match → 412 (conditional write)
 * 
 * Requirements:
 * - ETag deterministic from body content (no timestamp)
 * - 304 responses: no body, but still have ETag + CORS headers
 * - If-Match comparison is strong (not weak)
 * - Support comma-separated values in If-None-Match
 */

'use strict';

const crypto = require('crypto');

/**
 * Generate ETag from response body.
 * Uses SHA-256 hash of JSON stringified body, base64url encoded.
 * Format: "abc123..." (quoted, strong ETag)
 * 
 * @param {object|array} body - Response body to hash
 * @returns {string} ETag value with quotes
 */
function etagOf(body) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('base64url')
    .slice(0, 22); // 22 chars = 132 bits of hash
  return `"${hash}"`;
}

/**
 * Check if If-None-Match header matches the current ETag.
 * Supports comma-separated values and weak tags (W/ prefix).
 * 
 * @param {string} ifNoneMatch - Value from If-None-Match header
 * @param {string} currentETag - Current ETag value
 * @returns {boolean} True if match (should return 304)
 */
function noneMatchHits(ifNoneMatch, currentETag) {
  if (!ifNoneMatch) return false;

  // Parse comma-separated ETags
  const tags = ifNoneMatch
    .split(',')
    .map(t => t.trim())
    .map(t => t.replace(/^W\//, '')); // Strip weak prefix

  // Wildcard matches everything
  if (tags.includes('*')) return true;

  // Remove quotes from current ETag for comparison
  const normalized = currentETag.replace(/^"|"$/g, '');
  return tags.some(t => t.replace(/^"|"$/g, '') === normalized);
}

/**
 * Check if If-Match header matches the current ETag.
 * This is for conditional writes (strong comparison only).
 * 
 * @param {string} ifMatch - Value from If-Match header
 * @param {string} currentETag - Current ETag value
 * @returns {boolean} True if match (write should proceed)
 */
function matchHits(ifMatch, currentETag) {
  if (!ifMatch) return false;

  // Parse comma-separated ETags (no weak tags for If-Match)
  const tags = ifMatch
    .split(',')
    .map(t => t.trim());

  // Wildcard matches everything
  if (tags.includes('*')) return true;

  // Exact match required (strong comparison)
  return tags.includes(currentETag);
}

/**
 * Middleware: Add conditional read support (ETag + 304).
 * Call this in GET handlers after body is ready.
 * 
 * Usage in route:
 *   const body = { items: [...] };
 *   const etag = conditional.etagOf(body);
 *   res.set('ETag', etag);
 *   res.set('Cache-Control', 'private, no-cache');
 *   if (conditional.check304(req, res, etag)) return;
 *   res.json(body);
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {string} etag - Current ETag
 * @returns {boolean} True if 304 sent (caller should return)
 */
function check304(req, res, etag) {
  const ifNoneMatch = req.get('If-None-Match');
  if (noneMatchHits(ifNoneMatch, etag)) {
    res.status(304).end();
    return true;
  }
  return false;
}

/**
 * Extract version number from database row.
 * Used to create ETag for single entities.
 * 
 * @param {object} row - Database row with version column
 * @returns {string} ETag based on version
 */
function etagFromVersion(row) {
  return `"${row.version}"`;
}

module.exports = {
  etagOf,
  etagFromVersion,
  noneMatchHits,
  matchHits,
  check304,
};
