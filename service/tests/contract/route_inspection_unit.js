'use strict';

/**
 * Route & Business Rules In-Memory Integration Test
 * File: service/tests/contract/route_inspection_unit.js
 *
 * Tests the complete Express HTTP routing, schema validation, business rules,
 * duplicate conflict detection (409), and idempotency replay without requiring
 * an external running PostgreSQL daemon.
 */

const assert = require('node:assert/strict');
const http = require('http');

// Set required envs before loading app
process.env.PORT = '4019';
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';
process.env.NODE_ENV = 'test';

const db = require('../../src/store/db');
const app = require('../../src/app');

// In-memory mock database tables
const mockDb = {
  rentals: [
    {
      id: 'rnt_3MnB7xP',
      equipment_id: 'eqp_8X2kAB',
      contractor_id: 'ctr_72Xp9C',
      warehouse_admin_id: 'adm_19Lq2f',
      status: 'approved',
      start_time: '2026-09-15T08:00:00Z',
      end_time: '2026-09-18T17:00:00Z',
      deposit_amount: 150000,
      currency: 'USD',
      created_at: '2026-09-10T15:00:00Z',
      updated_at: '2026-09-11T09:30:00Z',
    },
    {
      id: 'rnt_cancelled',
      equipment_id: 'eqp_8X2kAB',
      contractor_id: 'ctr_72Xp9C',
      warehouse_admin_id: 'adm_19Lq2f',
      status: 'cancelled',
      start_time: '2026-09-15T08:00:00Z',
      end_time: '2026-09-18T17:00:00Z',
      deposit_amount: 150000,
      currency: 'USD',
      created_at: '2026-09-10T15:00:00Z',
      updated_at: '2026-09-11T09:30:00Z',
    },
  ],
  inspections: [],
  idempotency_keys: [],
};

// Mock db.query router
db.query = async (text, params = []) => {
  const query = text.trim();

  // 1. SELECT FROM rentals WHERE id = $1
  if (/SELECT[\s\S]*FROM\s+rentals\s+WHERE\s+id\s*=\s*\$1/i.test(query)) {
    const row = mockDb.rentals.find((r) => r.id === params[0]);
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  }

  // 2. SELECT FROM idempotency_keys WHERE key = $1
  if (/SELECT[\s\S]*FROM\s+idempotency_keys\s+WHERE\s+key\s*=\s*\$1/i.test(query)) {
    const row = mockDb.idempotency_keys.find((k) => k.key === params[0]);
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  }

  // 3. INSERT INTO idempotency_keys
  if (/INSERT\s+INTO\s+idempotency_keys/i.test(query)) {
    const record = {
      key: params[0],
      request_hash: params[1],
      response_status: params[2],
      response_body: params[3],
      created_at: new Date().toISOString(),
    };
    mockDb.idempotency_keys.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // 4. SELECT FROM inspections WHERE rental_id = $1 AND inspected_at = $2 (conflict check)
  if (/WHERE\s+rental_id\s*=\s*\$1\s+AND\s+inspected_at\s*=\s*\$2/i.test(query)) {
    const row = mockDb.inspections.find((i) => i.rental_id === params[0] && i.inspected_at === params[1]);
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  }

  // 5. INSERT INTO inspections
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockDb.inspections.push(row);
    return { rows: [row], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
};

async function runTests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(4019, resolve));
  const baseUrl = 'http://127.0.0.1:4019/v1';

  try {
    console.log('[ROUTE TEST] Testing HTTP Routes and Business Logic on ' + baseUrl);

    // 1. Missing Idempotency-Key -> 400
    const res1 = await fetch(`${baseUrl}/rentals/rnt_3MnB7xP/inspections`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body1 = await res1.json();
    assert.equal(res1.status, 400);
    assert.equal(body1.type, 'https://api.heavyrental.co/problems/invalid-request');
    console.log('  ✓ 1. Rejects missing Idempotency-Key header with 400');

    // 2. Missing body required fields -> 400
    const res2 = await fetch(`${baseUrl}/rentals/rnt_3MnB7xP/inspections`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': '00000000-0000-4000-8000-000000000001',
      },
      body: JSON.stringify({ notes: 'missing fields' }),
    });
    const body2 = await res2.json();
    assert.equal(res2.status, 400);
    assert.equal(body2.type, 'https://api.heavyrental.co/problems/invalid-request');
    console.log('  ✓ 2. Rejects invalid body schema with 400');

    // 3. Rental Not Found -> 404
    const validPayload = {
      equipmentId: 'eqp_8X2kAB',
      operatorId: 'opr_84Qm1a',
      status: 'pass',
      inspectedAt: '2026-09-17T11:00:00Z',
      notes: 'Visual inspection complete.',
      defectSummary: 'None',
    };

    const res3 = await fetch(`${baseUrl}/rentals/rnt_notfound/inspections`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': '00000000-0000-4000-8000-000000000002',
      },
      body: JSON.stringify(validPayload),
    });
    const body3 = await res3.json();
    assert.equal(res3.status, 404);
    assert.equal(body3.type, 'https://api.heavyrental.co/problems/resource-not-found');
    console.log('  ✓ 3. Rejects nonexistent rental with 404');

    // 4. Business rule: Equipment mismatch -> 422
    const res4 = await fetch(`${baseUrl}/rentals/rnt_3MnB7xP/inspections`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': '00000000-0000-4000-8000-000000000003',
      },
      body: JSON.stringify({ ...validPayload, equipmentId: 'eqp_9Y3lBC' }),
    });
    const body4 = await res4.json();
    assert.equal(res4.status, 422);
    assert.equal(body4.type, 'https://api.heavyrental.co/problems/inspection-rule-violation');
    console.log('  ✓ 4. Enforces equipment association with 422');

    // 5. Business rule: Rental in cancelled status -> 422
    const res5 = await fetch(`${baseUrl}/rentals/rnt_cancelled/inspections`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': '00000000-0000-4000-8000-000000000004',
      },
      body: JSON.stringify(validPayload),
    });
    const body5 = await res5.json();
    assert.equal(res5.status, 422);
    assert.equal(body5.type, 'https://api.heavyrental.co/problems/inspection-rule-violation');
    console.log('  ✓ 5. Enforces rental lifecycle state with 422');

    // 6. Valid insertion -> 201 Created with Location header
    const testKey = '00000000-0000-4000-8000-000000000005';
    const res6 = await fetch(`${baseUrl}/rentals/rnt_3MnB7xP/inspections`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': testKey,
      },
      body: JSON.stringify(validPayload),
    });
    const body6 = await res6.json();
    assert.equal(res6.status, 201);
    assert.match(res6.headers.get('location'), /^\/rentals\/rnt_3MnB7xP\/inspections\/ins_/);
    assert.equal(body6.rentalId, 'rnt_3MnB7xP');
    assert.equal(body6.equipmentId, 'eqp_8X2kAB');
    assert.equal(body6.status, 'pass');
    console.log(`  ✓ 6. Successfully created inspection (201) with ID: ${body6.id}`);

    // 7. Idempotent replay -> 201 with identical payload and location header
    const res7 = await fetch(`${baseUrl}/rentals/rnt_3MnB7xP/inspections`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': testKey,
      },
      body: JSON.stringify(validPayload),
    });
    const body7 = await res7.json();
    assert.equal(res7.status, 201);
    assert.equal(body7.id, body6.id);
    assert.equal(res7.headers.get('location'), res6.headers.get('location'));
    console.log('  ✓ 7. Idempotent replay returned cached response');

    // 8. Idempotency key reuse conflict -> 409
    const res8 = await fetch(`${baseUrl}/rentals/rnt_3MnB7xP/inspections`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': testKey,
      },
      body: JSON.stringify({ ...validPayload, notes: 'Modified notes' }),
    });
    const body8 = await res8.json();
    assert.equal(res8.status, 409);
    assert.equal(body8.type, 'https://api.heavyrental.co/problems/idempotency-key-reuse');
    console.log('  ✓ 8. Idempotency key reuse rejected with 409');

    // 9. Duplicate inspection conflict -> 409 inspection-conflict
    const duplicateKey = '00000000-0000-4000-8000-000000000009';
    const res9 = await fetch(`${baseUrl}/rentals/rnt_3MnB7xP/inspections`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': duplicateKey,
      },
      body: JSON.stringify(validPayload), // same inspectedAt and rental
    });
    const body9 = await res9.json();
    assert.equal(res9.status, 409);
    assert.equal(body9.type, 'https://api.heavyrental.co/problems/inspection-conflict');
    assert.equal(body9.conflictingRentalId, 'rnt_3MnB7xP');
    console.log('  ✓ 9. Duplicate inspection conflict rejected with 409 inspection-conflict');

    console.log('ALL IN-MEMORY ROUTE AND BUSINESS RULE CHECKS PASSED!');
  } finally {
    server.close();
    await db.close();
  }
}

runTests().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
