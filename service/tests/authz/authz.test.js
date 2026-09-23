/**
 * Automated Authorization & Access Control Test Suite (Session 4: Step 11)
 * File: service/tests/authz/authz.test.js
 *
 * Implements IEEE 829 Test Specification for 3-layer authorization boundary testing:
 * - Layer 1 (Authentication): Token validation, tampering detection, and public health checks
 * - Layer 2 (Scope Checking): Enforces scope requirements before handler execution (403 Forbidden)
 * - Layer 3 (Object Ownership): Enforces caller-object relationship (identical 404 Not Found)
 *
 * Boundary Matrix:
 * 1. Contractor A reads Contractor B's rental -> 404 (Layer 3)
 * 2. Operator B submits inspection with Operator A's identity -> 404 & no state mutation (Layer 3)
 * 3. Contractor calls operator-only inspection endpoint -> 403 (Layer 2)
 * 4. Warehouse Admin A reads rental assigned to Warehouse Admin B -> 404 (Layer 3)
 * 5. Request without token / tampered token -> 401, while /health remains 200 (Layer 1)
 */

'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');

// Configure test environment variables before requiring configuration/app
process.env.PORT = '4021';
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';
process.env.OIDC_ISSUER = 'https://test.local/';
process.env.OIDC_JWKS_URI = 'http://127.0.0.1:9999/jwks.json';
process.env.OIDC_AUDIENCE = 'kaja-api';
process.env.NODE_ENV = 'test';

const { setupKeyServer, closeKeyServer, tokenFor } = require('../helpers/tokens');
const db = require('../../src/store/db');
const app = require('../../src/app');

// In-memory test store
const testStore = {
  rentals: [
    {
      id: 'rnt_ContractorA',
      equipment_id: 'eqp_8X2kAB',
      contractor_id: 'ctr_contractorA',
      warehouse_admin_id: 'adm_warehouseA',
      status: 'approved',
      start_time: '2026-09-15T08:00:00Z',
      end_time: '2026-09-18T17:00:00Z',
      deposit_amount: 150000,
      currency: 'USD',
      created_at: '2026-09-10T15:00:00Z',
      updated_at: '2026-09-11T09:30:00Z',
    },
    {
      id: 'rnt_ContractorB',
      equipment_id: 'eqp_9Y3mCD',
      contractor_id: 'ctr_contractorB',
      warehouse_admin_id: 'adm_warehouseB',
      status: 'approved',
      start_time: '2026-09-20T08:00:00Z',
      end_time: '2026-09-25T17:00:00Z',
      deposit_amount: 250000,
      currency: 'USD',
      created_at: '2026-09-12T10:00:00Z',
      updated_at: '2026-09-12T10:00:00Z',
    },
  ],
  inspections: [],
  idempotency_keys: [],
};

// Route db.query to in-memory store
db.query = async (text, params = []) => {
  const query = text.trim();

  // SELECT FROM rentals WHERE id = $1
  if (/SELECT[\s\S]*FROM\s+rentals\s+WHERE\s+id\s*=\s*\$1/i.test(query)) {
    const row = testStore.rentals.find((r) => r.id === params[0]);
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  }

  // SELECT FROM rentals with optional filters
  if (/SELECT[\s\S]*FROM\s+rentals/i.test(query)) {
    let rows = [...testStore.rentals];
    if (params.length > 0) {
      // Basic simulation for filtered query
      rows = rows.filter((r) => {
        let match = true;
        params.forEach((p) => {
          if (p === 'approved' && r.status !== 'approved') match = false;
          if (p.startsWith('ctr_') && r.contractor_id !== p) match = false;
          if (p.startsWith('adm_') && r.warehouse_admin_id !== p) match = false;
        });
        return match;
      });
    }
    return { rows, rowCount: rows.length };
  }

  // SELECT FROM idempotency_keys WHERE key = $1
  if (/SELECT[\s\S]*FROM\s+idempotency_keys\s+WHERE\s+key\s*=\s*\$1/i.test(query)) {
    const row = testStore.idempotency_keys.find((k) => k.key === params[0]);
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  }

  // INSERT INTO idempotency_keys
  if (/INSERT\s+INTO\s+idempotency_keys/i.test(query)) {
    const record = {
      key: params[0],
      request_hash: params[1],
      response_status: params[2],
      response_body: params[3],
    };
    testStore.idempotency_keys.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // SELECT FROM inspections WHERE rental_id = $1 AND inspected_at = $2
  if (/WHERE\s+rental_id\s*=\s*\$1\s+AND\s+inspected_at\s*=\s*\$2/i.test(query)) {
    const row = testStore.inspections.find((i) => i.rental_id === params[0] && i.inspected_at === params[1]);
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  }

  // INSERT INTO inspections
  if (/INSERT\s+INTO\s+inspections/i.test(query)) {
    const row = {
      id: params[0],
      rental_id: params[1],
      equipment_id: params[2],
      operator_id: params[3],
      status: params[4],
      inspected_at: params[5],
      notes: params[6],
      defect_summary: params[7] || null,
    };
    testStore.inspections.push(row);
    return { rows: [row], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
};

/**
 * Helper to dispatch HTTP requests to the test server.
 */
async function request(baseUrl, path, { method = 'GET', headers = {}, body = null } = {}) {
  const url = `${baseUrl}${path}`;
  const reqHeaders = { ...headers };
  let payload = null;

  if (body) {
    payload = JSON.stringify(body);
    reqHeaders['Content-Type'] = 'application/json';
    reqHeaders['Content-Length'] = Buffer.byteLength(payload);
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: payload,
  });

  const status = res.status;
  const headerMap = {};
  res.headers.forEach((val, key) => {
    headerMap[key.toLowerCase()] = val;
  });

  let responseBody = null;
  const text = await res.text();
  try {
    responseBody = JSON.parse(text);
  } catch {
    responseBody = text;
  }

  return { status, headers: headerMap, body: responseBody };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('SESSION 4: AUTOMATED AUTHORIZATION & ACCESS CONTROL TEST SUITE');
  console.log('================================================================\n');

  // Step 1: Start local mock JWKS server (Step 11a)
  await setupKeyServer(9999, '127.0.0.1');
  console.log('[TEST SETUP] Mock JWKS server running on http://127.0.0.1:9999');

  // Step 2: Start Express test application on port 4021
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(4021, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:4021';
  console.log(`[TEST SETUP] Application under test running on ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------------------
    // TC-AUTHZ-05: Layer 1 - Authentication & Integrity Verification
    // -------------------------------------------------------------------------
    console.log('[RUN] TC-AUTHZ-05: Layer 1 (Authentication Integrity)...');

    // 5a. Public endpoint /health without token must return 200
    const resHealth = await request(baseUrl, '/health');
    assert.equal(resHealth.status, 200, 'Public /health must return 200 without token');
    assert.equal(resHealth.body.status, 'pass');

    // 5b. Protected endpoint without Authorization header must return 401
    const resNoAuth = await request(baseUrl, '/v1/rentals');
    assert.equal(resNoAuth.status, 401, 'Request without Authorization header must return 401');
    assert.match(
      resNoAuth.headers['www-authenticate'] || '',
      /Bearer error="invalid_token"/i,
      '401 response must include WWW-Authenticate with invalid_token',
    );

    // 5c. Protected endpoint with malformed/tampered token must return 401
    const validToken = await tokenFor('ctr_contractorA', ['rentals:read']);
    // Tamper with payload segment
    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'attacker', exp: 9999999999 })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const resTampered = await request(baseUrl, '/v1/rentals', {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    assert.equal(resTampered.status, 401, 'Tampered token signature mismatch must return 401');

    console.log('  PASS: TC-AUTHZ-05 (Layer 1: Unauthenticated & tampered tokens rejected with 401, /health remains 200)\n');

    // -------------------------------------------------------------------------
    // TC-AUTHZ-03: Layer 2 - Scope Enforcement
    // -------------------------------------------------------------------------
    console.log('[RUN] TC-AUTHZ-03: Layer 2 (Scope Enforcement)...');

    // Contractor token has rentals:read, rentals:write, equipment:read, but NOT inspections:write
    const contractorToken = await tokenFor('ctr_contractorA', ['rentals:read', 'rentals:write']);

    const resScopeFail = await request(baseUrl, '/v1/rentals/rnt_ContractorA/inspections', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${contractorToken}`,
        'Idempotency-Key': 'a1111111-2222-3333-4444-555555555555',
      },
      body: {
        equipmentId: 'eqp_8X2kAB',
        operatorId: 'ctr_contractorA',
        status: 'pass',
        inspectedAt: '2026-09-16T10:00:00Z',
        notes: 'Unauthorized contractor inspection attempt',
      },
    });

    assert.equal(resScopeFail.status, 403, 'Principal lacking inspections:write must receive 403 Forbidden');
    assert.match(
      resScopeFail.headers['www-authenticate'] || '',
      /insufficient_scope.*inspections:write/i,
      '403 response must include WWW-Authenticate indicating missing scope',
    );
    assert.equal(resScopeFail.body.title, 'Insufficient scope');

    console.log('  PASS: TC-AUTHZ-03 (Layer 2: Scope enforcement returns 403 before handler execution)\n');

    // -------------------------------------------------------------------------
    // TC-AUTHZ-01: Layer 3 - Object Ownership & Non-Enumeration (Read)
    // -------------------------------------------------------------------------
    console.log('[RUN] TC-AUTHZ-01: Layer 3 (Object Ownership - Contractor Read)...');

    // Contractor A reads Contractor A's own rental -> 200 OK
    const resOwnRental = await request(baseUrl, '/v1/rentals/rnt_ContractorA', {
      headers: { Authorization: `Bearer ${contractorToken}` },
    });
    assert.equal(resOwnRental.status, 200, 'Contractor A reading own rental must return 200');
    assert.equal(resOwnRental.body.id, 'rnt_ContractorA');
    assert.equal(resOwnRental.body.contractorId, 'ctr_contractorA');

    // Contractor A reads Contractor B's rental -> MUST return 404 (NOT 403)
    const resOtherRental = await request(baseUrl, '/v1/rentals/rnt_ContractorB', {
      headers: { Authorization: `Bearer ${contractorToken}` },
    });
    assert.equal(resOtherRental.status, 404, 'Contractor A reading Contractor B rental must return 404 Not Found');

    // Non-existent rental -> MUST return 404
    const resNonExistent = await request(baseUrl, '/v1/rentals/rnt_DoesNotEx', {
      headers: { Authorization: `Bearer ${contractorToken}` },
    });
    assert.equal(resNonExistent.status, 404, 'Non-existent rental must return 404');

    // CRITICAL: Both 404 responses must be completely identical (prevent ID enumeration)
    assert.equal(
      resOtherRental.body.type,
      resNonExistent.body.type,
      'Problem type for unauthorized object must match non-existent object',
    );
    assert.equal(
      resOtherRental.body.title,
      resNonExistent.body.title,
      'Problem title for unauthorized object must match non-existent object',
    );
    assert.equal(
      resOtherRental.body.status,
      resNonExistent.body.status,
      'Problem status for unauthorized object must match non-existent object',
    );
    assert.equal(
      resOtherRental.body.contractorId,
      undefined,
      'Response must never leak contractorId or object fields on failed ownership check',
    );

    console.log('  PASS: TC-AUTHZ-01 (Layer 3: Contractor A reading B returns 404 identical to non-existent ID)\n');

    // -------------------------------------------------------------------------
    // TC-AUTHZ-04: Layer 3 - Tenant/Admin Ownership (Read)
    // -------------------------------------------------------------------------
    console.log('[RUN] TC-AUTHZ-04: Layer 3 (Tenant / Warehouse Admin Boundary)...');

    const adminAToken = await tokenFor('adm_warehouseA', ['rentals:read', 'equipment:read']);

    // Admin A reads rental assigned to Warehouse A -> 200 OK
    const resAdminAOwn = await request(baseUrl, '/v1/rentals/rnt_ContractorA', {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(resAdminAOwn.status, 200, 'Warehouse Admin A reading assigned rental returns 200');

    // Admin A reads rental assigned to Warehouse B -> 404 Not Found (not 403)
    const resAdminAOther = await request(baseUrl, '/v1/rentals/rnt_ContractorB', {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert.equal(resAdminAOther.status, 404, 'Warehouse Admin A reading Warehouse B rental returns 404');

    console.log('  PASS: TC-AUTHZ-04 (Layer 3: Warehouse Admin A reading Branch B returns 404)\n');

    // -------------------------------------------------------------------------
    // TC-AUTHZ-02: Layer 3 - Object Ownership & State Mutation (Write)
    // -------------------------------------------------------------------------
    console.log('[RUN] TC-AUTHZ-02: Layer 3 (Object Ownership & No Mutation on Write)...');

    const operatorAToken = await tokenFor('opr_operatorA', ['inspections:write']);
    const operatorBToken = await tokenFor('opr_operatorB', ['inspections:write']);

    const initialInspectionsCount = testStore.inspections.length;

    // Operator B attempts to submit an inspection impersonating Operator A
    const resOperatorImpersonate = await request(baseUrl, '/v1/rentals/rnt_ContractorA/inspections', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorBToken}`, // Caller is Operator B
        'Idempotency-Key': 'b2222222-3333-4444-5555-666666666666',
      },
      body: {
        equipmentId: 'eqp_8X2kAB',
        operatorId: 'opr_operatorA', // Body claims Operator A
        status: 'pass',
        inspectedAt: '2026-09-17T11:00:00Z',
        notes: 'Impersonation inspection attempt',
      },
    });

    assert.equal(
      resOperatorImpersonate.status,
      404,
      'Operator B submitting inspection as Operator A must return 404',
    );
    // CRITICAL: Ensure no mutation took place in the database
    assert.equal(
      testStore.inspections.length,
      initialInspectionsCount,
      'Database mutation check: No inspection record should be inserted on 404',
    );

    // Operator A submitting legitimate inspection as Operator A -> 201 Created
    const resOperatorValid = await request(baseUrl, '/v1/rentals/rnt_ContractorA/inspections', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${operatorAToken}`,
        'Idempotency-Key': 'c3333333-4444-5555-6666-777777777777',
      },
      body: {
        equipmentId: 'eqp_8X2kAB',
        operatorId: 'opr_operatorA',
        status: 'pass',
        inspectedAt: '2026-09-17T11:30:00Z',
        notes: 'Legitimate field inspection passed',
      },
    });

    assert.equal(resOperatorValid.status, 201, 'Operator A submitting own inspection returns 201');
    assert.equal(testStore.inspections.length, initialInspectionsCount + 1, 'Inspection successfully persisted');

    console.log('  PASS: TC-AUTHZ-02 (Layer 3: Unauthorized write returns 404 and prevents DB mutation)\n');

    console.log('================================================================');
    console.log('ALL 5 AUTHORIZATION & ACCESS CONTROL BOUNDARY TESTS PASSED!');
    console.log('================================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closeKeyServer();
  }
}

runTestSuite().catch((err) => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
