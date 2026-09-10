'use strict';

/**
 * Stateful demonstration for the real service only (not a stateless Prism
 * mock). It proves a duplicate request is replayed rather than inserted twice.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4010/v1 node tests/contract/verify_idempotency.js
 */

const crypto = require('crypto');
const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4010/v1').replace(/\/+$/, '');
const idempotencyKey = crypto.randomUUID();
const body = {
  equipmentId: process.env.EQUIPMENT_ID || 'eqp_8X2kAB',
  contractorId: 'ctr_72Xp9C',
  warehouseAdminId: 'adm_19Lq2f',
  startTime: '2026-09-15T08:00:00Z',
  endTime: '2026-09-18T17:00:00Z',
  depositAmount: 150000,
  currency: 'USD',
};

async function createRental(payload) {
  const response = await fetch(`${baseUrl}/rentals`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

async function run() {
  console.log(`Idempotency target: ${baseUrl}`);
  console.log(`Idempotency-Key: ${idempotencyKey}`);

  const first = await createRental(body);
  if (first.response.status !== 201) {
    throw new Error(`first POST /rentals returned ${first.response.status}, expected 201`);
  }

  const replay = await createRental(body);
  if (replay.response.status !== 201 || replay.body?.id !== first.body?.id) {
    throw new Error('identical replay did not return the original 201 rental response');
  }

  const differentBody = { ...body, depositAmount: 150001 };
  const conflict = await createRental(differentBody);
  if (conflict.response.status !== 409 || conflict.body?.type !== 'https://api.heavyrental.co/problems/idempotency-key-reuse') {
    throw new Error('same key with a different body did not return the required 409 idempotency-key-reuse problem');
  }

  console.log(`PASS: one rental (${first.body.id}) was created and the duplicate was replayed`);
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
