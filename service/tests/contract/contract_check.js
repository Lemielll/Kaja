'use strict';

/**
 * Minimal black-box contract checks shared by Prism and the running service.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4010/v1 node tests/contract/contract_check.js
 *
 * The only target-specific input is BASE_URL.  The tests deliberately cover
 * only responses that both a stateless OpenAPI mock and the real service must
 * provide; stateful idempotency is verified by verify_idempotency.js instead.
 */

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4010/v1').replace(/\/+$/, '');
let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    fail(`${options.method || 'GET'} ${path} returned invalid JSON`);
  }
  return { response, contentType, body };
}

function assertProblem(result, expectedStatus, label) {
  assert(result.response.status === expectedStatus, `${label} returned ${result.response.status}, expected ${expectedStatus}`);
  assert(result.contentType.toLowerCase().startsWith('application/problem+json'), `${label} must use application/problem+json`);
  for (const field of ['type', 'title', 'status', 'detail', 'instance']) {
    assert(Object.prototype.hasOwnProperty.call(result.body || {}, field), `${label} problem body is missing '${field}'`);
  }
  assert(result.body && result.body.status === expectedStatus, `${label} problem status field must be ${expectedStatus}`);
}

async function run() {
  console.log(`Contract target: ${baseUrl}`);

  const equipments = await request('/equipments');
  assert(equipments.response.status === 200, `GET /equipments returned ${equipments.response.status}, expected 200`);
  assert(equipments.contentType.toLowerCase().startsWith('application/json'), 'GET /equipments must use application/json');
  assert(Array.isArray(equipments.body), 'GET /equipments response must be an array');

  const invalidRentalList = await request('/rentals?status=not-a-contract-status');
  assertProblem(invalidRentalList, 400, 'GET /rentals with invalid status');

  const missingKey = await request('/rentals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assertProblem(missingKey, 400, 'POST /rentals without Idempotency-Key');

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }
  console.log('PASS: contract checks completed');
}

run().catch((error) => {
  console.error(`FAIL: contract target could not be checked: ${error.message}`);
  process.exitCode = 1;
});
