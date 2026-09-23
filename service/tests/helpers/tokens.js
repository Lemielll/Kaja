/**
 * Test Token & Mock JWKS Server Helper (Session 4: Step 11a)
 * File: service/tests/helpers/tokens.js
 *
 * Implements the isolated "Local test key" strategy:
 * - Uses a deterministic, extractable RS256 keypair for consistent multi-process CI execution.
 * - Serves standard JWKS format from an ephemeral HTTP server on 127.0.0.1:9999.
 * - Signs tokens with matching issuer and audience for local CI tests without network.
 */

'use strict';

const { createServer } = require('node:http');
const { importJWK, SignJWT } = require('jose');

const TEST_PUBLIC_JWK = {
  kty: 'RSA',
  kid: 'test-key',
  alg: 'RS256',
  use: 'sig',
  n: '1MMoG9aA1Op8lR6SUgxmOvAnv0EfphOgOGOdvNTLi11pJ1oCHv5b5TM2TvyWI2A1_0vxSBGlfbCSVsAEcsA2qe2QulCo8wA9UcUp4l13PTWFufr7r8Ij0uwd5jaqukvOESzTei2V_sV-rYIRXS60l4VmKyGkQ29uuK-ihu0ODvr1wSEMPZxt28k4y6sBLWDjqHrHFPbUKLCO1uWeGkEa08ljfh1MAJPMr0MFknP1X3dDJ_o62BdTMQWUKWTx4DTQNFajMJkbuljqXx9pDqogsIrF_DQTIW9g1kT99lnjdQnCMA2f59UZbYZcmuYilxXmQBpc06Z5so3Bahy50XZrnQ',
  e: 'AQAB',
};

const TEST_PRIVATE_JWK = {
  ...TEST_PUBLIC_JWK,
  d: 'FDGobJP8dbkCisjJtzM-v24B58Y6Rxy_wqUPLgK92wQfset6Hg-jEJW-xtp0iaEHyavJ7T7iMpQqykRpZ6wqGWYsrB0ccWFexenCeEjKGNYr_iNTS4hQDCSluy8JygAzQTARq8azNj5FMBoTTyvar4hVfSyGlxv21LK0PhLhQwyPLvYoTnTu5qeFhvX_xwVM3jjn8oK43vwI1iQOekCSTft10DA6Wi3LSyntCnM7yCEYRpiGQ-vCblKB3SYGGNZ0tVn0xFLpr9HH1I5yILbBaQ3KKEZS6xI2iaKQ9uIG1sRLaJLWfVsMcQqBQ4j1WxGgrUQEfa6LFTA9BQER1VDchQ',
  p: '6zhsP9yse9UvW_Kgcr67hnIhCAGryODGaQulNhWSmXsIkSHK701Epo4h3xQzVtyfEog1zbu181LU9sTWgdUCuSTlgxq6w8s6D7JastKQZgi6rryJ-fwBOzidwUNYM5FmS1rG7hpMXXX4XysdM6Ub7Jt_RtQUNnNJz_C5pKqxbss',
  q: '547WjGXhOXmH0MF3CfdOUzswUsrOAxpjEcWCCZFZP-aOic3zME3zhIcd_JhjdFpk1BsauJJKF_BQhCo-b26eMkkgyQRA5Xp0C-WCoR2RauB5vPqH9XLBeaXItoAnFM-FlASGrL8bizG5G7YtyD6NtLZQr-P7bJ6KYQJHn_5lGjc',
  dp: 'Uf5YFabZ5Uy59oZMEdOU0Nfl1cGnXR2lbCaoD4NTl_bAVL7_240GujxfaEDFaKj9NluOzcl6MniUTfTthVJ4YYuQCbR-mBO2iJQ2c5FczoSKdrC4NBD5aOhibWUJUOiFTQ02vPcj2Yxu6NXBlygd5MuLgWgaJ6TmfPq_67uooCM',
  dq: 'wmJ-aU39TCphgTVnoM4iymwdnOLzHlfAYuLSzwVdTu9VKQni5OILU226Fpo2oy5fBk_alqb33DC45rovv4u08bHB-_2-HOY3FOWOS4Ju2LGogKQwDjRPhrdNTyc1p5quIBvMkqe7j5YmNsUwmbEpdFK4WW-hWQWeVOF9DyqX5PE',
  qi: 'y--7JKDCiaPftD5qjwdNj4CfS2MEpPtYlsfRPgfC5bT95RlmHHnTMpqVl0ep2Qi-D6V3bamCBYq0l_x4z2eH5eCQ4IQVX8VdismjM9nyyQ-y0CnuV1AKdSosLYmIpyEh5MLhxErvQDDKYFJWQD_ghTtWYAa1IYnXycVUhkux4Sg',
};

let privateKeyPromise = null;
let jwksServer = null;

function getPrivateKey() {
  if (!privateKeyPromise) {
    privateKeyPromise = importJWK(TEST_PRIVATE_JWK, 'RS256');
  }
  return privateKeyPromise;
}

/**
 * Initializes and starts the JWKS HTTP server serving the public test key.
 *
 * @param {number} [port=9999] - Port to bind the mock JWKS server
 * @param {string} [host='127.0.0.1'] - Host address
 * @returns {Promise<{ server: import('node:http').Server|null, jwk: object }>}
 */
async function setupKeyServer(port = 9999, host = '127.0.0.1') {
  if (jwksServer) {
    return { server: jwksServer, jwk: TEST_PUBLIC_JWK };
  }

  jwksServer = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ keys: [TEST_PUBLIC_JWK] }));
  });

  return new Promise((resolve, reject) => {
    jwksServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Already running in another process or daemon, which is fine
        jwksServer = null;
        return resolve({ server: null, jwk: TEST_PUBLIC_JWK });
      }
      reject(new Error(`[TEST HELPER] JWKS server error on ${host}:${port}: ${err.message}`));
    });

    jwksServer.listen(port, host, () => {
      resolve({ server: jwksServer, jwk: TEST_PUBLIC_JWK });
    });
  });
}

/**
 * Shuts down the mock JWKS server if owned by this process.
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
  const privateKey = await getPrivateKey();
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
      .setExpirationTime('15m')
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
  TEST_PUBLIC_JWK,
};
