/**
 * Test Token & Mock JWKS Server Helper (Session 4: Step 11a)
 * File: service/tests/helpers/tokens.js
 *
 * Implements the isolated "Local test key" strategy:
 * - Generates an ephemeral RS256 keypair in-memory.
 * - Serves standard JWKS format from an ephemeral HTTP server on 127.0.0.1:9999.
 * - Signs tokens with matching issuer and audience for local CI tests without network.
 */

'use strict';

const { createServer } = require('node:http');
const { generateKeyPair, exportJWK, SignJWT } = require('jose');

let privateKey = null;
let publicKey = null;
let jwk = null;
let jwksServer = null;

/**
 * Initializes the RS256 key pair and starts the JWKS HTTP server.
 *
 * @param {number} [port=9999] - Port to bind the mock JWKS server
 * @param {string} [host='127.0.0.1'] - Host address
 * @returns {Promise<{ server: import('node:http').Server, jwk: object }>}
 */
async function setupKeyServer(port = 9999, host = '127.0.0.1') {
  try {
    if (!privateKey) {
      const pair = await generateKeyPair('RS256');
      publicKey = pair.publicKey;
      privateKey = pair.privateKey;

      const exportedJwk = await exportJWK(publicKey);
      jwk = {
        ...exportedJwk,
        kid: 'test-key',
        alg: 'RS256',
        use: 'sig',
      };
    }

    if (!jwksServer) {
      jwksServer = createServer((_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ keys: [jwk] }));
      });

      await new Promise((resolve, reject) => {
        jwksServer.once('error', reject);
        jwksServer.listen(port, host, resolve);
      });
    }

    return { server: jwksServer, jwk };
  } catch (err) {
    throw new Error(`[TEST HELPER] Failed to initialize JWKS server on ${host}:${port}: ${err.message}`);
  }
}

/**
 * Shuts down the mock JWKS server.
 *
 * @returns {Promise<void>}
 */
async function closeKeyServer() {
  if (jwksServer) {
    await new Promise((resolve) => jwksServer.close(resolve));
    jwksServer = null;
  }
}

/**
 * Generates and signs a test JWT with RS256.
 *
 * @param {string} subject - The principal subject identifier (e.g., 'ctr_contractorA')
 * @param {string[]|string} [scopes=[]] - Scopes granted to this token
 * @param {object} [extraClaims={}] - Additional claims to merge into the payload
 * @returns {Promise<string>} Signed compact JWT
 */
async function tokenFor(subject, scopes = [], extraClaims = {}) {
  if (!privateKey) {
    throw new Error('[TEST HELPER] Private key not initialized. Please invoke setupKeyServer() first.');
  }

  const scopeString = Array.isArray(scopes) ? scopes.join(' ') : String(scopes || '');
  const issuer = process.env.OIDC_ISSUER || 'https://test.local/';
  const audience = process.env.OIDC_AUDIENCE || 'kaja-api';

  try {
    const jwt = await new SignJWT({
      scope: scopeString,
      ...extraClaims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    return jwt;
  } catch (err) {
    throw new Error(`[TEST HELPER] Failed to sign test JWT for subject ${subject}: ${err.message}`);
  }
}

module.exports = {
  setupKeyServer,
  closeKeyServer,
  startJwksServer: setupKeyServer,
  stopJwksServer: closeKeyServer,
  tokenFor,
};
