/**
 * JWT Verification Module
 * File: service/src/auth/verify.js
 * Description: Cryptographic verification of access tokens.
 * 
 * JWKS is fetched once and cached at module level.
 * DO NOT create a new JWKSet per request (would cause 1 HTTP call per API call).
 */

'use strict';

const { createRemoteJWKSet, jwtVerify } = require('jose');
const config = require('../config');

// JWKS is fetched once and cached at module level
// This prevents unnecessary HTTP calls on every request
const jwks = createRemoteJWKSet(new URL(config.oidcJwksUri));

/**
 * Verifies an access token and returns its claims.
 * 
 * @param {string} raw - The raw JWT token (without "Bearer " prefix)
 * @returns {Promise<object>} - The verified token payload (claims)
 * @throws {Error} - If token is invalid, expired, or from wrong issuer
 */
async function verifyAccessToken(raw) {
  const { payload } = await jwtVerify(raw, jwks, {
    issuer: config.oidcIssuer,
    audience: config.oidcAudience,
    algorithms: ['RS256'], // Allowlist - closes "none" algorithm vulnerability
    clockTolerance: 5,
  });
  return payload;
}

module.exports = { verifyAccessToken };
