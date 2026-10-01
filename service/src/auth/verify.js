/**
 * JWT Verification Module
 * File: service/src/auth/verify.js
 * Description: Cryptographic verification of access tokens.
 * 
 * JWKS is fetched once and cached at module level.
 * DO NOT create a new JWKSet per request (would cause 1 HTTP call per API call).
 */

'use strict';

const config = require('../config');

// In Node 18+, jose is a pure ESM module. Use dynamic import() so it is
// fully compatible with CommonJS runtime on any Node.js version.
let josePromise = null;
let jwks = null;

async function getJose() {
  if (!josePromise) {
    josePromise = (async () => {
      const jose = await import('jose');
      jwks = jose.createRemoteJWKSet(new URL(config.oidcJwksUri));
      return jose;
    })();
  }
  return josePromise;
}

// Eagerly initiate import so JWKS is initialized ahead of first request
getJose().catch(() => {});

/**
 * Verifies an access token and returns its claims.
 * 
 * @param {string} raw - The raw JWT token (without "Bearer " prefix)
 * @returns {Promise<object>} - The verified token payload (claims)
 * @throws {Error} - If token is invalid, expired, or from wrong issuer
 */
async function verifyAccessToken(raw) {
  const jose = await getJose();
  const cleanIssuer = config.oidcIssuer ? config.oidcIssuer.replace(/\/+$/, '') : '';
  const allowedIssuers = Array.from(new Set([
    cleanIssuer,
    `${cleanIssuer}/`,
    cleanIssuer.replace(/^https:/, 'http:'),
    cleanIssuer.replace(/^http:/, 'https:'),
    'https://kaja-auth-production-6145.up.railway.app/realms/kaja',
    'https://kaja-auth-production-6145.up.railway.app/realms/kaja/',
    'http://localhost:8080/realms/kaja',
    'http://localhost:8080/realms/kaja/',
  ].filter(Boolean)));
  const allowedAudiences = Array.from(new Set([config.oidcAudience, 'account', 'kaja-api', 'web-app'].filter(Boolean)));
  const verifyOptions = {
    issuer: allowedIssuers.length ? allowedIssuers : undefined,
    audience: allowedAudiences,
    algorithms: ['RS256'], // Allowlist - closes "none" algorithm vulnerability
    clockTolerance: 10,
  };

  const { payload } = await jose.jwtVerify(raw, jwks, verifyOptions);
  return payload;
}

module.exports = { verifyAccessToken };
