'use strict';

/**
 * Inspection Persistence & Business Rules Conformance Verification
 * File: service/tests/contract/verify_inspections.js
 */

const crypto = require('crypto');
const { tokenFor } = require('../helpers/tokens');

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4010/v1').replace(/\/+$/, '');
const equipmentId = process.env.EQUIPMENT_ID || 'eqp_8X2kAB';
const contractorId = 'ctr_72Xp9C';
const warehouseAdminId = 'adm_19Lq2f';

async function createParentRental(token) {
  const idempotencyKey = crypto.randomUUID();
  const body = {
    equipmentId: equipmentId,
    contractorId: contractorId,
    warehouseAdminId: warehouseAdminId,
    startTime: '2026-09-15T08:00:00Z',
    endTime: '2026-09-18T17:00:00Z',
    depositAmount: 150000,
    currency: 'USD',
  };

  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (response.status !== 201 || !data?.id) {
    throw new Error(`Failed to create parent rental for inspection test: status ${response.status}`);
  }
  return data.id;
}

async function sendInspection(targetRentalId, payload, key, token) {
  const response = await fetch(`${baseUrl}/rentals/${targetRentalId}/inspections`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': key,
      'authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

async function run() {
  console.log(`[TEST INSPECTIONS] Target: ${baseUrl}`);

  // 1. Token Penyewa (Contractor) - Hanya untuk membuat rental
  const contractorToken = await tokenFor(contractorId, ['rentals:write']);

  // 2. Token Admin Gudang (Warehouse Admin) - WAJIB untuk membuat inspeksi
  const adminToken = await tokenFor(warehouseAdminId, [
    'inspections:write',
    'rentals:read',
    'equipments:read',
  ]);

  // Buat rental menggunakan token Contractor
  const rentalId = process.env.RENTAL_ID || (await createParentRental(contractorToken));
  const idempotencyKey = crypto.randomUUID();

  console.log(`[TEST INSPECTIONS] Rental: ${rentalId} | Idempotency-Key: ${idempotencyKey}`);

  const validBody = {
    equipmentId: equipmentId,
    operatorId: 'opr_84Qm1a',
    status: 'pass',
    inspectedAt: '2026-09-17T14:30:00Z',
    notes: 'Field test inspection passed, engine operating normally.',
    defectSummary: 'No critical defects.',
  };

  // --- MULAI DARI SINI, SEMUA REQUEST INSPEKSI MENGGUNAKAN ADMIN TOKEN ---

  // 1. Initial creation (201 Created)
  const first = await sendInspection(rentalId, validBody, idempotencyKey, adminToken);
  if (first.response.status !== 201) {
    throw new Error(`First POST inspection returned ${first.response.status}, expected 201. Body: ${JSON.stringify(first.body)}`);
  }
  const location = first.response.headers.get('location');
  if (!location || !location.includes(`/rentals/${rentalId}/inspections/`)) {
    throw new Error(`First POST inspection is missing proper Location header. Received: ${location}`);
  }
  if (!first.body || first.body.status !== 'pass' || first.body.equipmentId !== equipmentId) {
    throw new Error(`Created inspection payload mismatch: ${JSON.stringify(first.body)}`);
  }
  console.log(`  ✓ 1. Inspection created with ID: ${first.body.id}`);

  // 2. Idempotent replay (201 Replay)
  const replay = await sendInspection(rentalId, validBody, idempotencyKey, adminToken);
  if (replay.response.status !== 201 || replay.body?.id !== first.body?.id) {
    throw new Error(`Idempotent replay did not return identical 201 response. Status: ${replay.response.status}`);
  }
  console.log('  ✓ 2. Idempotent replay successfully replayed existing record');

  // 3. Idempotency key reuse conflict (409 idempotency-key-reuse)
  const mutatedBody = { ...validBody, notes: 'Altered notes for key reuse check' };
  const keyReuseConflict = await sendInspection(rentalId, mutatedBody, idempotencyKey, adminToken);
  if (
    keyReuseConflict.response.status !== 409 ||
    keyReuseConflict.body?.type !== 'https://api.heavyrental.co/problems/idempotency-key-reuse'
  ) {
    throw new Error(`Key reuse did not return 409 idempotency-key-reuse. Status: ${keyReuseConflict.response.status}`);
  }
  console.log('  ✓ 3. Idempotency key reuse rejected with 409 Problem Details');

  // 4. Duplicate inspection conflict (409 inspection-conflict)
  const newKey = crypto.randomUUID();
  const duplicateConflict = await sendInspection(rentalId, validBody, newKey, adminToken);
  if (
    duplicateConflict.response.status !== 409 ||
    duplicateConflict.body?.type !== 'https://api.heavyrental.co/problems/inspection-conflict' ||
    duplicateConflict.body?.conflictingRentalId !== rentalId
  ) {
    throw new Error(`Duplicate inspection did not return 409 inspection-conflict. Status: ${duplicateConflict.response.status}`);
  }
  console.log('  ✓ 4. Duplicate inspection detected with 409 inspection-conflict');

  // 5. Business rule violation: equipment mismatch (422 inspection-rule-violation)
  const mismatchKey = crypto.randomUUID();
  const mismatchBody = {
    ...validBody,
    equipmentId: 'eqp_9Y3lBC',
    inspectedAt: '2026-09-17T16:00:00Z',
  };
  const ruleViolation = await sendInspection(rentalId, mismatchBody, mismatchKey, adminToken);
  if (
    ruleViolation.response.status !== 422 ||
    ruleViolation.body?.type !== 'https://api.heavyrental.co/problems/inspection-rule-violation'
  ) {
    throw new Error(`Equipment mismatch did not return 422 inspection-rule-violation. Status: ${ruleViolation.response.status}`);
  }
  console.log('  ✓ 5. Business rule violation (equipment mismatch) rejected with 422');

  // 6. Not Found check (404 resource-not-found)
  const notFoundKey = crypto.randomUUID();
  const notFoundRes = await sendInspection('rnt_nonexistent', validBody, notFoundKey, adminToken);
  if (
    notFoundRes.response.status !== 404 ||
    notFoundRes.body?.type !== 'https://api.heavyrental.co/problems/resource-not-found'
  ) {
    throw new Error(`Nonexistent rental inspection did not return 404. Status: ${notFoundRes.response.status}`);
  }
  console.log('  ✓ 6. Nonexistent rental rejected with 404');

  console.log('PASS: All inspection persistence and business rule tests passed successfully!');
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});