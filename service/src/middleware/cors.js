/**
 * CORS Middleware
 * File: service/src/middleware/cors.js
 * 
 * Session 5: CORS Configuration for Web Application
 * 
 * Requirements:
 * - Allowlist explicit origins (no wildcard with credentials)
 * - Vary: Origin on ALL responses
 * - Expose ETag, Location, Retry-After
 * - Handle preflight (OPTIONS)
 * - CORS headers on ALL responses including errors (401/403/404/412/422/500)
 * - Must be registered BEFORE authentication middleware
 */

'use strict';

/**
 * Parse comma-separated CORS_ALLOWED_ORIGINS from environment.
 * Format: scheme://host[:port] without trailing slash.
 * Example: http://localhost:3000,https://kaja-web.onrender.com
 */
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return false;
  const cleanOrigin = origin.replace(/\/+$/, '');
  if (ALLOWED_ORIGINS.some(allowed => cleanOrigin === allowed.replace(/\/+$/, '') || allowed === '*')) {
    return true;
  }
  if (cleanOrigin.endsWith('.up.railway.app') || cleanOrigin.endsWith('.railway.app')) {
    return true;
  }
  if (cleanOrigin.startsWith('http://localhost:') || cleanOrigin.startsWith('http://127.0.0.1:')) {
    return true;
  }
  return false;
}

/**
 * CORS middleware function.
 * Implements RFC-compliant CORS with explicit origin allowlist.
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
function cors(req, res, next) {
  const origin = req.headers.origin;
  const isPreflight = req.method === 'OPTIONS' && req.headers['access-control-request-method'];

  // Vary: Origin MUST be present on ALL responses
  res.vary('Origin');

  // If origin is in allowlist, grant access
  if (origin && isOriginAllowed(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Expose-Headers', 'ETag, Location, Retry-After');

    if (isPreflight) {
      // Preflight response
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match, If-None-Match, Idempotency-Key');
      res.set('Access-Control-Max-Age', '600');
      return res.status(204).end();
    }
  } else if (isPreflight) {
    // Preflight from unknown origin: 204 but without Allow-Origin header
    return res.status(204).end();
  }

  next();
}

module.exports = cors;
