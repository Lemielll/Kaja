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
  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  assert(expectedStatuses.includes(result.response.status), `${label} returned ${result.response.status}, expected one of ${expectedStatuses.join(', ')}`);
  assert(result.contentType.toLowerCase().startsWith('application/problem+json'), `${label} must use application/problem+json`);
  for (const field of ['type', 'title', 'status', 'detail', 'instance']) {
    assert(Object.prototype.hasOwnProperty.call(result.body || {}, field), `${label} problem body is missing '${field}'`);
  }
  assert(result.body && result.body.status === result.response.status, `${label} problem status field must match the HTTP status`);
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
    headers: {
      'content-type': 'application/json',
      Prefer: 'code=400',
    },
    body: JSON.stringify({
      equipmentId: 'eqp_8X2kAB',
      contractorId: 'ctr_72Xp9C',
      warehouseAdminId: 'adm_19Lq2f',
      startTime: '2027-01-15T08:00:00Z',
      endTime: '2027-01-18T17:00:00Z',
      depositAmount: 150000,
      currency: 'USD',
    }),
  });
  assertProblem(missingKey, [400, 422], 'POST /rentals without Idempotency-Key');

  const missingInspectionKey = await request('/rentals/rnt_3MnB7xP/inspections', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Prefer: 'code=400',
    },
    body: JSON.stringify({
      equipmentId: 'eqp_8X2kAB',
      operatorId: 'opr_84Qm1a',
      status: 'pass',
      inspectedAt: '2027-01-16T14:30:00Z',
      notes: 'Contract validation check.',
    }),
  });
  assertProblem(missingInspectionKey, [400, 422], 'POST /rentals/:id/inspections without Idempotency-Key');


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
